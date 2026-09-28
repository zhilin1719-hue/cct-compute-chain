import { chromium } from '@playwright/test';
import express from 'express';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { verifyGroupExperience } from './ui-contracts.mjs';

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
    for (const route of ['#/', '#/business', '#/agents', '#/think-tank', '#/services', '#/opportunities', '#/content/market-signal-ai-infrastructure-2026', '#/contact']) {
      const response = await page.goto(base + route, { waitUntil: 'networkidle' });
      await page.locator('.site h1').first().waitFor();
      const state = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, heading: document.querySelector('h1')?.innerText || '', forms: document.querySelectorAll('.site-contact-form').length }));
      if (state.scrollWidth > width + 1) throw new Error(`Static horizontal overflow at ${route} on ${width}px: ${state.scrollWidth}px`);
      if (!state.heading.trim()) throw new Error(`Static page has no heading: ${route}`);
      if (route === '#/contact' && state.forms !== 0) throw new Error('Static contact page must not expose a data-collection form.');
      report.results.push({ route, width, status: response?.status() ?? 200, heading: state.heading, passed: true });
    }
  }
  report.results.push(...await verifyGroupExperience(page, base, { hash: true }));
  await page.goto(base + '#/agents', { waitUntil: 'networkidle' });
  await page.locator('.site-agent-console textarea').first().fill('把客户反馈整理为问题、负责人和下一步动作');
  await page.getByRole('button', { name: '生成执行建议', exact: true }).click();
  await page.locator('.site-agent-result').waitFor();
  if (!await page.getByText('生成方式：本地工作流模板', { exact: true }).isVisible()) throw new Error('Static agent fallback is not disclosed');
  report.results.push({ name: 'static AI agent local workflow brief', passed: true });
  await page.goto(base + '#/think-tank', { waitUntil: 'networkidle' });
  await page.getByLabel('输入智库问题').fill('AI 基础设施有哪些商业信号？');
  await page.getByRole('button', { name: '提交智库问题' }).click();
  await page.getByRole('heading', { name: '智库回答', exact: true }).waitFor();
  if (!await page.locator('.site-think-card').count()) throw new Error('Static think tank did not show local evidence results');
  report.results.push({ name: 'static AI think tank local evidence retrieval', passed: true });
  await page.goto(base + '#/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '打开 AI 智能客服', exact: true }).click();
  const customerDialog = page.getByRole('dialog', { name: 'CCT AI 智能客服' });
  await customerDialog.getByRole('button', { name: /我想咨询 AI 外贸/ }).click();
  await customerDialog.getByText(/与您问题最相关的方向是/).waitFor();
  if (!await customerDialog.getByRole('link', { name: /AI 外贸增长系统/ }).count()) throw new Error('Static customer service did not show a grounded published source');
  if (!await customerDialog.getByText(/不构成报价、合同或交付承诺/).isVisible()) throw new Error('Static customer service did not show its answer boundary');
  await customerDialog.getByRole('button', { name: '关闭智能客服' }).click();
  report.results.push({ name: 'static AI customer service local grounded answer', passed: true });
  await page.goto(base + '#/opportunities', { waitUntil: 'networkidle' });
  if (!await page.getByText('市场数据', { exact: true }).first().isVisible()) throw new Error('Market evidence label is not visible on the static site.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '#/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.getElementById('capabilities')?.scrollIntoView());
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
