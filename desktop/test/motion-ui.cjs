'use strict';
const { _electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { mountFixture, albums } = require('./ui-fixture.cjs');
const desktop = path.resolve(__dirname, '..'), output = path.join(desktop, 'test-results');
const executablePath = process.env.ALBUM_QA_EXE || path.join(desktop, 'node_modules/electron/dist/electron.exe');
const env = { ...process.env, ALBUM_DESKTOP_TEST_PROFILE: path.join(output, `motion-ui-profile-${Date.now()}`) }; delete env.ELECTRON_RUN_AS_NODE;
const report = { executablePath, startedAt: new Date().toISOString(), accountAndRoomResponsesMocked: true, aiResponseMocked: true, paidAIRequests: 0, productionWrites: 0, checks: [], pageErrors: [] };
let app, site;
async function verifySleeve(coverSelector, discSelector) {
  return site.evaluate(({ coverSelector, discSelector }) => {
    const cover = document.querySelector(coverSelector), disc = document.querySelector(discSelector);
    cover.style.pointerEvents = 'auto'; disc.style.pointerEvents = 'auto';
    const animations = [...cover.getAnimations(), ...disc.getAnimations()]; animations.forEach((a) => a.pause());
    const phases = [0, 800, 2300, 3900, 5900].map((time) => {
      animations.forEach((a) => { a.currentTime = time; });
      const c = cover.getBoundingClientRect(), d = disc.getBoundingClientRect();
      const x = (Math.max(c.left + c.width * 0.2, d.left + d.width * 0.15) + Math.min(c.right - c.width * 0.15, d.right - d.width * 0.15)) / 2;
      const y = (Math.max(c.top + c.height * 0.2, d.top + d.height * 0.2) + Math.min(c.bottom - c.height * 0.2, d.bottom - d.height * 0.2)) / 2;
      const hit = document.elementsFromPoint(x, y).find((node) => node === disc || cover.contains(node));
      return { time, sleeveOnTop: Boolean(hit && cover.contains(hit)), discExposed: d.right > c.right + 8, coverZ: getComputedStyle(cover).zIndex, discZ: getComputedStyle(disc).zIndex };
    });
    animations.forEach((a) => a.play()); return phases;
  }, { coverSelector, discSelector });
}
async function currentBackground(id) {
  await site.waitForFunction((id) => document.querySelector('.corridor-background-layer[data-current="true"]')?.dataset.albumId === id, id);
}
(async () => {
  app = await _electron.launch({ executablePath, args: process.env.ALBUM_QA_EXE ? [] : [desktop], env });
  app.context().setDefaultTimeout(15000); await app.firstWindow();
  for (let i = 0; i < 100; i++) { site = app.context().pages().find((page) => page.url().startsWith('https://album-circle.vercel.app')); if (site) break; await new Promise((resolve) => setTimeout(resolve, 100)); }
  assert.ok(site); site.on('pageerror', (error) => report.pageErrors.push(error.message));
  const items = albums.map((item) => ({ ...item })); items[2].cover += '?qa-slow-cover=1';
  items.push({ ...items[0], id: 'qa-broken-cover', title: '封面缺失测试', cover: items[0].cover + '?qa-broken-cover=1' });
  await mountFixture(app, site, { items, gateAI: true, slowCover: true });
  const query = site.getByRole('searchbox', { name: '快速搜索专辑或歌曲' }); await query.fill('叶惠美'); await query.press('Enter');
  await site.locator('.global-candidate').first().click(); await site.locator('.global-confirm button').click();
  await site.locator('.global-adding-cover-frame img').waitFor();
  await site.waitForFunction(() => document.querySelector('.global-adding-cover-frame img')?.naturalWidth > 0);
  const globalPhases = await verifySleeve('.global-adding-cover-frame', '.global-adding-disc');
  assert.ok(globalPhases.every((phase) => phase.sleeveOnTop && phase.discExposed), JSON.stringify(globalPhases));
  await site.screenshot({ path: path.join(output, 'vinyl-cover-global.png') });
  report.checks.push({ name: 'global-adding-sleeve-covers-rotating-vinyl-at-five-phases', passed: true, phases: globalPhases });
  await site.getByRole('button', { name: '高级添加', exact: true }).click(); await site.locator('.loader-cover').waitFor();
  await site.locator('.loader-cover').scrollIntoViewIfNeeded();
  const advancedPhases = await verifySleeve('.loader-cover', '.loader-disc');
  assert.ok(advancedPhases.every((phase) => phase.sleeveOnTop && phase.discExposed), JSON.stringify(advancedPhases));
  await site.screenshot({ path: path.join(output, 'vinyl-cover-advanced.png') });
  report.checks.push({ name: 'advanced-adding-sleeve-covers-vinyl-at-five-phases', passed: true, phases: advancedPhases });
  await app.evaluate(() => globalThis.__qaReleaseAI()); await site.waitForFunction(() => !document.querySelector('.loader-cover'));
  await site.getByRole('button', { name: '展柜', exact: true }).click();
  const open = site.getByRole('button', { name: '打开隐藏封面长廊', exact: true }); await open.click(); await currentBackground(items[0].id);
  // Sample actual compositor opacity at animation frames after pressing Right.
  await site.evaluate(() => {
    window.__qaFrames = []; const start = performance.now();
    function sample(now) { const layers = [...document.querySelectorAll('.corridor-background-layer')]; window.__qaFrames.push({ time: now - start, opacity: layers.map((node) => +getComputedStyle(node).opacity), blur: layers.map((node) => getComputedStyle(node).filter), moving: document.querySelector('.corridor-overlay')?.classList.contains('is-moving') }); if (now - start < 1000) requestAnimationFrame(sample); }
    requestAnimationFrame(sample);
  });
  await site.keyboard.press('ArrowRight'); await currentBackground(items[1].id); await site.waitForTimeout(500);
  const frames = await site.evaluate(() => window.__qaFrames);
  assert.ok(frames.some((frame) => frame.opacity.some((o) => o > 0.03 && o < 0.97)));
  assert.ok(frames.every((frame) => Math.max(...frame.opacity) >= 0.99));
  assert.ok(frames.filter((frame) => frame.moving).every((frame) => frame.blur.every((value) => value.includes('blur'))));
  const intervals = frames.slice(1).map((frame, i) => frame.time - frames[i].time).sort((a, b) => a - b);
  report.checks.push({ name: 'background-crossfades-without-dark-flash-and-keeps-blur-while-moving', passed: true, sampledFrames: frames.length, frameIntervalP95: intervals[Math.floor(intervals.length * 0.95)] });
  await site.keyboard.press('ArrowRight'); await site.waitForTimeout(300);
  assert.equal(await site.locator('.corridor-background-layer[data-current="true"]').getAttribute('data-album-id'), items[1].id);
  await app.evaluate(() => globalThis.__qaReleaseImage()); await currentBackground(items[2].id);
  assert.equal(await site.locator('.corridor-background-layer[data-current="true"]').getAttribute('data-image-ready'), 'true');
  report.checks.push({ name: 'slow-cover-keeps-old-image-until-new-cover-is-decoded', passed: true });
  await site.keyboard.press('ArrowRight'); await currentBackground(items[3].id);
  await site.keyboard.press('ArrowRight'); await currentBackground(items[4].id);
  assert.equal(await site.locator('.corridor-background-layer[data-current="true"]').getAttribute('data-image-ready'), 'false');
  report.checks.push({ name: 'failed-cover-uses-palette-fallback', passed: true });
  for (let i = 0; i < 8; i++) { await site.keyboard.press('ArrowRight'); await site.waitForTimeout(25); }
  const selected = await site.locator('.corridor-card.is-active').getAttribute('data-corridor-index');
  await currentBackground(items[Number(selected)].id);
  assert.equal(await site.locator('.corridor-background-layer').count(), 2);
  await site.screenshot({ path: path.join(output, 'corridor-smooth-background.png') });
  report.checks.push({ name: 'rapid-navigation-coalesces-latest-selection-with-two-layers', passed: true });
  await site.keyboard.press('ArrowRight'); await site.getByRole('button', { name: '关闭封面长廊' }).click(); await open.click();
  await site.waitForSelector('.corridor-background-layer[data-current="true"]');
  report.checks.push({ name: 'close-and-reopen-during-fade-without-stale-layer', passed: true });
  await site.getByRole('button', { name: '关闭封面长廊' }).click();
  const host = app.context().pages().find((page) => page.url() === 'album-desktop://shell/index.html');
  await host.evaluate(() => window.albumDesktop.settings('apply', { reduceMotion: true }));
  await site.waitForFunction(() => document.documentElement.dataset.desktopReduceMotion === 'true');
  await open.click();
  await site.waitForSelector('.corridor-background-layer[data-current="true"]'); await site.keyboard.press('ArrowRight');
  const reducedSlot = await site.locator('.corridor-card.is-active').getAttribute('data-corridor-index'); await currentBackground(items[Number(reducedSlot)].id);
  assert.equal(await site.locator('.corridor-background-layer').evaluateAll((nodes) => nodes.flatMap((node) => node.getAnimations()).length), 0);
  report.checks.push({ name: 'reduced-motion-skips-background-animation', passed: true });
  assert.equal(await app.evaluate(() => globalThis.__qaBlockedWrites), 0); assert.equal(report.pageErrors.length, 0);
  report.passed = true;
})().catch((error) => { report.error = error.stack; report.passed = false; process.exitCode = 1; }).finally(async () => {
  if (!report.passed && site && !site.isClosed()) { await site.screenshot({ path: path.join(output, 'motion-failure.png') }).catch(() => {}); report.failurePage = (await site.locator('body').innerText()).slice(0, 1600); }
  if (app) { await app.evaluate(() => { globalThis.__qaReleaseAI?.(); globalThis.__qaReleaseImage?.(); }).catch(() => {}); await app.close().catch(() => {}); }
  report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(output, 'motion-ui-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
});
