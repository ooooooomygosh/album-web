import assert from 'node:assert/strict';
import path from 'node:path';

// UI-only checks, sharing the screenshot suite's isolated, offline routes.
export async function verifyWelcome({ browser, origin, routeHandler, evidence, output, check }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', reducedMotion: 'reduce' });
  const failures = [];
  await context.route('**/*', routeHandler);
  await context.addInitScript(() => {
    window.open = () => { throw new Error('The guide must not invoke native actions'); };
  });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', error => failures.push(error.message));
  const guide = page.getByRole('dialog', { name: '欢迎来到心流小屋' });
  const next = () => page.getByRole('button', { name: '下一步', exact: true }).click();
  const reopen = async () => { await page.getByRole('button', { name: '入门指南', exact: true }).click(); await guide.waitFor(); };
  const inViewport = async locator => {
    const box = await locator.boundingBox(), view = page.viewportSize();
    assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= view.width + 1 && box.y + box.height <= view.height + 1);
  };
  try {
    await page.goto(origin); await guide.waitFor();
    await page.evaluate(() => document.fonts.ready);
    await guide.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await page.screenshot({ path: path.join(output, 'welcome.jpg'), type: 'jpeg', quality: 88, animations: 'disabled' });
    for (const viewport of [{ width: 1440, height: 900 }, { width: 960, height: 600 }, { width: 640, height: 600 }]) {
      await page.setViewportSize(viewport);
      for (const control of ['下一步', '先逛逛小屋', '入门选择 枫糖']) await inViewport(page.getByRole('button', { name: control, exact: true }));
      assert(await guide.evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth));
      await page.screenshot({ path: path.join(evidence, `guide-${viewport.width}.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 960, height: 600 });
    await page.getByRole('button', { name: '入门选择 林间书屋', exact: true }).click();
    await page.getByRole('button', { name: '入门选择 枫糖', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '入门选择 枫糖', exact: true }).getAttribute('aria-pressed'), 'true');
    await next();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'welcome-heading');
    await guide.getByText('收藏封面和播放音乐，是两步。', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(evidence, 'guide-music.png'), animations: 'disabled' });
    await next();
    await page.screenshot({ path: path.join(evidence, 'guide-focus.png'), animations: 'disabled' });
    await inViewport(page.getByRole('button', { name: '打开专注工具', exact: true }));
    await page.getByRole('button', { name: '打开专注工具', exact: true }).click();
    await guide.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '开始专注', exact: true }).waitFor();
    assert.equal(await page.locator('.focus-badge.is-running').count(), 0);
    assert.equal(await page.locator('.room-record').count(), 0);
    assert.equal(await page.locator('audio[src]').count(), 0);
    check('first-visit-guide-three-sizes-keyboard-heading-and-no-autostart');
    await page.reload(); await page.getByRole('button', { name: '添加第一张专辑' }).waitFor();
    assert.equal(await guide.count(), 0);
    assert.equal(await page.locator('.cabin-scene').getAttribute('data-room-look'), 'forest');
    assert.equal(await page.locator('.room-cat .pixel-cat').getAttribute('data-pet-id'), 'fox');
    check('guide-dismissal-scene-and-companion-survive-reload');
    await reopen(); await next(); await next();
    await page.getByRole('button', { name: '添加我的第一张专辑', exact: true }).click();
    await page.getByRole('dialog', { name: '添加专辑', exact: true }).waitFor(); await page.keyboard.press('Escape');
    await reopen(); await next(); await next(); await page.getByRole('button', { name: '先连接音源', exact: true }).click();
    await page.getByRole('dialog', { name: '音源与账户', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Music Assistant 服务器地址').isVisible(), false);
    await page.locator('.music-advanced summary').click();
    await page.getByLabel('Music Assistant 服务器地址').waitFor();
    await page.keyboard.press('Escape');
    await reopen(); await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: '入门指南', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.reload(); await page.getByRole('button', { name: '添加第一张专辑' }).waitFor(); assert.equal(await guide.count(), 0);
    check('guide-all-exit-actions-escape-and-focus-restoration');
    await reopen();
    assert.equal(await page.locator('.welcome-step').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(await page.locator('.welcome-step').evaluate(el => getComputedStyle(el).animationName), 'welcome-step-in');
    await page.evaluate(() => { document.documentElement.dataset.desktopReduceMotion = 'true'; });
    assert.equal(await page.locator('.welcome-step').evaluate(el => getComputedStyle(el).animationName), 'none');
    check('guide-motion-obeys-os-and-app-preferences');
    await page.evaluate(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key.startsWith('album-circle-library')) throw new DOMException('Storage full', 'QuotaExceededError'); return set.call(this, key, value); };
    });
    await page.getByRole('button', { name: '入门选择 海边慢屋', exact: true }).click();
    await guide.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('button', { name: '入门选择 林间书屋', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: '先逛逛小屋', exact: true }).click();
    check('guide-storage-failure-preserves-selection-and-allows-exit');
    assert.deepEqual(failures, []);
  } finally { await context.close(); }

  const returning = await browser.newContext();
  try {
    await returning.route('**/*', routeHandler);
    await returning.addInitScript(() => localStorage.setItem('album-circle-focus-dock-v1', JSON.stringify({ open: false, tab: 'timer' })));
    const page = await returning.newPage(); await page.goto(origin); await page.getByRole('button', { name: '添加第一张专辑' }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    check('returning-empty-collection-is-not-interrupted');
  } finally { await returning.close(); }
}
