'use strict';
const { _electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { mountFixture } = require('./ui-fixture.cjs');
const desktop = path.resolve(__dirname, '..');
const output = path.join(desktop, 'test-results');
const profile = path.join(output, `settings-ui-profile-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });
for (const name of ['settings.json', 'window.json']) { try { fs.unlinkSync(path.join(profile, name)); } catch {} }
const env = { ...process.env, ALBUM_DESKTOP_TEST_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.ALBUM_QA_EXE || path.join(desktop, 'node_modules/electron/dist/electron.exe');
const report = { startedAt: new Date().toISOString(), executablePath, paidAIRequests: 0, checks: [] };
let app, host, site;
async function launch() {
  app = await _electron.launch({ executablePath, args: process.env.ALBUM_QA_EXE ? [] : [desktop], env });
  app.context().setDefaultTimeout(15000);
  await app.firstWindow();
  for (let i = 0; i < 100; i++) {
    host = app.context().pages().find((page) => page.url() === 'album-desktop://shell/index.html');
    site = app.context().pages().find((page) => page.url().startsWith('https://album-circle.vercel.app'));
    if (host && site) break; await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await host.waitForFunction(() => document.querySelector('#status')?.textContent === '界面就绪', null, { timeout: 60000 });
  assert.ok(site); await site.waitForSelector('.app', { timeout: 20000 });
  await mountFixture(app, site);
}
async function waitApplied(expected) {
  await site.waitForFunction((expected) => document.documentElement.dataset.desktopTheme === expected.theme && getComputedStyle(document.documentElement).getPropertyValue('--desktop-weight').trim() === String(expected.weight), expected);
}
(async () => {
  await launch();
  const displays = await app.evaluate(({ screen, BrowserWindow }) => ({ monitors: screen.getAllDisplays().map((d) => ({ label: d.label, bounds: d.bounds, scaleFactor: d.scaleFactor })), window: BrowserWindow.getAllWindows()[0].getBounds(), maximized: BrowserWindow.getAllWindows()[0].isMaximized() }));
  assert.equal(displays.maximized, true);
  report.checks.push({ name: 'first-start-adapts-to-current-display', passed: true, ...displays });
  const fonts = await site.evaluate(async () => {
    const weights = [250, 300, 400, 500, 700, 900];
    const result = [];
    for (const weight of weights) { const faces = await document.fonts.load(`${weight} 20px "HarmonyOS Sans SC Bundled"`, '中文 Album 123'); result.push({ weight, loaded: faces.length > 0, status: faces[0]?.status }); }
    return { faces: result, family: getComputedStyle(document.body).fontFamily };
  });
  assert.ok(fonts.family.includes('HarmonyOS Sans SC Bundled')); assert.ok(fonts.faces.every((f) => f.loaded && f.status === 'loaded'));
  const cdp = await site.context().newCDPSession(site); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const doc = await cdp.send('DOM.getDocument');
  const node = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '.app h1' });
  const platformFonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId });
  assert.ok(platformFonts.fonts.some((font) => font.isCustomFont && font.familyName.includes('HarmonyOS')));
  report.checks.push({ name: 'six-original-bundled-font-weights-and-real-rendered-font', passed: true, ...fonts, platformFonts });
  for (const metrics of [{ width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }, { width: 3840, height: 2160, deviceScaleFactor: 1, mobile: false }, { width: 1920, height: 1080, deviceScaleFactor: 2, mobile: false }]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', metrics);
    const layout = await site.evaluate(() => ({ viewport: innerWidth, contentWidth: document.documentElement.scrollWidth, shellWidth: document.querySelector('.shell').getBoundingClientRect().width, dpr: devicePixelRatio }));
    assert.ok(layout.contentWidth <= metrics.width + 1); assert.ok(layout.shellWidth > metrics.width * 0.9);
    if (metrics.deviceScaleFactor === 2) await site.screenshot({ path: path.join(output, 'display-high-dpi.png') });
    report.checks.push({ name: `responsive-${metrics.width}x${metrics.height}-dpi${metrics.deviceScaleFactor}`, passed: true, ...layout });
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride'); await cdp.detach();
  await site.getByRole('button', { name: '软件设置', exact: true }).click();
  await host.locator('#settings-panel').waitFor({ state: 'visible' });
  await host.waitForFunction(() => document.querySelectorAll('#font optgroup option').length > 0, null, { timeout: 20000 });
  const systemFonts = await host.locator('#font optgroup option').evaluateAll((options) => options.map((option) => option.value));
  assert.ok(systemFonts.length > 0);
  await host.locator('#theme').selectOption('simple'); await host.locator('#weight').selectOption('700');
  await host.locator('#zoom').fill('115'); await host.locator('#reduce-motion').check();
  await host.getByRole('button', { name: '保存设置', exact: true }).click();
  await host.waitForFunction(() => document.querySelector('#settings-notice')?.textContent.includes('设置已保存'));
  await waitApplied({ theme: 'simple', weight: 700 });
  assert.equal(await app.evaluate(({ webContents }) => webContents.getAllWebContents().find((c) => c.getURL().startsWith('https://album-circle.vercel.app')).getZoomFactor()), 1.15);
  assert.equal(await site.evaluate(() => document.documentElement.dataset.desktopReduceMotion), 'true');
  await host.getByRole('button', { name: '查看字体授权协议' }).click();
  await host.waitForFunction(() => document.querySelector('#license-text')?.textContent.includes('HarmonyOS Sans Fonts License Agreement'));
  await host.screenshot({ path: path.join(output, 'settings-panel.png'), fullPage: true });
  report.checks.push({ name: 'settings-entry-simple-theme-weight-scale-motion-and-license', passed: true, installedFonts: systemFonts.length });
  const localFont = systemFonts.find((name) => name === 'Microsoft YaHei') || systemFonts.find((name) => name === 'Arial') || systemFonts[0];
  await host.locator('#font').selectOption(localFont); await host.getByRole('button', { name: '保存设置', exact: true }).click();
  await site.waitForFunction((font) => getComputedStyle(document.body).fontFamily.startsWith(`"${font}"`) || getComputedStyle(document.body).fontFamily.startsWith(font), localFont);
  report.checks.push({ name: 'installed-local-font-selection', passed: true, font: localFont });
  await host.getByRole('button', { name: '完成', exact: true }).click();
  await host.locator('#settings-panel').waitFor({ state: 'hidden' });
  assert.deepEqual(await site.evaluate(() => ({ bridge: typeof window.albumDesktop, require: typeof require, process: typeof process })), { bridge: 'undefined', require: 'undefined', process: 'undefined' });
  await app.close(); app = null; await launch();
  await waitApplied({ theme: 'simple', weight: 700 });
  const saved = JSON.parse(fs.readFileSync(path.join(profile, 'settings.json')));
  assert.equal(saved.font, localFont); assert.equal(saved.zoom, 115); assert.equal(saved.reduceMotion, true);
  report.checks.push({ name: 'settings-persist-after-restart-and-business-view-remains-isolated', passed: true, saved });
  await site.getByRole('button', { name: '软件设置', exact: true }).click();
  await host.getByRole('button', { name: '恢复默认' }).click();
  await waitApplied({ theme: 'cover', weight: 400 });
  await host.getByRole('button', { name: '适配当前显示器' }).click();
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()), true);
  await host.keyboard.press('Escape'); await host.locator('#settings-panel').waitFor({ state: 'hidden' });
  report.checks.push({ name: 'restore-defaults-fit-display-and-escape-settings', passed: true });
  report.passed = true;
})().catch((error) => { report.error = error.stack; report.passed = false; process.exitCode = 1; }).finally(async () => {
  if (!report.passed && host && !host.isClosed()) await host.screenshot({ path: path.join(output, 'settings-failure.png') }).catch(() => {});
  if (app) await app.close().catch(() => {});
  report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(output, 'settings-ui-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});
