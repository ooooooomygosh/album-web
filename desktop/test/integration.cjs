'use strict';
const { _electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const appPath = path.resolve(__dirname, '..');
const output = path.resolve(appPath, 'test-results');
const profile = path.resolve(output, 'profile');
fs.mkdirSync(output, { recursive: true });
const executablePath = process.env.ALBUM_QA_EXE || path.join(appPath, 'node_modules/electron/dist/electron.exe');
const env = { ...process.env, ALBUM_DESKTOP_TEST_PROFILE: profile };
delete env.ELECTRON_RUN_AS_NODE;
const report = { startedAt: new Date().toISOString(), executablePath, checks: [] };
let application;
let previousClipboard;

async function launch() {
  const instance = await _electron.launch({ executablePath, args: process.env.ALBUM_QA_EXE ? [] : [appPath], env, timeout: 30000 });
  instance.process().stderr?.on('data', (chunk) => fs.appendFileSync(path.join(output, 'electron-stderr.log'), chunk));
  instance.on('window', (page) => page.on('pageerror', (error) => report.checks.push({ pageError: error.message, url: page.url() })));
  await instance.firstWindow();
  const start = Date.now();
  while (Date.now() - start < 60000) {
    const pages = instance.context().pages();
    const host = pages.find((page) => page.url() === 'album-desktop://shell/index.html');
    const site = pages.find((page) => page.url().startsWith('https://album-circle.vercel.app'));
    if (host && site) { await host.waitForLoadState('domcontentloaded'); await site.waitForLoadState('domcontentloaded'); return { instance, host, site }; }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('The original website did not appear in the desktop view');
}

async function screenshot(instance, name) {
  const png = await instance.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1600, height: 1100 } });
    const source = sources.find((item) => item.id === window.getMediaSourceId());
    if (!source) throw new Error('Cannot capture the application window');
    return source.thumbnail.toPNG().toString('base64');
  });
  fs.writeFileSync(path.join(output, name), Buffer.from(png, 'base64'));
}

