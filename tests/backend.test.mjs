import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server/index.mjs';

const adminEmail = 'admin@test.example';
const adminPassword = 'Test-Only-Password-7942!';
const editorPassword = 'Editor-Only-Password-7291!';
const draftContent = {
  type: 'insight', slug: 'test-governance', title: '治理测试文章', titleEn: 'Governance test article',
  summary: '一篇用于验证内容发布流程的测试文章。', summaryEn: 'An article used to verify the publishing workflow.',
  body: '正文需要有权限管理、人工确认与运行记录。', bodyEn: 'The body covers permissions, human approval and operational logs.',
  category: 'TEST', status: 'draft', featured: false,
};
const validLead = {
  name: '测试用户', email: 'person@test.example', company: '测试企业', interest: 'AI transformation',
  message: '希望评估企业知识库与智能体的实施范围。', consent: true, website: '',
};

async function fixture(t, extra = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'cct-backend-'));
  const dbPath = join(directory, 'test.sqlite');
  const app = createApp({ dbPath, bootstrapEmail: adminEmail, bootstrapPassword: adminPassword, production: false, publicOrigin: null, ...extra });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  let csrfToken = '';
  t.after(async () => {
    await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
    app.locals.close();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + '\\cct-backend-') || target.startsWith(resolve(tmpdir()) + '/cct-backend-'), 'test cleanup must remain in its generated temporary folder');
    rmSync(target, { recursive: true, force: true });
  });
  async function request(path, { method = 'GET', body, auth = true, origin = base, headers = {}, raw } = {}) {
    const outgoing = { ...headers };
    if (body !== undefined || raw !== undefined) outgoing['Content-Type'] ??= 'application/json';
    if (!['GET', 'HEAD'].includes(method) && origin) outgoing.Origin = origin;
    if (auth && cookie) outgoing.Cookie = cookie;
    if (auth && csrfToken && !['GET', 'HEAD'].includes(method)) outgoing['X-CSRF-Token'] = csrfToken;
    Object.assign(outgoing, headers);
    const response = await fetch(base + path, { method, headers: outgoing, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const data = await response.json();
    return { response, data, status: response.status };
  }
  async function login(email = adminEmail, password = adminPassword) {
    const result = await request('/api/auth/login', { method: 'POST', body: { email, password }, auth: false });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    cookie = result.response.headers.get('set-cookie').split(';')[0];
    csrfToken = result.data.csrfToken;
    return result;
  }
  return { app, server, base, dbPath, request, login, credentials: () => ({ cookie, csrfToken }) };
}

test('health and published bootstrap expose useful bilingual content without credentials', async (t) => {
  const f = await fixture(t);
  const health = await f.request('/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.data, { status: 'ok', database: 'connected' });
  const result = await f.request('/api/public/bootstrap');
  assert.equal(result.status, 200);
  assert.equal(result.data.content.length, 11);
  assert.equal(result.data.settings.brandName, 'CCT 算链集团');
  assert.equal(result.data.settings.contactEmail, 'contact@cct.example');
  assert.ok(result.data.content.every((item) => item.status === 'published' && item.body && item.bodyEn));
  assert.ok(!JSON.stringify(result.data).includes('password'));
  assert.equal(result.response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(result.response.headers.get('x-frame-options'), 'DENY');
  assert.match(result.response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});

test('every administration resource rejects unauthenticated requests', async (t) => {
  const f = await fixture(t);
  for (const path of ['stats', 'content', 'leads', 'settings', 'users', 'audit']) {
    assert.equal((await f.request(`/api/admin/${path}`)).status, 401, path);
  }
  assert.equal((await f.request('/api/auth/me')).status, 401);
  assert.equal((await f.request('/api/no-such-endpoint')).status, 404);
});

test('password authentication creates an opaque expiring HttpOnly session, and logout invalidates it', async (t) => {
  const f = await fixture(t);
  const failed = await f.request('/api/auth/login', { method: 'POST', body: { email: adminEmail, password: 'incorrect' } });
  assert.equal(failed.status, 401);
  const missing = await f.request('/api/auth/login', { method: 'POST', body: { email: 'unknown@test.example', password: 'incorrect' } });
  assert.equal(missing.status, 401);
  assert.equal(missing.data.error, failed.data.error);
  const login = await f.login(adminEmail.toUpperCase());
  const cookieHeader = login.response.headers.get('set-cookie');
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /SameSite=Lax/i);
  assert.match(cookieHeader, /Max-Age=28800/i);
  assert.ok(!('password_hash' in login.data.user));
  assert.equal(login.data.csrfToken.length, 64);
  const stored = f.app.locals.db.prepare('SELECT * FROM sessions').get();
  assert.equal(stored.token_hash.length, 64);
  assert.ok(!f.credentials().cookie.includes(stored.token_hash));
  assert.ok(stored.expires_at > Date.now());
  const me = await f.request('/api/auth/me');
  assert.equal(me.data.user.email, adminEmail);
  assert.equal(me.data.csrfToken, login.data.csrfToken);
  assert.equal((await f.request('/api/auth/logout', { method: 'POST' })).status, 200);
  assert.equal((await f.request('/api/auth/me')).status, 401);
});

test('write routes reject foreign origins, absent origins and invalid CSRF tokens', async (t) => {
  const f = await fixture(t);
  const loginBody = { email: adminEmail, password: adminPassword };
  assert.equal((await f.request('/api/auth/login', { method: 'POST', body: loginBody, origin: 'https://hostile.example' })).status, 403);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', body: loginBody, origin: null })).status, 403);
  await f.login();
  assert.equal((await f.request('/api/admin/content', { method: 'POST', body: draftContent, headers: { 'X-CSRF-Token': 'invalid' } })).status, 403);
  assert.equal((await f.request('/api/admin/settings', { method: 'PUT', body: { brandName: 'Blocked' }, origin: 'https://hostile.example' })).status, 403);
  const { cookie } = f.credentials();
  const noCsrf = await f.request('/api/admin/content', { method: 'POST', body: draftContent, auth: false, headers: { Cookie: cookie } });
  assert.equal(noCsrf.status, 403);
  assert.equal((await f.request('/api/admin/content', { method: 'POST', body: draftContent })).status, 201);
});

test('content drafts remain private, publication becomes public, and deletion persists', async (t) => {
  const f = await fixture(t);
  await f.login();
  const created = await f.request('/api/admin/content', { method: 'POST', body: draftContent });
  assert.equal(created.status, 201);
  const id = created.data.item.id;
  assert.equal((await f.request('/api/public/content/test-governance')).status, 404);
  assert.ok(!(await f.request('/api/public/bootstrap')).data.content.some((item) => item.id === id));
  const published = await f.request(`/api/admin/content/${id}`, { method: 'PUT', body: { ...draftContent, status: 'published', title: '公开文章' } });
  assert.equal(published.status, 200);
  assert.equal((await f.request('/api/public/content/test-governance')).data.item.title, '公开文章');
  assert.ok((await f.request('/api/public/bootstrap')).data.content.some((item) => item.id === id));
  assert.equal((await f.request('/api/admin/content', { method: 'POST', body: draftContent })).status, 409);
  assert.equal((await f.request(`/api/admin/content/${id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await f.request('/api/public/content/test-governance')).status, 404);
  assert.equal((await f.request(`/api/admin/content/${id}`, { method: 'DELETE' })).status, 404);
});

test('lead validation enforces consent and email, and accepted leads survive a second database connection', async (t) => {
  const f = await fixture(t);
  const invalidConsent = await f.request('/api/public/leads', { method: 'POST', body: { ...validLead, consent: false } });
  assert.equal(invalidConsent.status, 400);
  assert.ok(invalidConsent.data.fields.consent);
  assert.equal((await f.request('/api/public/leads', { method: 'POST', body: { ...validLead, email: 'not-an-email' } })).status, 400);
  const accepted = await f.request('/api/public/leads', { method: 'POST', body: validLead });
  assert.equal(accepted.status, 201);
  const secondApp = createApp({ dbPath: f.dbPath, bootstrapEmail: adminEmail, bootstrapPassword: adminPassword });
  try {
    const persisted = secondApp.locals.db.prepare('SELECT * FROM leads WHERE id = ?').get(accepted.data.id);
    assert.equal(persisted.name, validLead.name);
    assert.equal(persisted.message, validLead.message);
    assert.equal(persisted.consent, 1);
    assert.equal(persisted.status, 'new');
  } finally { secondApp.locals.close(); }
  await f.login();
  const list = await f.request('/api/admin/leads');
  assert.equal(list.data.items.length, 1);
  const changed = await f.request(`/api/admin/leads/${accepted.data.id}`, { method: 'PATCH', body: { status: 'qualified', notes: '需求已确认，准备范围评估。' } });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.item.status, 'qualified');
  assert.equal((await f.request('/api/admin/leads?status=new')).data.items.length, 0);
  assert.equal((await f.request('/api/admin/leads?status=qualified')).data.items.length, 1);
  const stats = await f.request('/api/admin/stats');
  assert.equal(stats.data.leadCount, 1);
  assert.equal(stats.data.newLeadCount, 0);
  assert.equal(stats.data.leadsByDay.length, 7);
  assert.equal(stats.data.leadsByDay.reduce((sum, day) => sum + day.count, 0), 1);
});

test('editor role can manage content and leads but cannot access users, settings or audit', async (t) => {
  const f = await fixture(t);
  await f.login();
  const created = await f.request('/api/admin/users', { method: 'POST', body: { name: 'Editor', email: 'editor@test.example', role: 'editor', password: editorPassword } });
  assert.equal(created.status, 201);
  assert.ok(!JSON.stringify(created.data).includes(editorPassword));
  await f.login('editor@test.example', editorPassword);
  for (const resource of ['stats', 'content', 'leads']) assert.equal((await f.request(`/api/admin/${resource}`)).status, 200, resource);
  for (const resource of ['users', 'settings', 'audit']) assert.equal((await f.request(`/api/admin/${resource}`)).status, 403, resource);
  assert.equal((await f.request('/api/admin/settings', { method: 'PUT', body: { brandName: 'Forbidden' } })).status, 403);
  assert.equal((await f.request('/api/admin/content', { method: 'POST', body: draftContent })).status, 201);
  await f.login();
  const events = (await f.request('/api/admin/audit')).data.items;
  assert.ok(events.some((entry) => entry.action === 'content.created' && entry.actorEmail === 'editor@test.example'));
  assert.ok(!JSON.stringify(events).includes(editorPassword));
});

test('last administrator and current-account protections prevent accidental lockout', async (t) => {
  const f = await fixture(t);
  const login = await f.login();
  const id = login.data.user.id;
  assert.equal((await f.request(`/api/admin/users/${id}`, { method: 'PATCH', body: { active: false } })).status, 400);
  assert.equal((await f.request(`/api/admin/users/${id}`, { method: 'PATCH', body: { role: 'editor' } })).status, 400);
  assert.equal((await f.request('/api/admin/users', { method: 'POST', body: { name: 'Weak', email: 'weak@test.example', role: 'admin', password: 'short' } })).status, 400);
  assert.equal((await f.request('/api/admin/users', { method: 'POST', body: { name: 'Duplicate', email: adminEmail.toUpperCase(), role: 'admin', password: adminPassword } })).status, 409);
  const saved = f.app.locals.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  assert.equal(saved.role, 'admin');
  assert.equal(saved.active, 1);
  assert.match(saved.password_hash, /^scrypt\$/);
  assert.ok(!saved.password_hash.includes(adminPassword));
});

test('deactivation invalidates existing sessions and blocks further authentication', async (t) => {
  const f = await fixture(t);
  await f.login();
  const user = (await f.request('/api/admin/users', { method: 'POST', body: { name: 'Editor', email: 'editor@test.example', role: 'editor', password: editorPassword } })).data.user;
  await f.login('editor@test.example', editorPassword);
  const old = f.credentials();
  await f.login();
  assert.equal((await f.request(`/api/admin/users/${user.id}`, { method: 'PATCH', body: { active: false } })).status, 200);
  assert.equal((await f.request('/api/auth/me', { auth: false, headers: { Cookie: old.cookie } })).status, 401);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', auth: false, body: { email: 'editor@test.example', password: editorPassword } })).status, 401);
});

test('password change verifies current password and invalidates other sessions', async (t) => {
  const f = await fixture(t);
  await f.login();
  const old = f.credentials();
  await f.login();
  assert.equal((await f.request('/api/auth/password', { method: 'POST', body: { currentPassword: 'wrong', newPassword: 'Replacement-Password-9753!' } })).status, 400);
  assert.equal((await f.request('/api/auth/password', { method: 'POST', body: { currentPassword: adminPassword, newPassword: 'Replacement-Password-9753!' } })).status, 200);
  assert.equal((await f.request('/api/auth/me')).status, 200);
  assert.equal((await f.request('/api/auth/me', { auth: false, headers: { Cookie: old.cookie } })).status, 401);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', auth: false, body: { email: adminEmail, password: adminPassword } })).status, 401);
  await f.login(adminEmail, 'Replacement-Password-9753!');
});

test('prepared statements treat SQL injection payloads as data and leave all records intact', async (t) => {
  const f = await fixture(t);
  await f.login();
  const before = (await f.request('/api/admin/stats')).data;
  const injection = "x' OR 1=1; DROP TABLE users; --";
  assert.equal((await f.request(`/api/admin/content?q=${encodeURIComponent(injection)}`)).data.items.length, 0);
  assert.equal((await f.request(`/api/admin/leads?q=${encodeURIComponent(injection)}`)).data.items.length, 0);
  assert.equal((await f.request(`/api/public/content/${encodeURIComponent(injection)}`)).status, 404);
  assert.equal((await f.request('/api/public/leads', { method: 'POST', body: { ...validLead, name: injection } })).status, 201);
  assert.equal((await f.request('/api/admin/leads')).data.items[0].name, injection);
  assert.equal((await f.request('/api/admin/users')).data.items.length, 1);
  assert.equal((await f.request('/api/admin/stats')).data.contentCount, before.contentCount);
});

test('honeypot avoids persisting bot submissions and lead rate limiting is enforced', async (t) => {
  const f = await fixture(t);
  const honeypot = await f.request('/api/public/leads', { method: 'POST', body: { ...validLead, website: 'https://spam.example' } });
  assert.equal(honeypot.status, 201);
  assert.equal(f.app.locals.db.prepare('SELECT COUNT(*) AS count FROM leads').get().count, 0);
  for (let index = 0; index < 4; index++) assert.equal((await f.request('/api/public/leads', { method: 'POST', body: validLead })).status, 201);
  const limited = await f.request('/api/public/leads', { method: 'POST', body: validLead });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.response.headers.get('retry-after')) > 0);
});

test('login rate limiting blocks repeated account attempts without issuing a session', async (t) => {
  const f = await fixture(t);
  for (let index = 0; index < 8; index++) {
    assert.equal((await f.request('/api/auth/login', { method: 'POST', auth: false, body: { email: adminEmail, password: 'incorrect' } })).status, 401);
  }
  const limited = await f.request('/api/auth/login', { method: 'POST', auth: false, body: { email: adminEmail, password: adminPassword } });
  assert.equal(limited.status, 429);
  assert.equal(limited.response.headers.get('set-cookie'), null);
  assert.equal(f.app.locals.db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, 0);
});

test('expired sessions, malformed bodies and oversized requests fail safely', async (t) => {
  const f = await fixture(t);
  await f.login();
  f.app.locals.db.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() - 1);
  assert.equal((await f.request('/api/auth/me')).status, 401);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', raw: '{bad json' })).status, 400);
  assert.equal((await f.request('/api/public/leads', { method: 'POST', body: validLead, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.request('/api/public/leads', { method: 'POST', raw: JSON.stringify({ message: 'x'.repeat(270000) }) })).status, 413);
});

test('settings changes persist publicly and rejected values cannot overwrite approved fields', async (t) => {
  const f = await fixture(t);
  await f.login();
  const saved = await f.request('/api/admin/settings', { method: 'PUT', body: { heroTitle: '新的首页标题', contactEmail: 'inquiries@test.example' } });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.settings.heroTitle, '新的首页标题');
  const published = await f.request('/api/public/bootstrap');
  assert.equal(published.data.settings.contactEmail, 'inquiries@test.example');
  assert.equal((await f.request('/api/admin/settings', { method: 'PUT', body: { ADMIN_PASSWORD: 'attack' } })).status, 400);
  assert.equal((await f.request('/api/admin/settings', { method: 'PUT', body: { contactEmail: 'invalid' } })).status, 400);
  const events = (await f.request('/api/admin/audit')).data.items;
  assert.ok(events.some((event) => event.action === 'settings.updated' && event.details.fields.includes('heroTitle')));
});

test('production cookies are Secure and deleting seed content is not undone by reopening the database', async (t) => {
  const f = await fixture(t, { production: true, secureCookies: true });
  const login = await f.login();
  assert.match(login.response.headers.get('set-cookie'), /; Secure/i);
  f.app.locals.db.prepare('DELETE FROM content').run();
  const reopened = createApp({ dbPath: f.dbPath, bootstrapEmail: adminEmail, bootstrapPassword: 'Different-Password-7291!' });
  try {
    assert.equal(reopened.locals.db.prepare('SELECT COUNT(*) AS count FROM content').get().count, 0);
    assert.equal(reopened.locals.db.prepare('SELECT COUNT(*) AS count FROM users').get().count, 1);
  } finally { reopened.locals.close(); }
});
