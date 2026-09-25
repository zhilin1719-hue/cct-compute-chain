import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const pages = {
  '/': ['AI Industrial Network', '连接推理基础设施、企业数据、智能体、行业系统与可信治理，形成可评测、可审计、可计量的生产路径。'],
  '/services': ['产品能力', '推理基础设施、企业智能体、私有 AI、治理控制平面、算能协同与产业数字化产品。'],
  '/solutions': ['行业解决方案', '从具体业务场景出发，探索教育、电商、产业与低空应用的智能化路径。'],
  '/opportunities': ['全球 AI 市场信号', '来自企业投资者关系和权威机构的 AI 基础设施、智能体、行业 AI、能源与治理市场信号。'],
  '/ecosystem': ['生态合作', '连接技术、产业与生态伙伴，共同验证场景和创造价值。'],
  '/insights': ['前沿洞察', '关于 AI、算力和智能体落地的思考与方法。'],
  '/about': ['关于 CCT', '了解 CCT 算链的方向、价值观与业务愿景。'],
  '/contact': ['合作咨询', '告诉我们您的业务场景与合作需求。'],
  '/privacy': ['隐私说明', '了解网站如何处理合作咨询中提交的信息。'],
  '/terms': ['使用条款', '了解本站内容的使用范围与服务说明。'],
};
const canonicalOrigin = (origin) => {
  try { const url = new URL(origin); return url.protocol === 'https:' ? url.origin : null; } catch { return null; }
};

export function registerSeo(app, db, distribution, origin) {
  const canonical = canonicalOrigin(origin);
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(canonical
      ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${canonical}/sitemap.xml\n`
      : 'User-agent: *\nDisallow: /\n');
  });
  app.get('/sitemap.xml', (_req, res) => {
    const records = db.prepare("SELECT slug,updated_at FROM content WHERE status='published'").all();
    const entries = canonical ? [
      ...Object.keys(pages).map(path => `<url><loc>${escapeHtml(canonical + path)}</loc></url>`),
      ...records.map(row => `<url><loc>${escapeHtml(`${canonical}/content/${encodeURIComponent(row.slug)}`)}</loc><lastmod>${escapeHtml(row.updated_at)}</lastmod></url>`),
    ].join('') : '';
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`);
  });

  return (req, res, next) => {
    if (!req.accepts('html') || /\.[a-z0-9]+$/i.test(req.path)) return next();
    const path = req.path.replace(/\/$/, '') || '/';
    const admin = path === '/admin' || path.startsWith('/admin/');
    let metadata = pages[path];
    let article = null;
    if (path.startsWith('/content/')) {
      const slug = path.slice('/content/'.length);
      article = db.prepare("SELECT title, summary, category, created_at, updated_at, source_url FROM content WHERE slug=? AND status='published'").get(slug);
      if (article) metadata = [article.title, article.summary];
    }
    const missing = !metadata && !admin;
    if (admin) metadata = ['运营管理后台', 'CCT 网站运营管理'];
    if (missing) metadata = ['页面未找到', '此页面不存在或尚未发布。'];
    const brand = db.prepare("SELECT value FROM settings WHERE key='brandName'").get()?.value || 'CCT 算链集团';
    const title = `${metadata[0]} · ${brand}`;
    const tags = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(metadata[1])}" />`,
      `<meta name="robots" content="${admin || missing || !canonical ? 'noindex,nofollow' : 'index,follow'}" />`,
    ];
    if (canonical && !admin && !missing) tags.push(`<link rel="canonical" href="${escapeHtml(canonical + path)}" />`);
    if (!admin && !missing) {
      const structured = article ? {
        '@context': 'https://schema.org', '@type': 'TechArticle', headline: article.title, description: article.summary,
        datePublished: article.created_at, dateModified: article.updated_at, articleSection: article.category,
        author: { '@type': 'Organization', name: brand }, publisher: { '@type': 'Organization', name: brand },
        ...(canonical ? { mainEntityOfPage: canonical + path } : {}), ...(article.source_url ? { citation: article.source_url } : {}),
      } : { '@context': 'https://schema.org', '@type': 'WebSite', name: brand, ...(canonical ? { url: canonical + path } : {}) };
      const safeJson = JSON.stringify(structured).replace(/</g, '\\u003c');
      tags.push(`<script type="application/ld+json">${safeJson}</script>`);
    }
    const html = readFileSync(resolve(distribution, 'index.html'), 'utf8')
      .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
      .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(metadata[1])}" />`)
      .replace(/\s*<meta property="og:(?:type|title|description)" content="[^"]*"\s*\/>/g, '')
      .replace('</head>', `${tags.join('\n')}\n</head>`);
    res.status(missing ? 404 : 200).set('Cache-Control', 'no-cache').type('html').send(html);
  };
}