(async () => {
  let run = await launch(); application = run.instance;
  await run.site.waitForSelector('#root', { state: 'attached' });
  await run.site.waitForFunction(() => document.querySelector('#root')?.textContent.length > 80, null, { timeout: 40000 });
  await run.host.waitForFunction(() => document.querySelector('#status')?.textContent === '界面就绪');
  report.checks.push({ name: 'original-site-loaded', passed: true, title: await run.site.title(), bodySample: (await run.site.locator('body').innerText()).slice(0, 500) });
  for (const page of [run.site, run.host]) {
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setFullScreen(true));
    await page.waitForTimeout(300);
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()), true);
    if (page === run.site) await page.locator('input').first().focus();
    else await page.evaluate(() => { document.body.tabIndex = 0; document.body.focus(); });
    await application.evaluate(({ webContents }, url) => {
      const contents = webContents.getAllWebContents().find((item) => item.getURL() === url);
      contents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      contents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    }, page.url());
    await page.waitForTimeout(300);
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()), false);
  }
  report.checks.push({ name: 'escape-exits-fullscreen-in-both-views', passed: true });
  const isolation = await run.site.evaluate(() => ({ require: typeof require, process: typeof process, bridge: typeof window.albumDesktop }));
  assert.deepEqual(isolation, { require: 'undefined', process: 'undefined', bridge: 'undefined' });
  report.checks.push({ name: 'remote-view-isolated', passed: true, ...isolation });
  await application.evaluate(({ webContents }) => { globalThis.__qaRemoteId = webContents.getAllWebContents().find((contents) => contents.getURL().startsWith('https://album-circle.vercel.app')).id; });
  await run.site.evaluate(() => localStorage.setItem('__album-desktop-qa', 'persisted'));
  previousClipboard = await application.evaluate(({ clipboard }) => clipboard.readText());
  await run.host.evaluate(() => window.albumDesktop.command('copy'));
  const link = await application.evaluate(({ clipboard }) => clipboard.readText());
  assert.ok(link.startsWith('https://album-circle.vercel.app/'));
  await application.evaluate(({ clipboard }, previous) => clipboard.writeText(previous), previousClipboard);
  previousClipboard = undefined;
  report.checks.push({ name: 'copy-original-link', passed: true });
  await run.host.waitForFunction(() => document.querySelector('#copy')?.textContent === '已复制');
  await application.evaluate(({ Menu }) => {
    globalThis.__qaOriginalPopup = Menu.prototype.popup;
    Menu.prototype.popup = function(options) {
      globalThis.__qaToolbarMenu = this.items.map((item) => item.label);
      const result = globalThis.__qaOriginalPopup.call(this, options);
      setTimeout(() => this.closePopup(options.window), 250);
      return result;
    };
  });
  await run.host.evaluate(() => window.albumDesktop.command('menu'));
  await run.host.waitForTimeout(400);
  const menuLabels = await application.evaluate(({ Menu }) => {
    Menu.prototype.popup = globalThis.__qaOriginalPopup;
    return globalThis.__qaToolbarMenu;
  });
  assert.ok(menuLabels.includes('清除本机登录'));
  assert.ok(menuLabels.includes('打开日志目录'));
  report.checks.push({ name: 'native-toolbar-menu-and-copy-feedback', passed: true });
  await screenshot(application, 'desktop-online.png');
  // No production account is created and no original album or room is changed.
  const metadata = await run.site.evaluate(async () => {
    const response = await fetch('/api/search?term=Wish%20You%20Were%20Here&type=album');
    const data = await response.json();
    const album = data.candidates?.find((item) => item.artist === 'Pink Floyd');
    return { status: response.status, title: album?.title, artist: album?.artist, cover: album?.cover, tracks: album?.tracks, source: album?.source };
  });
  assert.equal(metadata.status, 200); assert.equal(metadata.artist, 'Pink Floyd');
  assert.ok(metadata.cover?.startsWith('https://')); assert.ok(metadata.tracks?.length >= 5);
  report.checks.push({ name: 'original-api-cover-and-tracks', passed: true, ...metadata });
  const qqMetadata = await run.site.evaluate(async () => {
    const response = await fetch('/api/search?provider=qq&type=album&term=' + encodeURIComponent('https://y.qq.com/n/ryqq/albumDetail/000MkMni19ClKG'));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const album = data.candidates[0];
    return { title: album.title, artist: album.artist, id: album.externalId, cover: album.cover, tracks: album.tracks, source: album.source };
  });
  assert.equal(qqMetadata.id, '000MkMni19ClKG');
  assert.equal(qqMetadata.title, '叶惠美'); assert.equal(qqMetadata.artist, '周杰伦');
  assert.equal(qqMetadata.tracks.length, 11); assert.equal(qqMetadata.tracks[0], '以父之名');
  assert.ok(qqMetadata.cover.startsWith('https://y.gtimg.cn/'));
  report.checks.push({ name: 'qq-link-exact-album-cover-and-tracks', passed: true, ...qqMetadata });
  const qqName = await run.site.evaluate(async () => {
    const response = await fetch('/api/search?provider=qq&type=album&term=' + encodeURIComponent('叶惠美'));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const album = data.candidates.find((item) => item.externalId === '000MkMni19ClKG');
    return { title: album?.title, artist: album?.artist, source: album?.source, trackCount: album?.tracks.length };
  });
  assert.equal(qqName.title, '叶惠美'); assert.equal(qqName.artist, '周杰伦'); assert.equal(qqName.trackCount, 11);
  report.checks.push({ name: 'qq-name-search-native-handler', passed: true, ...qqName });
  await application.evaluate(({ shell }) => { globalThis.__qaExternalLinks = []; shell.openExternal = async (url) => { globalThis.__qaExternalLinks.push(url); }; });
  await run.site.evaluate(() => window.open('https://music.apple.com/', '_blank'));
  await run.site.waitForTimeout(200);
  const links = await application.evaluate(() => globalThis.__qaExternalLinks);
  assert.deepEqual(links, ['https://music.apple.com/']);
  assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  report.checks.push({ name: 'external-links-no-privileged-window', passed: true });
  const requestFilter = { urls: ['https://album-circle.vercel.app/*'] };
  await application.evaluate(({ webContents }, filter) => {
    webContents.getAllWebContents().find((contents) => contents.getURL().startsWith('https://album-circle.vercel.app')).session.webRequest.onBeforeRequest(filter, (_details, callback) => callback({ cancel: true }));
  }, requestFilter);
  await run.host.evaluate(() => window.albumDesktop.command('retry'));
  await run.host.getByRole('button', { name: '重新连接', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  assert.equal(await run.host.locator('#status').innerText(), '连接中断');
  await screenshot(application, 'desktop-network-error.png');
  report.checks.push({ name: 'recoverable-network-error', passed: true });
  await application.evaluate(({ webContents }) => {
    const view = webContents.fromId(globalThis.__qaRemoteId);
    view.session.webRequest.onBeforeRequest(null);
  });
  await run.host.getByRole('button', { name: '重新连接', exact: true }).click();
  await run.host.waitForFunction(() => document.querySelector('#status')?.textContent === '界面就绪', null, { timeout: 45000 });
  report.checks.push({ name: 'network-retry-restores-site', passed: true });
  await application.close(); application = null;
  run = await launch(); application = run.instance;
  const stored = await run.site.evaluate(() => localStorage.getItem('__album-desktop-qa'));
  assert.equal(stored, 'persisted');
  await run.site.evaluate(() => localStorage.removeItem('__album-desktop-qa'));
  report.checks.push({ name: 'same-profile-persists-across-restart', passed: true });
  await application.close(); application = null;
  report.passed = true;
})().catch((error) => { report.passed = false; report.error = error.stack; process.exitCode = 1; }).finally(async () => {
  if (application) await application.close().catch(() => {});
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'integration-report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2));
});
