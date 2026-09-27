import { chromium } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createApp } from '../server/index.mjs';
import { verifyGroupExperience } from './ui-contracts.mjs';

const root = resolve(import.meta.dirname, '..');
const temporary = mkdtempSync(resolve(tmpdir(), 'cct-browser-qa-'));
const password = randomBytes(20).toString('base64url');
const email = 'browser-qa@example.com';
const app = createApp({ dbPath: resolve(temporary, 'qa.sqlite'), bootstrapEmail: email, bootstrapPassword: password });
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const base = `http://127.0.0.1:${server.address().port}`;
const screenshots = resolve(root, 'qa/screenshots');
mkdirSync(screenshots, { recursive: true });
const results = [];
const errors = [];
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  const routes = ['/', '/business', '/agents', '/think-tank', '/services', '/solutions', '/opportunities', '/ecosystem', '/insights', '/about', '/contact', '/privacy', '/terms', '/content/agent-systems', '/content/market-signal-ai-infrastructure-2026', '/not-a-page'];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const path of routes) {
      const response = await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.locator('.site h1').first().waitFor();
      const metrics = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, title: document.querySelector('h1')?.innerText, buttons: document.querySelectorAll('button').length }));
      if (metrics.scroll > width + 1) throw new Error(`Horizontal overflow at ${path}, width ${width}: ${metrics.scroll}`);
      if (!metrics.title?.trim()) throw new Error(`No meaningful heading at ${path}`);
      results.push({ name: `public ${path} @ ${width}`, passed: true, status: response.status(), heading: metrics.title });
      if (['/','/agents','/think-tank','/contact'].includes(path)) {
        const name = path === '/' ? 'home' : path.slice(1);
        await page.screenshot({ path: resolve(screenshots, `${name}-${width}.png`), fullPage: true });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  results.push(...await verifyGroupExperience(page, base));
  let emptyBootstrapRequests = 0;
  await page.route('**/api/public/bootstrap*', async route => {
    emptyBootstrapRequests += 1;
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ ...data, content: [] }) });
  });
  for (const path of ['/business', '/']) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.locator('.cct-business-map').waitFor();
    if (await page.locator('.cct-business-related a').count()) throw new Error('Unpublished business content still has public links');
    if (!await page.locator('.cct-business-cta').isVisible()) throw new Error('Business enquiry CTA is unavailable when related content is unpublished');
  }
  if (!emptyBootstrapRequests) throw new Error('Unpublished-content bootstrap route was not exercised');
  await page.unroute('**/api/public/bootstrap*');
  results.push({ name: 'business atlas hides unavailable content links on homepage and business page', passed: true });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.getByRole('heading', { level: 1 }).filter({ hasText: 'Intelligence.' }).waitFor();
  await page.screenshot({ path: resolve(screenshots, 'home-en-1440.png'), fullPage: true });
  results.push({ name: 'public English language toggle', passed: true });
  await page.getByRole('button', { name: '切换为中文' }).click();
  await page.getByRole('tab', { name: '构建 AI 基础设施' }).click();
  await page.getByRole('tabpanel').filter({ hasText: '让每一次推理，更有价值。' }).waitFor();
  await page.getByRole('tab', { name: '构建 AI 基础设施' }).press('ArrowRight');
  if (await page.getByRole('tab', { name: '寻找业务增长' }).getAttribute('aria-selected') !== 'true') throw new Error('Journey keyboard navigation failed');
  results.push({ name: 'guided discovery click and keyboard navigation', passed: true });
  const searchButton = page.getByRole('button', { name: '搜索网站', exact: true });
  await searchButton.click();
  await page.getByRole('searchbox', { name: '搜索产品、方案与洞察', exact: true }).fill('不存在的结果zzzzz');
  await page.getByRole('button', { name: '清空搜索' }).click();
  await page.getByRole('searchbox', { name: '搜索产品、方案与洞察', exact: true }).fill('FinOps');
  await page.getByRole('dialog').getByRole('link', { name: /推理基础设施与 FinOps/ }).click();
  await page.waitForURL('**/content/inference-fabric');
  if (await page.getByRole('dialog').count()) throw new Error('Search dialog remained open after navigation');
  await searchButton.click();
  await page.getByRole('searchbox', { name: '搜索产品、方案与洞察', exact: true }).press('Escape');
  if (!await searchButton.evaluate(el => el === document.activeElement)) throw new Error('Search focus was not restored');
  results.push({ name: 'global search empty state, result navigation and Escape focus restore', passed: true });
  await page.goto(base + '/services', { waitUntil: 'networkidle' });
  await page.getByRole('searchbox', { name: '搜索内容', exact: true }).fill('不存在的结果zzzzz');
  if (await page.locator('.site-service-card').count()) throw new Error('Collection search did not filter');
  await page.getByRole('button', { name: '重置筛选' }).click();
  if (!await page.locator('.site-service-card').count()) throw new Error('Reset did not restore content');
  results.push({ name: 'collection search and reset recovery', passed: true });
  await page.goto(base + '/agents', { waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(screenshots, 'agents-1440.png'), fullPage: true });
  await page.getByRole('button', { name: /增长智能体/ }).click();
  await page.locator('.site-agent-console textarea').first().fill('为算链集团制定可复核的 GEO 内容验证计划');
  const agentResponse = page.waitForResponse(response => response.url().endsWith('/api/public/ai/agent') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '生成执行建议', exact: true }).click();
  if ((await agentResponse).status() !== 200) throw new Error('AI agent endpoint did not return a brief');
  await page.locator('.site-agent-result').waitFor();
  if (!await page.getByText('生成方式：本地工作流模板', { exact: true }).isVisible()) throw new Error('AI fallback mode is not disclosed');
  results.push({ name: 'AI agent scenario selection and controlled execution brief', passed: true });
  await page.goto(base + '/think-tank', { waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(screenshots, 'think-tank-1440.png'), fullPage: true });
  await page.getByLabel('输入智库问题').fill('企业智能体需要哪些治理条件？');
  const thinkResponse = page.waitForResponse(response => response.url().endsWith('/api/public/ai/ask') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '提交智库问题' }).click();
  if ((await thinkResponse).status() !== 200) throw new Error('AI think tank endpoint did not return grounded results');
  await page.getByRole('heading', { name: '智库回答', exact: true }).waitFor();
  if (!await page.locator('.site-think-card').count()) throw new Error('Think tank did not retain published source records');
  results.push({ name: 'AI think tank question, evidence retrieval and source retention', passed: true });
  await page.goto(base + '/contact', { waitUntil: 'networkidle' });
  // Form actions are driven by visible labels. Field names are a stable cross-language contract.
  const inputByName = async (name, text) => {
    const locator = page.locator(`[name="${name}"]`);
    if (await locator.count()) await locator.fill(text);
    else throw new Error(`Missing named form field: ${name}`);
  };
  await inputByName('name', '浏览器验收联系人');
  await inputByName('email', 'browser-inquiry@example.com');
  await inputByName('company', 'CCT 浏览器验收');
  await inputByName('message', '这是一条仅存在于隔离验收数据库的真实表单提交，用于验证需求进入后台。');
  const interest = page.locator('[name="interest"]');
  if (await interest.count()) {
    if (await interest.evaluate(el => el.tagName) === 'SELECT') await interest.selectOption({ index: 1 });
    else await interest.fill('企业 AI 转型');
  }
  await page.locator('input[type="checkbox"]').check();
  const leadResponse = page.waitForResponse(response => response.url().endsWith('/api/public/leads') && response.request().method() === 'POST');
  await page.locator('.site-contact-form button[type="submit"]').click();
  const leadResult = await leadResponse;
  if (leadResult.status() !== 201) throw new Error(`Public lead submission failed: ${await leadResult.text()}`);
  results.push({ name: 'public contact submitted through browser into SQLite', passed: true });

  await page.goto(base + '/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').waitFor({ state: 'visible' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: '登录工作台', exact: true }).click();
  try { await page.locator('.adm-main').waitFor({ state: 'visible', timeout: 12000 }); }
  catch { throw new Error(`Administrator login did not open workspace. Page says: ${(await page.locator('body').innerText()).slice(0, 900)}`); }
  results.push({ name: 'administrator browser login', passed: true });
  await page.screenshot({ path: resolve(screenshots, 'admin-dashboard-1440.png'), fullPage: true });
  for (const path of ['/admin/content', '/admin/leads', '/admin/settings', '/admin/users', '/admin/audit', '/admin/account']) {
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    await page.locator('.adm-main').waitFor({ state: 'visible' });
    await page.waitForTimeout(250);
    const status = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, text: document.body.innerText }));
    if (status.scroll > status.width + 1) throw new Error(`Admin overflow ${path}`);
    if (path === '/admin/leads' && !status.text.includes('浏览器验收联系人')) throw new Error('Browser-submitted lead is absent from admin');
    if (path === '/admin/content') {
      await page.getByRole('button', { name: '创建内容', exact: true }).first().click();
      if (!await page.getByRole('button', { name: '发布内容', exact: true }).isVisible()) throw new Error('Administrator publish control is missing');
      await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
      results.push({ name: 'administrator publish control', passed: true });
    }
    results.push({ name: `authenticated ${path}`, passed: true });
    if (path === '/admin/content' || path === '/admin/leads') await page.screenshot({ path: resolve(screenshots, path.includes('content') ? 'admin-content-1440.png' : 'admin-leads-1440.png'), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.adm-main').waitFor({ state: 'visible' });
  const mobileOverflow = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth, offenders: [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.right > window.innerWidth + 1; }).slice(0, 20).map(el => ({ tag: el.tagName, className: el.className?.baseVal || el.className || '', left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width, scrollWidth: el.scrollWidth, position:getComputedStyle(el).position, overflow:getComputedStyle(el).overflowX })) }));
  if (mobileOverflow.scroll > mobileOverflow.viewport + 1) throw new Error(`Mobile admin overflows: ${JSON.stringify(mobileOverflow)}`);
  await page.screenshot({ path: resolve(screenshots, 'admin-390.png'), fullPage: true });
  results.push({ name: 'mobile administrator dashboard', passed: true });
  if (errors.length) throw new Error(`Browser runtime errors: ${errors.join('; ')}`);
  results.push({ name: 'zero uncaught browser JavaScript errors', passed: true });
} catch (error) {
  results.push({ name: 'browser verification', passed: false, error: error.stack });
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  app.locals.close();
  const report = { timestamp: new Date().toISOString(), isolatedDatabase: true, results, errors };
  writeFileSync(resolve(root, 'qa/browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
