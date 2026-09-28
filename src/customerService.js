const intentRules = [
  { pattern: /漫剧|短剧|视频|comic|drama|video/i, slugs: ['ai-series-studio', 'market-signal-ai-video-2026'] },
  { pattern: /外贸|海外获客|foreign.?trade|global.?trade/i, slugs: ['ai-foreign-trade', 'ai-cross-border-commerce', 'market-signal-ai-cross-border-2026'] },
  { pattern: /跨境|电商|commerce|e.?commerce/i, slugs: ['ai-cross-border-commerce', 'ai-commerce-operations', 'market-signal-ai-cross-border-2026'] },
  { pattern: /3d|打印|增材|additive|manufactur/i, slugs: ['additive-manufacturing', 'market-signal-additive-manufacturing-2026'] },
  { pattern: /自媒体|内容运营|创作者|creator|media/i, slugs: ['ai-creator-economy', 'ai-commerce-operations', 'market-signal-creator-economy-2025'] },
  { pattern: /公共服务|政务|public.?service/i, slugs: ['ai-public-services', 'market-signal-ai-public-services-2026'] },
  { pattern: /客服|客户运营|customer.?service|customer.?operations/i, slugs: ['customer-operations-agents', 'agent-systems'] },
  { pattern: /智能体|工作流|agent|workflow/i, slugs: ['agent-systems', 'ai-control-plane', 'customer-operations-agents'] },
  { pattern: /算力|基础设施|推理|compute|inference|finops/i, slugs: ['compute-infrastructure', 'inference-fabric', 'private-ai'] },
  { pattern: /数据|安全|私有|可信|data|security|private/i, slugs: ['trusted-data', 'private-ai', 'ai-control-plane'] },
  { pattern: /业务|做什么|方向|能力|service|business|capabilit/i, slugs: ['ai-transformation', 'agent-systems', 'compute-infrastructure', 'trusted-data', 'ai-series-studio', 'ai-foreign-trade'] },
];

const textFor = (item, key, language) => language === 'en' && item?.[`${key}En`] ? item[`${key}En`] : item?.[key] || '';

export const customerServiceQuickQuestions = {
  zh: ['你们有哪些业务？', '如何启动一个 AI 项目？', 'AI 漫剧与短剧怎么合作？', '我想咨询 AI 外贸'],
  en: ['What services do you offer?', 'How do we start an AI project?', 'How can we collaborate on AI short drama?', 'I want to discuss AI global trade'],
};

export function rankCustomerServiceContent(items, question, limit = 5) {
  const normalized = String(question || '').toLowerCase();
  const preferred = intentRules.filter(rule => rule.pattern.test(normalized)).flatMap(rule => rule.slugs);
  const preferredScore = new Map(preferred.map((slug, index) => [slug, 40 - index]));
  const terms = normalized.match(/[\p{Script=Han}]{2,5}|[a-z0-9]{3,}/gu) || [];
  return (items || [])
    .filter(item => item?.status === 'published')
    .map(item => {
      const title = `${item.title || ''} ${item.titleEn || ''}`.toLowerCase();
      const summary = `${item.summary || ''} ${item.summaryEn || ''}`.toLowerCase();
      const body = `${item.body || ''} ${item.bodyEn || ''} ${item.category || ''}`.toLowerCase();
      const score = (preferredScore.get(item.slug) || 0) + terms.reduce((sum, term) => sum + (title.includes(term) ? 8 : 0) + (summary.includes(term) ? 4 : 0) + (body.includes(term) ? 1 : 0), 0) + (item.featured ? 1 : 0);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter((entry, index) => entry.score > 0 || index < limit)
    .slice(0, limit)
    .map(entry => entry.item);
}

export function buildLocalCustomerServiceResult({ question, language = 'zh', sources = [] }) {
  const en = language === 'en';
  const selected = sources.slice(0, 4);
  const titles = selected.map(item => textFor(item, 'title', language)).filter(Boolean);
  const businessQuestion = /业务|做什么|方向|能力|service|business|capabilit/i.test(question);
  const answer = businessQuestion
    ? (en
      ? 'CCT focuses on enterprise AI transformation, agents and workflows, compute infrastructure, trusted data and industry solutions. Its published directions also include AI public services, comics and short drama, global trade, cross-border commerce, 3D printing, and creator media. Open the business map below to compare all directions.'
      : 'CCT 公开业务覆盖企业 AI 转型、智能体与工作流、算力基础设施、可信数据及行业解决方案，并延伸至 AI 公共服务、AI 漫剧与短剧、AI 外贸、跨境电商、3D 打印和 AI 自媒体。您可以打开下方业务全景，按目标查看全部方向。')
    : titles.length
      ? (en
        ? `Based on CCT's published materials, the closest directions are ${titles.join(', ')}. A useful next step is to clarify your business goal, current systems or data, and the result you want to measure. I can then help narrow the starting point.`
        : `根据 CCT 已发布资料，与您问题最相关的方向是${titles.map(title => `「${title}」`).join('、')}。建议下一步说明业务目标、现有系统或数据，以及希望衡量的结果，我可以继续帮您缩小切入范围。`)
      : (en
        ? 'I could not find enough published information for a reliable answer. Please describe your industry and intended outcome, or submit an enquiry for a human follow-up.'
        : '现有公开资料不足以可靠回答。请补充所属行业和希望达成的结果，或提交合作需求由团队进一步确认。');
  return {
    mode: 'local-grounded',
    generatedBy: en ? 'CCT published-content search' : 'CCT 官网资料检索',
    answer,
    nextQuestions: en ? ['Which business result matters most?', 'What data or systems are available?'] : ['最希望解决哪项业务问题？', '目前有哪些可用数据或系统？'],
    sources: selected,
    disclaimer: en ? 'This answer uses published website content and does not constitute a quotation or contractual commitment.' : '回答依据官网已发布内容，不构成报价、合同或交付承诺。',
  };
}
