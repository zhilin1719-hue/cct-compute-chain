import express from 'express';
import { z, ZodError } from 'zod';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { registerSeo } from './seo.mjs';
import { openDatabase, projectDirectory, transaction, publicUser, contentRecord, leadRecord, readSettings, audit } from './db.mjs';
import { COOKIE_NAME, SESSION_DURATION_MS, hashPassword, verifyPassword, newSessionToken, hashToken, csrfForToken, safeEqual, sessionCookie, createRateLimiter } from './security.mjs';

const emailSchema = z.string().trim().email('请输入有效的邮箱地址。').max(254).transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(12, '密码至少需要 12 个字符。').max(128, '密码不能超过 128 个字符。');
const contentSchema = z.object({
  type: z.enum(['service', 'solution', 'insight']),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug 仅允许小写英文、数字和连字符。'),
  title: z.string().trim().min(1).max(160),
  titleEn: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(600),
  summaryEn: z.string().trim().min(1).max(1000),
  body: z.string().trim().min(1).max(40000),
  bodyEn: z.string().trim().min(1).max(60000),
  category: z.string().trim().min(1).max(80),
  status: z.enum(['draft', 'published']).default('draft'),
  featured: z.boolean().default(false),
});
const leadSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: emailSchema,
  company: z.string().trim().min(1).max(160),
  interest: z.string().trim().min(1).max(120),
  message: z.string().trim().min(10, '请至少填写 10 个字符，帮助我们了解需求。').max(5000),
  consent: z.literal(true, { error: '提交前需要同意隐私说明。' }),
  website: z.string().max(300).optional().default(''),
});
const settingsSchema = z.object({
  brandName: z.string().trim().min(1).max(100),
  heroTitle: z.string().trim().min(1).max(200),
  heroTitleEn: z.string().trim().min(1).max(200),
  heroSubtitle: z.string().trim().min(1).max(1000),
  heroSubtitleEn: z.string().trim().min(1).max(1500),
  contactEmail: emailSchema,
}).partial().strict();
const userCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  role: z.enum(['admin', 'editor']),
  password: passwordSchema,
});
const userUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(['admin', 'editor']).optional(),
  active: z.boolean().optional(),
  password: passwordSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, '至少提交一个待修改字段。');
const idSchema = z.string().uuid();

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function requireAdmin(req, _res, next) {
  if (req.auth.user.role !== 'admin') return next(new HttpError(403, '此操作需要管理员权限。'));
  next();
}

function limitRequest(consume, key, res) {
  const result = consume(key);
  if (!result.allowed) {
    res.set('Retry-After', String(result.retryAfter));
    throw new HttpError(429, '请求过于频繁，请稍后重试。');
  }
}

