'use strict';
const { _electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { mountFixture, albums, useWarmCabin } = require('./ui-fixture.cjs');
const desktop = path.resolve(__dirname, '..'), output = path.join(desktop, 'test-results');
const env = { ...process.env, ALBUM_DESKTOP_TEST_PROFILE: path.join(output, `showroom-ui-profile-${Date.now()}`) }; delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.ALBUM_QA_EXE || path.join(desktop, 'node_modules/electron/dist/electron.exe');
const report = { executablePath, startedAt: new Date().toISOString(), fixtureData: true, paidAIRequests: 0, productionWrites: 0, checks: [], pageErrors: [] };
let app, host, site;
async function setStyle(showroom) { await host.evaluate((showroom) => window.albumDesktop.settings('apply', { showroom }), showroom); await site.waitForFunction((showroom) => document.documentElement.dataset.desktopShowroom === showroom, showroom); }
(async () => {
  app = await _electron.launch({ executablePath, args: process.env.ALBUM_QA_EXE ? [] : [desktop], env }); app.context().setDefaultTimeout(15000); await app.firstWindow();
  for (let i = 0; i < 100; i++) { site = app.context().pages().find((p) => p.url().startsWith('https://album-circle.vercel.app')); host = app.context().pages().find((p) => p.url() === 'album-desktop://shell/index.html'); if (site && host) break; await new Promise((r) => setTimeout(r, 100)); }
  site.on('pageerror', (e) => report.pageErrors.push(e.message));
  const items = Array.from({ length: 14 }, (_, i) => ({ ...albums[i % albums.length], id: `room-fixture-${i}`, addedAt: `2026-10-${String(20 - i).padStart(2, '0')}` }));
  await mountFixture(app, site, { items }); await setStyle('room');
  await site.getByRole('list', { name: '木质唱片架' }).waitFor(); await useWarmCabin(site);
  assert.equal(await site.locator('.room-record').count(), 12);
  assert.equal(await site.getByRole('img', { name: '温馨木屋 雪窗与壁炉', exact: true }).count(), 1);
  assert.equal(await site.locator('.cabin-scene-art').getAttribute('src'), '/room-scenes/warm-cabin.png');
  await site.waitForFunction(() => [...document.querySelectorAll('.room-record img')].every((image) => image.complete && image.naturalWidth > 0));
  report.checks.push({ name: 'reference-warm-cabin-snow-window-fireplace-and-twelve-real-covers', passed: true });
  await site.locator('.room-record').nth(1).click(); assert.ok((await site.locator('.room-selection-copy h2').innerText()).includes(items[1].title));
  await site.getByRole('button', { name: '查看专辑', exact: true }).click(); await site.waitForFunction(() => new URL(location.href).searchParams.get('item') === 'room-fixture-1');
  await site.getByRole('button', { name: '展柜', exact: true }).click(); await site.locator('.room-record').first().waitFor();
  report.checks.push({ name: 'room-selection-opens-original-album-details', passed: true });
  await site.getByRole('button', { name: '下一排唱片' }).click(); assert.equal(await site.locator('.room-record').count(), 10);
  await site.getByRole('button', { name: '上一排唱片' }).click(); assert.equal(await site.locator('.room-record').count(), 12);
  report.checks.push({ name: 'room-pagination-keeps-all-albums-accessible', passed: true });
  await site.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await site.waitForTimeout(100);
  await site.screenshot({ path: path.join(output, 'warm-room.png'), fullPage: true });
  const cdp = await site.context().newCDPSession(site);
  for (const width of [960, 1920, 3840]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1080, deviceScaleFactor: 1, mobile: false });
    const metrics = await site.evaluate(() => { const rack = document.querySelector('.room-scene').getBoundingClientRect(); return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, rack: { left: rack.left, right: rack.right } }; });
    assert.ok(metrics.scrollWidth <= width + 1); assert.ok(metrics.rack.left >= 0 && metrics.rack.right <= width);
    report.checks.push({ name: `room-responsive-${width}`, passed: true, ...metrics });
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride'); await cdp.detach();
  await setStyle('coverflow'); await site.getByRole('region', { name: 'Coverflow 专辑浏览' }).waitFor();
  const currentIndex = () => site.locator('.flow-card.is-current').getAttribute('data-flow-index');
  assert.equal(await currentIndex(), '0');
  await site.getByRole('region', { name: 'Coverflow 专辑浏览' }).focus(); await site.keyboard.press('ArrowRight');
  assert.equal(await currentIndex(), '1'); await site.keyboard.press('End'); assert.equal(await currentIndex(), '13');
  await site.keyboard.press('Home'); assert.equal(await currentIndex(), '0');
  report.checks.push({ name: 'coverflow-keyboard-navigation-and-all-albums', passed: true });
  const deck = await site.locator('.flow-deck').boundingBox();
  await site.mouse.move(deck.x + deck.width / 2, deck.y + deck.height * .42); await site.mouse.down();
  await site.mouse.move(deck.x + deck.width / 2 - 140, deck.y + deck.height * .42, { steps: 8 }); await site.mouse.up();
  await site.waitForFunction(() => document.querySelector('.flow-card.is-current')?.dataset.flowIndex === '1');
  await site.mouse.wheel(0, 140); await site.waitForFunction(() => document.querySelector('.flow-card.is-current')?.dataset.flowIndex === '2');
  report.checks.push({ name: 'coverflow-drag-and-wheel', passed: true });
  await site.getByRole('slider', { name: '专辑位置' }).fill('3');
  assert.equal(await currentIndex(), '3');
  await site.getByRole('combobox', { name: '跳转到专辑' }).selectOption(items[6].id); assert.equal(await currentIndex(), '6');
  const perspective = await site.locator('.flow-card').evaluateAll((nodes) => nodes.map((node) => ({ current: node.classList.contains('is-current'), transform: getComputedStyle(node).transform })));
  assert.ok(perspective.some((node) => !node.current && node.transform.includes('matrix3d')));
  assert.ok(await site.locator('.flow-reflection').count());
  await site.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await site.waitForTimeout(700);
  await site.screenshot({ path: path.join(output, 'coverflow.png'), fullPage: true });
  report.checks.push({ name: 'coverflow-original-covers-perspective-reflections-and-scrubber', passed: true });
  await site.getByRole('button', { name: '查看专辑', exact: true }).click();
  await site.waitForFunction(() => new URL(location.href).searchParams.get('item') === 'room-fixture-6');
  await site.getByRole('button', { name: '展柜', exact: true }).click(); await site.locator('.flow-deck').waitFor();
  report.checks.push({ name: 'coverflow-opens-original-album-details', passed: true });
  const flowCdp = await site.context().newCDPSession(site);
  for (const width of [960, 1920, 3840]) {
    await flowCdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1080, deviceScaleFactor: 1, mobile: false });
    const metrics = await site.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, centerWidth: document.querySelector('.flow-card.is-current').getBoundingClientRect().width }));
    assert.ok(metrics.scrollWidth <= width + 1); assert.ok(metrics.centerWidth >= 170 && metrics.centerWidth <= 510);
    report.checks.push({ name: `coverflow-responsive-${width}`, passed: true, ...metrics });
  }
  await flowCdp.send('Emulation.clearDeviceMetricsOverride'); await flowCdp.detach();
  await host.evaluate(() => window.albumDesktop.settings('apply', { showroom: 'coverflow', reduceMotion: true }));
  await site.waitForFunction(() => getComputedStyle(document.querySelector('.flow-card')).transitionDuration.split(',').every((value) => parseFloat(value) === 0));
  report.checks.push({ name: 'coverflow-respects-reduced-motion', passed: true });
  assert.equal(await app.evaluate(() => globalThis.__qaBlockedWrites), 0); assert.equal(report.pageErrors.length, 0);
  report.passed = true;
})().catch((error) => { report.error = error.stack; report.passed = false; process.exitCode = 1; }).finally(async () => {
  if (!report.passed && site && !site.isClosed()) await site.screenshot({ path: path.join(output, 'showroom-failure.png'), fullPage: true }).catch(() => {});
  if (app) await app.close().catch(() => {});
  report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(output, 'showroom-ui-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
});
