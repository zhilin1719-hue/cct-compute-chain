// Shared browser acceptance for the group's new discovery and navigation flows.
export async function verifyGroupExperience(page, base, { hash = false } = {}) {
  const route = path => base.replace(/\/$/, '') + (hash ? '/#' : '') + path;
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  await page.goto(route('/business'), { waitUntil: 'networkidle' });
  check(await page.locator('.cct-business-map button').count() === 15, 'The group map must expose all fifteen business directions');
  for (const button of await page.locator('.cct-business-map button').all()) {
    await button.click();
    check(await button.getAttribute('aria-pressed') === 'true', 'Business selection must be visible and accessible');
    check((await page.locator('.cct-business-detail h3').innerText()).trim().length > 0, 'Business details must have a heading');
  }
  await page.getByRole('button', { name: /AI 漫剧与短剧/ }).click();
  check((await page.locator('.cct-business-model').innerText()).includes('内容分成'), 'New growth directions must explain how customers can commercialize the service');
  check((await page.locator('.cct-business-start').innerText()).includes('3 集样片'), 'New growth directions must provide a concrete first pilot');
  await page.getByRole('button', { name: '创新业务', exact: true }).click();
  check(await page.locator('.cct-business-map button').count() === 4, 'Pilot filter must expose public services, additive manufacturing, robotics and low-altitude directions');
  await page.getByRole('button', { name: '生态合作', exact: true }).click();
  check(await page.locator('.cct-business-map button').count() === 1, 'Review filter must expose the capital collaboration direction');
  check((await page.locator('.cct-business-boundary').innerText()).includes('不构成金融产品'), 'Capital direction must retain its scope boundary');
  check(await page.locator('.cct-business-cta').getAttribute('href') === (hash ? '#/ecosystem' : '/ecosystem'), 'Capital CTA must link to ecosystem collaboration');

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 640 ? 844 : 1000 });
    await page.goto(route('/'), { waitUntil: 'networkidle' });
    const bounds = await page.locator('.site-hero-art').evaluate(element => ({ right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width, viewport: document.documentElement.clientWidth }));
    check(bounds.right <= bounds.viewport + 1 && bounds.width > 0, `Hero artwork is clipped at ${width}px`);
    check(await page.locator('.site-hero-art img').evaluate(img => img.complete && img.naturalWidth > 0), 'Brand artwork failed to load');
  }
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.getByRole('button', { name: '打开菜单', exact: true }).click();
  const menuBounds = await page.evaluate(() => ({
    header: document.querySelector('.site-header').getBoundingClientRect().bottom,
    nav: document.querySelector('#site-main-nav').getBoundingClientRect().top,
  }));
  check(Math.abs(menuBounds.header - menuBounds.nav) < 1, 'Tablet navigation must start below the header');
  await page.locator('#site-menu-toggle').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开菜单', exact: true }).click();
  const first = page.locator('#site-main-nav a').first();
  check(await first.evaluate(el => document.activeElement === el), 'Opening mobile navigation must focus its first link');
  await first.press('Shift+Tab');
  check(await page.locator('#site-menu-toggle').evaluate(el => document.activeElement === el), 'Mobile reverse tab must wrap to the menu control');
  await page.locator('#site-menu-toggle').press('Tab');
  check(await first.evaluate(el => document.activeElement === el), 'Mobile tab must wrap back to the first link');
  await first.press('Escape');
  check(await page.locator('#site-menu-toggle').getAttribute('aria-expanded') === 'false', 'Escape must close mobile navigation');
  await page.getByRole('button', { name: '打开菜单', exact: true }).click();
  await first.press('Control+k');
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.getByRole('dialog').press('Escape');
  await page.waitForFunction(() => document.activeElement?.classList.contains('site-search-trigger'));
  check(await page.locator('#site-menu-toggle').getAttribute('aria-expanded') === 'false', 'Opening search must close the mobile menu');
  await page.getByRole('button', { name: '打开菜单', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(() => document.body.style.overflow !== 'hidden');

  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.goto(route('/business'), { waitUntil: 'networkidle' });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const right = await page.locator('.cct-business-workspace').evaluate(element => ({ right: element.getBoundingClientRect().right, viewport: document.documentElement.clientWidth }));
    check(right.right <= right.viewport + 1, `English business map overflows at ${width}px`);
  }
  await page.getByRole('button', { name: '切换为中文' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  return [
    { name: 'all fifteen business directions, commercial paths, first pilots, filters and related CTA', passed: true },
    { name: 'hero asset and container bounds at 360/390/768/1024/1440px', passed: true },
    { name: 'mobile navigation focus, shortcut search recovery, Escape and desktop scroll recovery', passed: true },
    { name: 'English business atlas at mobile and desktop widths', passed: true },
  ];
}
