import { chromium } from '@playwright/test';
import express from 'express';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { once } from 'node:events';

const root = resolve(import.meta.dirname, '..');
const distribution = resolve(root, 'dist-pages');
const indexPath = resolve(distribution, 'index.html');
if (!existsSync(indexPath)) throw new Error('Static distribution is missing. Run the Pages build first.');
const html = readFileSync(indexPath, 'utf8');
if (!html.includes('/cct-compute-chain/')) throw new Error('Distribution does not use the GitHub Pages base path.');

const app = express();
app.use('/cct-compute-chain', express.static(distribution, { index: false }));
app.get('/cct-compute-chain/{*path}', (_request, response) => response.type('html').send(html));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}/cct-compute-chain/`;
const report = { timestamp: new Date().toISOString(), basePath: '/cct-compute-chain/', results: [], errors: [] };
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => report.errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const route of ['#/', '#/services', '#/opportunities', '#/content/market-signal-ai-infrastructure-2026', '#/contact']) {
      const response = await page.goto(base + route, { waitUntil: 'networkidle' });
      await page.locator('.site h1').first().waitFor();
      const state = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, heading: document.querySelector('h1')?.innerText || '', forms: document.querySelectorAll('.site-contact-form').length }));
      if (state.scrollWidth > width + 1) throw new Error(`Static horizontal overflow at ${route} on ${width}px: ${state.scrollWidth}px`);
      if (!state.heading.trim()) throw new Error(`Static page has no heading: ${route}`);
      if (route === '#/contact' && state.forms !== 0) throw new Error('Static contact page must not expose a data-collection form.');
      report.results.push({ route, width, status: response?.status() ?? 200, heading: state.heading, passed: true });
    }
  }
  await page.goto(base + '#/opportunities', { waitUntil: 'networkidle' });
  if (!await page.getByText('外部市场数据', { exact: true }).first().isVisible()) throw new Error('Market evidence label is not visible on the static site.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '#/', { waitUntil: 'networkidle' });
  await page.locator('.site-scroll-link').click();
  if (!page.url().endsWith('#/')) throw new Error('Section scrolling must not overwrite the Pages hash route.');
  await page.locator('.site-skip').focus();
  await page.locator('.site-skip').press('Enter');
  if (!await page.locator('#site-main').evaluate(element => element === document.activeElement)) throw new Error('Skip link must focus main content.');
  if (!page.url().endsWith('#/')) throw new Error('Skip link must not overwrite the Pages hash route.');
  if (report.errors.length) throw new Error(`Static browser runtime errors: ${report.errors.join('; ')}`);
  report.results.push({ name: 'static evidence labels and zero runtime errors', passed: true });
} catch (error) {
  report.results.push({ name: 'static browser verification', passed: false, error: error.stack });
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
  writeFileSync(resolve(root, 'qa/static-browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