export function createApp(options = {}) {
  const db = openDatabase({
    dbPath: options.dbPath || (process.env.DATABASE_PATH ? resolve(projectDirectory, process.env.DATABASE_PATH) : undefined),
    bootstrapEmail: options.bootstrapEmail || process.env.ADMIN_EMAIL,
    bootstrapPassword: options.bootstrapPassword || process.env.ADMIN_PASSWORD,
    seed: options.seed ?? true,
  });
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', options.trustProxy ?? (process.env.TRUST_PROXY === '1' ? 1 : false));
  app.locals.db = db;
  app.locals.close = () => db.close();
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const primaryOrigin = options.publicOrigin || process.env.PUBLIC_ORIGIN || null;
  const additionalOrigins = options.allowedOrigins || (process.env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
  const originSet = new Set(additionalOrigins);
  if (primaryOrigin) originSet.add(new URL(primaryOrigin).origin);
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: options.secureCookies ?? production, path: '/', maxAge: SESSION_DURATION_MS };
  const loginIpLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 40 });
  const loginAccountLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 8 });
  const leadLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 5 });

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
      'X-Request-Id': randomUUID(),
    });
    if (production && req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, _res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.get('origin');
    const expected = primaryOrigin ? new URL(primaryOrigin).origin : `${req.protocol}://${req.get('host')}`;
    if (!origin || (origin !== expected && !originSet.has(origin))) return next(new HttpError(403, '请求来源验证失败。请从本站页面重试。'));
    const hasBody = Number(req.get('content-length') || 0) > 0 || Boolean(req.get('transfer-encoding'));
    if (hasBody && !req.is('application/json')) return next(new HttpError(415, '请求需要使用 application/json。'));
    next();
  });
  app.use('/api', express.json({ limit: '256kb', strict: true }));

  function authenticate(req, _res, next) {
    const token = sessionCookie(req);
    if (!token) return next(new HttpError(401, '请先登录。'));
    const tokenHash = hashToken(token);
    const session = db.prepare(`SELECT users.*, sessions.expires_at FROM sessions
      JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?`).get(tokenHash);
    if (!session || !session.active || session.expires_at <= Date.now()) {
      if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return next(new HttpError(401, '登录已过期，请重新登录。'));
    }
    req.auth = { user: publicUser(session), tokenHash, csrfToken: csrfForToken(token) };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !safeEqual(req.get('x-csrf-token'), req.auth.csrfToken)) {
      return next(new HttpError(403, '安全校验失败，请刷新页面后重试。'));
    }
    next();
  }

  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', database: 'connected' });
  });

  app.get('/api/public/bootstrap', (_req, res) => {
    const rows = db.prepare("SELECT * FROM content WHERE status = 'published' ORDER BY featured DESC, created_at ASC, rowid ASC").all();
    res.json({ settings: readSettings(db), content: rows.map(contentRecord) });
  });
  app.get('/api/public/content/:slug', (req, res) => {
    const slug = z.string().max(100).parse(req.params.slug);
    const row = db.prepare("SELECT * FROM content WHERE slug = ? AND status = 'published'").get(slug);
    if (!row) throw new HttpError(404, '内容不存在或尚未发布。');
    res.json({ item: contentRecord(row) });
  });
  app.post('/api/public/leads', (req, res) => {
    limitRequest(leadLimiter, req.ip, res);
    const input = leadSchema.parse(req.body);
    const id = randomUUID();
    if (input.website) return res.status(201).json({ id, message: '感谢您的联系，我们已收到您的需求。' });
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO leads (id, name, email, company, interest, message, consent, consent_version, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, '2026-09-25', 'new', '', ?, ?)`).run(id, input.name, input.email, input.company, input.interest, input.message, now, now);
    res.status(201).json({ id, message: '感谢您的联系，我们已收到您的需求。' });
  });

  app.post('/api/auth/login', (req, res) => {
    limitRequest(loginIpLimiter, req.ip, res);
    const input = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).parse(req.body);
    limitRequest(loginAccountLimiter, `${req.ip}:${input.email}`, res);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(input.email);
    const valid = verifyPassword(input.password, user?.password_hash);
    if (!user || !user.active || !valid) throw new HttpError(401, '邮箱或密码不正确。');
    const token = newSessionToken();
    transaction(db, () => {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
      const oldToken = sessionCookie(req);
      if (oldToken) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(oldToken));
      db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
        .run(hashToken(token), user.id, Date.now() + SESSION_DURATION_MS, new Date().toISOString());
      audit(db, user, 'auth.login', 'user', user.id);
    });
    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.json({ user: publicUser(user), csrfToken: csrfForToken(token) });
  });
  app.get('/api/auth/me', authenticate, (req, res) => {
    res.json({ user: req.auth.user, csrfToken: req.auth.csrfToken });
  });
  app.post('/api/auth/logout', authenticate, (req, res) => {
    transaction(db, () => {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.auth.tokenHash);
      audit(db, req.auth.user, 'auth.logout', 'user', req.auth.user.id);
    });
    const { maxAge: _maxAge, ...clearOptions } = cookieOptions;
    res.clearCookie(COOKIE_NAME, clearOptions);
    res.json({ message: '已退出登录。' });
  });
  app.post('/api/auth/password', authenticate, (req, res) => {
    const input = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema }).parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth.user.id);
    if (!verifyPassword(input.currentPassword, user.password_hash)) throw new HttpError(400, '当前密码不正确。');
    const passwordHash = hashPassword(input.newPassword);
    transaction(db, () => {
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, new Date().toISOString(), user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(user.id, req.auth.tokenHash);
      audit(db, req.auth.user, 'auth.password_changed', 'user', user.id);
    });
    res.json({ message: '密码已更新，其他设备的登录已失效。' });
  });

  app.use('/api/admin', authenticate);
  app.get('/api/admin/stats', (_req, res) => {
    const contentCounts = db.prepare("SELECT COUNT(*) AS contentCount, COALESCE(SUM(status = 'published'), 0) AS publishedCount FROM content").get();
    const leadCounts = db.prepare("SELECT COUNT(*) AS leadCount, COALESCE(SUM(status = 'new'), 0) AS newLeadCount FROM leads").get();
    const recentLeads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC, rowid DESC LIMIT 5').all().map(leadRecord);
    const byDate = new Map(db.prepare("SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count FROM leads WHERE created_at >= ? GROUP BY date")
      .all(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).map((item) => [item.date, item.count]));
    const leadsByDay = Array.from({ length: 7 }, (_item, index) => {
      const date = new Date(Date.now() - (6 - index) * 86400000).toISOString().slice(0, 10);
      return { date, count: byDate.get(date) || 0 };
    });
    res.json({ ...contentCounts, ...leadCounts, recentLeads, leadsByDay });
  });
  app.get('/api/admin/content', (req, res) => {
    const query = z.object({ type: z.enum(['service', 'solution', 'insight']).optional(), status: z.enum(['draft', 'published']).optional(), q: z.string().trim().max(200).optional() }).parse(req.query);
    const clauses = [];
    const params = [];
    if (query.type) { clauses.push('type = ?'); params.push(query.type); }
    if (query.status) { clauses.push('status = ?'); params.push(query.status); }
    if (query.q) { clauses.push("(instr(lower(title), lower(?)) > 0 OR instr(lower(title_en), lower(?)) > 0 OR instr(lower(slug), lower(?)) > 0)"); params.push(query.q, query.q, query.q); }
    const rows = db.prepare(`SELECT * FROM content ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY updated_at DESC, rowid DESC LIMIT 1000`).all(...params);
    res.json({ items: rows.map(contentRecord) });
  });
  app.post('/api/admin/content', (req, res) => {
    const input = contentSchema.parse(req.body);
    const id = randomUUID();
    const now = new Date().toISOString();
    transaction(db, () => {
      db.prepare(`INSERT INTO content (id, type, slug, title, title_en, summary, summary_en, body, body_en, category, status, featured, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, input.type, input.slug, input.title, input.titleEn, input.summary, input.summaryEn, input.body, input.bodyEn, input.category, input.status, Number(input.featured), now, now);
      audit(db, req.auth.user, 'content.created', 'content', id, { slug: input.slug, status: input.status });
    });
    res.status(201).json({ item: contentRecord(db.prepare('SELECT * FROM content WHERE id = ?').get(id)) });
  });
  app.put('/api/admin/content/:id', (req, res) => {
    const id = idSchema.parse(req.params.id);
    const input = contentSchema.parse(req.body);
    const previous = db.prepare('SELECT * FROM content WHERE id = ?').get(id);
    if (!previous) throw new HttpError(404, '内容不存在。');
    transaction(db, () => {
      db.prepare(`UPDATE content SET type = ?, slug = ?, title = ?, title_en = ?, summary = ?, summary_en = ?, body = ?, body_en = ?, category = ?, status = ?, featured = ?, updated_at = ? WHERE id = ?`)
        .run(input.type, input.slug, input.title, input.titleEn, input.summary, input.summaryEn, input.body, input.bodyEn, input.category, input.status, Number(input.featured), new Date().toISOString(), id);
      audit(db, req.auth.user, 'content.updated', 'content', id, { slug: input.slug, previousStatus: previous.status, status: input.status });
    });
    res.json({ item: contentRecord(db.prepare('SELECT * FROM content WHERE id = ?').get(id)) });
  });
  app.delete('/api/admin/content/:id', (req, res) => {
    const id = idSchema.parse(req.params.id);
    const item = db.prepare('SELECT * FROM content WHERE id = ?').get(id);
    if (!item) throw new HttpError(404, '内容不存在。');
    transaction(db, () => {
      db.prepare('DELETE FROM content WHERE id = ?').run(id);
      audit(db, req.auth.user, 'content.deleted', 'content', id, { slug: item.slug });
    });
    res.json({ message: '内容已删除。' });
  });
  app.get('/api/admin/leads', (req, res) => {
    const query = z.object({ status: z.enum(['new', 'contacted', 'qualified', 'closed']).optional(), q: z.string().trim().max(200).optional() }).parse(req.query);
    const clauses = [];
    const parameters = [];
    if (query.status) { clauses.push('status = ?'); parameters.push(query.status); }
    if (query.q) {
      clauses.push('(instr(lower(name), lower(?)) > 0 OR instr(lower(email), lower(?)) > 0 OR instr(lower(company), lower(?)) > 0 OR instr(lower(message), lower(?)) > 0)');
      parameters.push(query.q, query.q, query.q, query.q);
    }
    const items = db.prepare(`SELECT * FROM leads ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at DESC, rowid DESC LIMIT 1000`).all(...parameters).map(leadRecord);
    res.json({ items });
  });
  app.patch('/api/admin/leads/:id', (req, res) => {
    const id = idSchema.parse(req.params.id);
    const input = z.object({ status: z.enum(['new', 'contacted', 'qualified', 'closed']), notes: z.string().trim().max(10000).optional() }).parse(req.body);
    const previous = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
    if (!previous) throw new HttpError(404, '咨询记录不存在。');
    transaction(db, () => {
      db.prepare('UPDATE leads SET status = ?, notes = ?, updated_at = ? WHERE id = ?').run(input.status, input.notes ?? previous.notes, new Date().toISOString(), id);
      audit(db, req.auth.user, 'lead.updated', 'lead', id, { previousStatus: previous.status, status: input.status, notesUpdated: input.notes !== undefined });
    });
    res.json({ item: leadRecord(db.prepare('SELECT * FROM leads WHERE id = ?').get(id)) });
  });
  app.get('/api/admin/audit', requireAdmin, (_req, res) => {
    const items = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC, rowid DESC LIMIT 200').all().map((row) => ({
      id: row.id, actorId: row.actor_id, actorEmail: row.actor_email, action: row.action,
      entityType: row.entity_type, entityId: row.entity_id, details: JSON.parse(row.details), createdAt: row.created_at,
    }));
    res.json({ items });
  });
  app.get('/api/admin/settings', requireAdmin, (_req, res) => res.json({ settings: readSettings(db) }));
  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    const input = settingsSchema.parse(req.body);
    if (!Object.keys(input).length) throw new HttpError(400, '至少提交一个待修改字段。');
    transaction(db, () => {
      const update = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');
      const now = new Date().toISOString();
      for (const [key, value] of Object.entries(input)) update.run(key, value, now);
      audit(db, req.auth.user, 'settings.updated', 'settings', 'site', { fields: Object.keys(input) });
    });
    res.json({ settings: readSettings(db) });
  });
  app.get('/api/admin/users', requireAdmin, (_req, res) => {
    res.json({ items: db.prepare('SELECT id, name, email, role, active, created_at, updated_at FROM users ORDER BY created_at ASC').all().map(publicUser) });
  });
  app.post('/api/admin/users', requireAdmin, (req, res) => {
    const input = userCreateSchema.parse(req.body);
    const id = randomUUID();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(input.password);
    transaction(db, () => {
      db.prepare('INSERT INTO users (id, name, email, password_hash, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
        .run(id, input.name, input.email, passwordHash, input.role, now, now);
      audit(db, req.auth.user, 'user.created', 'user', id, { email: input.email, role: input.role });
    });
    res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
  });
  app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
    const id = idSchema.parse(req.params.id);
    const input = userUpdateSchema.parse(req.body);
    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!current) throw new HttpError(404, '用户不存在。');
    if (id === req.auth.user.id && input.active === false) throw new HttpError(400, '不能停用当前登录的账户。');
    const role = input.role ?? current.role;
    const active = input.active === undefined ? current.active : Number(input.active);
    const passwordHash = input.password ? hashPassword(input.password) : current.password_hash;
    transaction(db, () => {
      if (current.role === 'admin' && current.active && (role !== 'admin' || !active)) {
        const count = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1").get().count;
        if (count <= 1) throw new HttpError(400, '至少需要保留一位启用的管理员。');
      }
      db.prepare('UPDATE users SET name = ?, role = ?, active = ?, password_hash = ?, updated_at = ? WHERE id = ?')
        .run(input.name ?? current.name, role, active, passwordHash, new Date().toISOString(), id);
      if (!active || input.password || role !== current.role) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      audit(db, req.auth.user, 'user.updated', 'user', id, { fields: Object.keys(input).filter((key) => key !== 'password'), passwordReset: Boolean(input.password) });
    });
    res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
  });

  app.use('/api', (_req, _res, next) => next(new HttpError(404, '接口不存在。')));
  const distribution = resolve(projectDirectory, 'dist');
  if (existsSync(resolve(distribution, 'index.html'))) {
    const respondPage = registerSeo(app, db, distribution, primaryOrigin);
    app.use(express.static(distribution, { index: false, maxAge: 0 }));
    app.get('/{*path}', respondPage);
  }
  app.use((_req, _res, next) => next(new HttpError(404, '页面不存在。')));
  app.use((error, _req, res, _next) => {
    if (error instanceof ZodError) return res.status(400).json({ error: '请检查提交的信息。', fields: error.flatten().fieldErrors });
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: '提交的数据过大。' });
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) return res.status(400).json({ error: 'JSON 格式不正确。' });
    if (error.code === 'ERR_SQLITE_ERROR' && /UNIQUE constraint failed/.test(error.message)) return res.status(409).json({ error: '该邮箱或内容链接已存在，请使用其他值。' });
    // Never expose query text, secrets, request bodies or database details to the client.
    res.status(500).json({ error: '服务器暂时无法处理此请求，请稍后重试。' });
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const envFile = resolve(projectDirectory, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || '127.0.0.1';
  const app = createApp();
  const server = app.listen(port, host, () => {
    console.log(`CCT platform listening on http://${host}:${port}`);
    if (!app.locals.db.prepare('SELECT 1 FROM users LIMIT 1').get()) console.warn('No administrator exists. Configure ADMIN_EMAIL and ADMIN_PASSWORD, then restart to bootstrap one.');
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(() => { app.locals.close(); process.exit(0); }));
  }
}
