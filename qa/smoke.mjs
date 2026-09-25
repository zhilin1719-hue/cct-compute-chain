import { chromium } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createApp } from '../server/index.mjs';

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
  const routes = ['/', '/services', '/solutions', '/ecosystem', '/insights', '/about', '/contact', '/privacy', '/terms', '/content/agent-systems', '/not-a-page'];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const path of routes) {
      const response = await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.locator('.site h1').first().waitFor();
      const metrics = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, title: document.querySelector('h1')?.innerText, buttons: document.querySelectorAll('button').length }));
      if (metrics.scroll > width + 1) throw new Error(`Horizontal overflow at ${path}, width ${width}: ${metrics.scroll}`);
      if (!metrics.title?.trim()) throw new Error(`No meaningful heading at ${path}`);
      results.push({ name: `public ${path} @ ${width}`, passed: true, status: response.status(), heading: metrics.title });
      if (path === '/' || path === '/contact') await page.screenshot({ path: resolve(screenshots, `${path === '/' ? 'home' : 'contact'}-${width}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.getByRole('heading', { level: 1 }).filter({ hasText: 'Intelligence' }).waitFor();
  await page.screenshot({ path: resolve(screenshots, 'home-en-1440.png'), fullPage: true });
  results.push({ name: 'public English language toggle', passed: true });
  await page.getByRole('button', { name: '切换为中文' }).click();
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
