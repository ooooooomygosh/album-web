'use strict';
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { useWarmCabin } = require('./ui-fixture.cjs');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'album-client-ui-'));
const output = path.join(__dirname, '../test-results/client'); fs.mkdirSync(output, { recursive: true });
const report = { checks: [], pageErrors: [] }; let application, site;
async function launch() {
  const env = { ...process.env, ALBUM_DESKTOP_TEST_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({ ...(process.env.ALBUM_QA_EXE ? { executablePath: path.resolve(process.env.ALBUM_QA_EXE), args: [] } : { args: [path.join(__dirname, '..')] }), env });
  await application.firstWindow();
  await application.evaluate(async ({ webContents }) => { const started = Date.now(); while (!webContents.getAllWebContents().some((contents) => contents.getURL().startsWith('https://album-circle.vercel.app'))) { if (Date.now() - started > 30000) throw new Error('Site view did not open'); await new Promise((resolve) => setTimeout(resolve, 100)); } });
  site = await application.waitForEvent('window', { predicate: (page) => page.url().startsWith('https://album-circle.vercel.app'), timeout: 5000 }).catch(() => application.windows().find((page) => page.url().startsWith('https://album-circle.vercel.app')));
  assert.ok(site); site.on('pageerror', (error) => report.pageErrors.push(error.message));
  await site.getByRole('button', { name: '收藏与分享', exact: true }).waitFor({ timeout: 30000 });
  await application.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.unmaximize(); window.setSize(1024, 768); });
  await site.waitForFunction(() => innerWidth <= 1100);
}
const check = (value) => report.checks.push(value);
(async () => {
  await launch();
  assert.equal(await site.locator('input[type=email]').count(), 0); check('offline-start-without-account');
  // A fresh install opens in the cabin; this flow starts from the original showroom.
  await site.getByRole('button', { name: '软件设置', exact: true }).first().click();
  const settingsShell = application.windows().find((page) => page.url().startsWith('album-desktop://shell'));
  assert.equal(await settingsShell.locator('#showroom').inputValue(), 'room'); check('cabin-is-the-default-showroom');
  await settingsShell.locator('#showroom').selectOption('original'); await settingsShell.getByRole('button', { name: '完成', exact: true }).click();
  await site.getByRole('button', { name: '收藏与分享', exact: true }).click();
  await site.getByRole('textbox', { name: '本地专辑名', exact: true }).fill('本地验证专辑');
  await site.getByRole('textbox', { name: '本地歌手', exact: true }).fill('离线歌手');
  await site.getByRole('textbox', { name: '本地曲目', exact: true }).fill('第一首\n第二首');
  await site.getByRole('button', { name: '保存到本地', exact: true }).click();
  await site.getByText('专辑已保存到本地。', { exact: true }).waitFor();
  await site.getByRole('button', { name: '关闭收藏与分享', exact: true }).click();
  await site.locator('.cabinet-tile').first().waitFor(); check('manual-album-persists-locally');
  await site.getByRole('button', { name: '自定义唱片', exact: true }).first().click();
  await site.getByLabel('黑胶底色', { exact: true }).fill('#aabbcc');
  await site.getByRole('button', { name: '保存唱片设置', exact: true }).click(); check('vinyl-customization');
  await site.getByRole('button', { name: '软件设置', exact: true }).first().click();
  const shell = application.windows().find((page) => page.url().startsWith('album-desktop://shell'));
  await shell.locator('#showroom').selectOption('room'); await shell.getByRole('button', { name: '完成', exact: true }).click();
  await useWarmCabin(site); await site.locator('.cabin-warm').waitFor();
  await site.getByRole('button', { name: '切换像素风格', exact: true }).click();
  await site.locator('.cabin-pixel').waitFor();
  await site.locator('.room-record').first().dblclick();
  await site.waitForFunction(() => document.querySelector('.room-turntable')?.dataset.spinning === 'true'); check('cabin-pixel-and-turntable');
  if (process.env.ALBUM_QA_SKIP_WALLPAPER !== '1') {
  await site.getByRole('button', { name: '设为桌面动态背景', exact: true }).click();
  await site.getByRole('button', { name: '停止桌面动态背景', exact: true }).waitFor({ timeout: 20000 });
  await site.getByRole('button', { name: '停止桌面动态背景', exact: true }).click(); check('native-desktop-wallpaper');
  } else check('desktop-wallpaper-not-tested-on-hosted-runner');
  await site.screenshot({ path: path.join(output, 'cabin.png') });
  await application.close(); application = null;
  await launch(); await site.locator('.cabin-pixel').waitFor();
  assert.ok(fs.readFileSync(path.join(profile, 'local/collection.json'), 'utf8').includes('本地验证专辑')); check('collection-and-style-survive-restart');
  const snapshot = await site.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('album-circle-session'));
    const data = await (await fetch('/api/items?roomId=local-room', { headers: { Authorization: 'Bearer ' + session.token } })).json();
    const library = JSON.parse(localStorage.getItem('album-circle-library-v1-' + session.user.id));
    return { name: '朋友的展柜', roomId: 'shared', items: data.items, library: { ...library, rooms: { shared: library.rooms['local-room'] } }, appearance: { showroom: 'original', reduceMotion: true } };
  });
  await application.evaluate(async ({ app, webContents }, snapshot) => {
    const require = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main.cjs'), path = require('node:path');
    const session = webContents.getAllWebContents().find((contents) => contents.getURL().startsWith('https://album-circle.vercel.app')).session;
    const localAPI = require(path.join(app.getAppPath(), 'local-api.cjs')).createLocalAPI(path.join(app.getPath('userData'), 'local'));
    const router = require(path.join(app.getAppPath(), 'site-router.cjs')).createSiteRouter({ webRoot: path.join(app.getAppPath(), 'web'), localAPI, getAppearance: () => ({ connectionMode: 'local', showroom: 'original' }), qq: {}, forward: async () => new Response('Test blocks cloud calls', { status: 503 }) });
    session.protocol.unhandle('https'); session.protocol.handle('https', (request) => new URL(request.url).pathname === '/api/shared' ? Response.json({ snapshot }) : router(request));
  }, snapshot);
  await site.goto('https://album-circle.vercel.app/?share=' + 'a'.repeat(32));
  await site.locator('.shared-album-grid button').first().waitFor();
  await site.getByLabel('展柜风格', { exact: true }).selectOption('room');
  await site.locator('.cabin-pixel').waitFor(); assert.equal(await site.locator('.record-tools-button').count(), 0);
  await site.getByLabel('展柜风格', { exact: true }).selectOption('coverflow'); await site.locator('.flow-card').first().waitFor();
  check('shared-viewer-has-three-styles-and-no-edit-controls');
  assert.equal(report.pageErrors.length, 0, JSON.stringify(report.pageErrors)); report.passed = true;
})().catch((error) => { report.error = error.stack; report.passed = false; process.exitCode = 1; }).finally(async () => {
  if (!report.passed && site && !site.isClosed()) await site.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  if (application) await application.close().catch(() => {});
  fs.rmSync(profile, { recursive: true, force: true });
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
});
