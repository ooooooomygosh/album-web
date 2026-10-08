'use strict';
const { _electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const desktop = path.resolve(__dirname, '..');
const output = path.join(desktop, 'test-results');
const env = { ...process.env, ALBUM_DESKTOP_TEST_PROFILE: path.join(output, 'search-ui-profile') };
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.ALBUM_QA_EXE || path.join(desktop, 'node_modules/electron/dist/electron.exe');
const report = { executablePath, startedAt: new Date().toISOString(), accountAndRoomResponsesMocked: true, musicMetadataUsesLiveQQ: true, productionWrites: 0, checks: [] };
let app;
let activeSite;
(async () => {
  app = await _electron.launch({ executablePath, args: process.env.ALBUM_QA_EXE ? [] : [desktop], env });
  await app.firstWindow();
  let site;
  for (let attempt = 0; attempt < 100; attempt++) {
    site = app.context().pages().find((page) => page.url().startsWith('https://album-circle.vercel.app'));
    if (site) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(site);
  activeSite = site;
  const user = { id: 'desktop-qa-only', name: '本机界面测试', avatar: '♪', settings: {} };
  const room = { id: 'desktop-qa-room', name: '搜索验证房间', ownerId: user.id, members: { [user.id]: true }, memberProfiles: { [user.id]: user } };
  // The custom protocol routes outside CDP network interception. Replace only
  // account/room replies in the isolated test process; reuse the production router and QQ client.
  await app.evaluate(({ app, net, webContents }, { user, room }) => {
    const require = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main.cjs');
    const path = require('node:path');
    const { createSiteRouter } = require(path.join(app.getAppPath(), 'site-router.cjs'));
    const { createQQMusic } = require(path.join(app.getAppPath(), 'qq-music.cjs'));
    const session = webContents.getAllWebContents().find((contents) => contents.getURL().startsWith('https://album-circle.vercel.app')).session;
    globalThis.__qaQQDiagnostics = [];
    const router = createSiteRouter({ webRoot: path.join(app.getAppPath(), 'web'), forward: (request) => session.fetch(request, { bypassCustomProtocolHandlers: true }), qq: createQQMusic(async (url, options) => {
      const response = await net.fetch(url, { ...options, bypassCustomProtocolHandlers: true });
      if (url.includes('/musicu.fcg')) {
        const body = await response.clone().json();
        const payload = JSON.parse(options.body || new URL(url).searchParams.get('data'));
        const module = Object.keys(payload)[0];
        globalThis.__qaQQDiagnostics.push({ method: payload[module].method, searchType: payload[module].param.search_type, code: body.code, partCode: body[module]?.code, keys: Object.keys(body), hasData: Boolean(body[module]?.data) });
      }
      return response;
    }) });
    globalThis.__qaSearchRequests = []; globalThis.__qaBlockedWrites = 0;
    session.protocol.unhandle('https');
    session.protocol.handle('https', async (request) => {
      const url = new URL(request.url);
      if (url.origin === 'https://album-circle.vercel.app' && url.pathname.startsWith('/api/')) {
        if (request.method !== 'GET') { globalThis.__qaBlockedWrites += 1; return Response.json({ error: 'Test disallows all writes' }, { status: 405 }); }
        if (url.pathname === '/api/search') {
          globalThis.__qaSearchRequests.push(request.url);
          if (globalThis.__qaForceError) return Response.json({ error: 'QQ 音乐暂时无法访问，请重试。' }, { status: 502 });
          return router(request);
        }
        if (url.pathname === '/api/resolve-link') return router(request);
        return Response.json(url.pathname === '/api/auth' ? { user } : { room, rooms: [room], items: [], comments: [], ratings: [] });
      }
      return router(request);
    });
  }, { user, room });
  const lastSearch = async () => new URL(await app.evaluate(() => globalThis.__qaSearchRequests.at(-1)));
  await site.evaluate(({ user, room }) => {
    localStorage.setItem('album-circle-session', JSON.stringify({ token: 'desktop-qa-invalid-token', user }));
    history.replaceState(null, '', '/?room=' + room.id);
  }, { user, room });
  await site.reload();
  const query = site.getByRole('searchbox', { name: '快速搜索专辑或歌曲' });
  await query.waitFor({ state: 'visible', timeout: 20000 });
  const source = site.getByRole('combobox', { name: '搜索来源', exact: true });
  const albumUrl = process.env.ALBUM_QA_QQ_LINK || 'https://y.qq.com/n/ryqq/albumDetail/000MkMni19ClKG';
  async function search(text) {
    await query.fill(text);
    await query.press('Enter');
    await site.waitForFunction(() => /找到|搜索失败/.test(document.querySelector('.search-live-status')?.textContent || ''), null, { timeout: 90000 });
    assert.ok(!(await site.locator('.search-live-status').innerText()).includes('搜索失败'), await site.locator('.search-live-status').innerText());
    assert.ok(await site.locator('.global-candidate').count());
  }
  await search('叶惠美');
  assert.equal(await source.inputValue(), 'qq');
  const leaf = site.locator('.global-candidate').filter({ hasText: '叶惠美' }).filter({ hasText: '周杰伦' }).first();
  await leaf.click();
  assert.ok((await site.locator('.global-confirm').innerText()).includes('11 首曲目'));
  await site.locator('.global-confirm img').waitFor({ state: 'visible' });
  await site.waitForFunction(() => { const image = document.querySelector('.global-confirm img'); return image?.complete && image.naturalWidth > 0; });
  report.checks.push({ name: 'album-name-search-live-qq-cover-and-tracks', passed: true });
  await search('周杰伦');
  assert.equal((await lastSearch()).searchParams.get('term'), '周杰伦');
  assert.equal((await lastSearch()).searchParams.get('link'), '');
  report.checks.push({ name: 'artist-name-search-no-link-required', passed: true });
  const share = site.locator('input[name="global-share-link"]');
  await share.fill('周杰伦'); await share.press('Enter');
  await site.waitForFunction(() => document.querySelector('.search-live-status')?.textContent.includes('找到'), null, { timeout: 90000 });
  assert.equal(await share.evaluate((input) => input.validity.valid), true);
  report.checks.push({ name: 'share-field-plain-text-no-url-validation-error', passed: true });
  await source.selectOption('itunes');
  await search(albumUrl);
  assert.equal(await source.inputValue(), 'qq');
  assert.equal(await site.locator('.global-candidate').count(), 1);
  assert.ok((await site.locator('.global-candidate').innerText()).includes('链接精确定位'));
  report.checks.push({ name: 'qq-link-overrides-itunes-and-returns-one-exact-album', passed: true, link: albumUrl });
  await search('叶惠美');
  assert.equal((await lastSearch()).searchParams.get('link'), '');
  report.checks.push({ name: 'name-search-after-link-discards-stale-link', passed: true });
  await site.screenshot({ path: path.join(output, 'search-qq.png') });
  await app.evaluate(() => { globalThis.__qaForceError = true; });
  await query.fill('测试连接失败'); await query.press('Enter');
  await site.waitForFunction(() => document.querySelector('.search-live-status')?.textContent.includes('搜索失败'));
  assert.equal(await site.locator('.global-candidate').count(), 0);
  report.checks.push({ name: 'failed-search-clears-old-results', passed: true });
  assert.equal(await app.evaluate(() => globalThis.__qaBlockedWrites), 0);
  await site.evaluate(() => localStorage.removeItem('album-circle-session'));
  report.passed = true;
})().catch((error) => { report.error = error.stack; report.passed = false; process.exitCode = 1; }).finally(async () => {
  if (!report.passed && activeSite && !activeSite.isClosed()) report.failurePage = (await activeSite.locator('body').innerText()).slice(0, 1500);
  if (!report.passed && app) report.qqDiagnostics = await app.evaluate(() => globalThis.__qaQQDiagnostics).catch(() => []);
  if (app) await app.close().catch(() => {});
  fs.mkdirSync(output, { recursive: true });
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'search-ui-report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2));
});
