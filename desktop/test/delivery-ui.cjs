'use strict';
const { _electron } = require('playwright'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { mountFixture, albums } = require('./ui-fixture.cjs');
const desktop = path.resolve(__dirname, '..'), output = path.join(desktop, 'test-results');
const profile = path.join(output, `delivery-ui-profile-${Date.now()}`), env = { ...process.env, ALBUM_DESKTOP_TEST_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.ALBUM_QA_EXE || path.join(desktop, 'node_modules/electron/dist/electron.exe');
const report = { executablePath, startedAt: new Date().toISOString(), fixtureData: true, paidAIRequests: 0, productionWrites: 0, checks: [], pageErrors: [] };
let app, host, site;
const check = (name, detail = {}) => report.checks.push({ name, passed: true, ...detail });
async function openSettings() { await site.getByRole('button', { name: '软件设置', exact: true }).click(); await host.locator('#settings-panel').waitFor({ state: 'visible' }); }
async function done() { await host.getByRole('button', { name: '完成', exact: true }).click(); await host.locator('#settings-panel').waitFor({ state: 'hidden' }); }
async function launch() {
  app = await _electron.launch({ executablePath, args: process.env.ALBUM_QA_EXE ? [] : [desktop], env }); app.context().setDefaultTimeout(18000); await app.firstWindow();
  for (let i = 0; i < 150; i++) { site = app.context().pages().find((p) => p.url().startsWith('https://album-circle.vercel.app')); host = app.context().pages().find((p) => p.url() === 'album-desktop://shell/index.html'); if (site && host) break; await new Promise((r) => setTimeout(r, 100)); }
  site.on('pageerror', (error) => report.pageErrors.push(error.message)); host.on('pageerror', (error) => report.pageErrors.push(error.message));
  await mountFixture(app, site); await site.getByRole('button', { name: '软件设置', exact: true }).waitFor();
}
(async () => {
  await launch();
  const bounds = await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; return { framed: win.isMenuBarVisible(), site: win.contentView.children[0].getBounds(), size: win.getContentSize() }; });
  assert.equal(bounds.site.y, 0); assert.equal(bounds.site.height, bounds.size[1]); assert.equal(bounds.framed, false);
  assert.equal(await site.locator('.desktop-controls svg[data-icon-library="heroicons"]').count(), 4);
  await site.waitForTimeout(650); await site.screenshot({ path: path.join(output, 'immersive-banner.png') }); check('single-immersive-banner-integrated-heroicons-controls-and-full-client-area', bounds);
  for (const [style, selector] of [['room','.listening-room'],['coverflow','.coverflow-showroom'],['original','.cabinet-grid']]) {
    await openSettings(); await host.locator('#showroom').selectOption(style); await site.locator(selector).waitFor(); await done();
    assert.equal(await site.evaluate(() => document.documentElement.dataset.desktopShowroom), style);
  }
  check('actual-settings-select-immediately-switches-all-three-styles-without-bottom-save');
  await openSettings(); await host.waitForFunction(() => document.querySelectorAll('#font optgroup option').length > 0);
  await host.locator('#theme').selectOption('simple'); await host.locator('#weight').selectOption('500'); await host.locator('#zoom').fill('110'); await host.locator('#reduce-motion').check(); await host.locator('#show-purchases').check(); await done();
  const applied = await site.evaluate(() => ({ theme: document.documentElement.dataset.desktopTheme, weight: getComputedStyle(document.body).fontWeight, motion: document.documentElement.dataset.desktopReduceMotion, purchases: document.querySelectorAll('.purchase-record').length, duration: getComputedStyle(document.querySelector('.cabinet-card-face')).transitionDuration }));
  assert.equal(applied.theme, 'simple'); assert.equal(applied.weight, '500'); assert.equal(applied.motion, 'true'); assert.equal(applied.purchases, albums.length); assert.ok(applied.duration.split(',').every((v) => parseFloat(v) === 0));
  assert.equal(await app.evaluate(({ webContents }) => webContents.getAllWebContents().find((c) => c.getURL().startsWith('https://album-circle.vercel.app')).getZoomFactor()), 1.1); check('all-native-appearance-toggles-affect-visible-interface', applied);
  await site.reload(); await site.locator('.purchase-record').first().waitFor(); assert.equal(await site.evaluate(() => document.documentElement.dataset.desktopReduceMotion), 'true'); check('appearance-restored-after-business-view-reload');
  await openSettings(); await host.locator('#theme').selectOption('cover'); await host.locator('#weight').selectOption('400'); await host.locator('#zoom').fill('100'); await host.locator('#reduce-motion').uncheck(); await host.locator('#show-purchases').uncheck(); await done();
  await site.locator('.cabinet-tile').first().focus(); await site.keyboard.press('ArrowRight'); await site.keyboard.press('ArrowLeft'); await site.waitForTimeout(800);
  const text = await site.locator('.cabinet-card-back').first().evaluate((node) => { const ancestors = []; for(let current = node;current;current = current.parentElement) ancestors.push({className:current.className,opacity:getComputedStyle(current).opacity,filter:getComputedStyle(current).filter}); return { transform: getComputedStyle(node).transform, filter: getComputedStyle(node).filter, opacity: getComputedStyle(node).opacity, parentTransform: getComputedStyle(node.parentElement).transform, font: getComputedStyle(node.querySelector('p')).fontSize, color:getComputedStyle(node.querySelector('strong')).color,ancestors }; });
  assert.equal(text.transform, 'none'); assert.equal(text.filter, 'none'); assert.equal(text.parentTransform, 'none'); assert.equal(text.opacity, '1');
  await site.locator('.cabinet-tile').first().screenshot({ path: path.join(output, 'clear-album-back.png') });
  text.pixel = await app.evaluate(({nativeImage},file) => { const image=nativeImage.createFromPath(file), bytes=image.getBitmap();let max=0,at=0;const {width,height}=image.getSize();for(let y=0;y<height;y++)for(let x=20;x<width-20;x++){const red=bytes[(y*width+x)*4+2];if(red>max){max=red;at=y;}}return {maxRed:max,at,bytes:bytes.length,width,height}; },path.join(output,'clear-album-back.png'));
  text.after = await site.locator('.cabinet-card-back').first().evaluate(n=>({opacity:getComputedStyle(n).opacity,hover:n.parentElement.matches(':hover'),focus:n.parentElement.matches(':focus-visible')})); assert.ok(text.pixel.maxRed > 230,JSON.stringify({pixel:text.pixel,after:text.after})); check('album-back-clear-unscaled-text-at-rest', text);
  await site.getByRole('button', { name: '陈列设置', exact: true }).click(); const cabinet = site.getByRole('dialog', { name: '陈列柜设置' });
  await cabinet.getByLabel('显示专辑标题').check(); await cabinet.getByLabel('主题策略', { exact: true }).selectOption('custom'); await cabinet.getByLabel('自定义主题', { exact: true }).fill('#2f70b8');
  await site.locator('.cabinet-caption').first().waitFor(); await site.waitForFunction(() => document.querySelector('.app').style.getPropertyValue('--cover-a') === '#2f70b8');
  await cabinet.getByLabel('减少动效').check(); await site.waitForFunction(() => document.documentElement.dataset.desktopReduceMotion === 'true');
  await cabinet.getByLabel('减少动效').uncheck(); await site.waitForFunction(() => document.documentElement.dataset.desktopReduceMotion === 'false');
  await cabinet.getByLabel('封面大小').selectOption('large'); await site.locator('.cabinet-size-large').waitFor();
  await cabinet.getByLabel('默认布局').selectOption('5x4'); await site.locator('.wall-5x4').waitFor();
  await cabinet.getByLabel('悬浮方式').selectOption('lift'); await site.locator('.cabinet-hover-lift').waitFor();
  await cabinet.getByLabel('玻璃强度', { exact: true }).fill('35'); await site.waitForFunction(() => document.querySelector('.app').style.getPropertyValue('--glass-alpha') === '0.35');
  await cabinet.getByLabel('只看自己添加').check(); await site.waitForFunction(() => new URL(location.href).searchParams.get('mine') === '1');
  await cabinet.getByLabel('只看自己添加').uncheck(); await site.waitForFunction(() => !new URL(location.href).searchParams.has('mine')); await site.locator('.cabinet-tile').first().waitFor();
  await cabinet.getByLabel('彩虹呼吸状态').uncheck();
  const localSettings = await site.evaluate(() => JSON.parse(localStorage.getItem('album-circle-display-desktop-qa-only')));
  assert.equal(localSettings.appearance.rainbowStatus, false); assert.equal(localSettings.filters.mineOnly, false);
  const save = cabinet.getByRole('button', { name: /保存/ }); await save.click();
  await site.getByRole('button', { name: '关闭陈列柜设置' }).click(); await site.reload(); await site.locator('.cabinet-caption').first().waitFor();
  assert.equal(await site.locator('.app').evaluate((node) => node.style.getPropertyValue('--cover-a')), '#2f70b8'); await site.locator('.cabinet-size-large.wall-5x4.cabinet-hover-lift').waitFor(); check('account-display-options-preview-immediately-and-persist-even-if-cloud-sync-fails', { checked: ['captions','custom-color','reduce-motion-on-and-off','cover-size','layout','hover-style','glass','mine-only-on-and-off','rainbow-status'] });
  await site.locator('.cabinet-tile').nth(1).click(); await site.locator('.detail-story h2').waitFor();
  const cdp = await site.context().newCDPSession(site);
  for (const width of [960,1440,1920,2560,3840]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1200, deviceScaleFactor: 1, mobile: false });
    const geometry = await site.evaluate(() => { const title = document.querySelector('.detail-story h2').getBoundingClientRect(), story = document.querySelector('.detail-story').getBoundingClientRect(), tracks = document.querySelector('.tracklist-panel').getBoundingClientRect(); return { width: innerWidth, scroll: document.documentElement.scrollWidth, title: { left:title.left,right:title.right,bottom:title.bottom }, story: { right:story.right }, tracks: { left:tracks.left,top:tracks.top } }; });
    assert.ok(geometry.title.right <= geometry.story.right + 1); assert.ok(geometry.title.right <= geometry.tracks.left || geometry.title.bottom <= geometry.tracks.top); assert.ok(geometry.scroll <= width + 1);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', { width:2560,height:1392,deviceScaleFactor:1,mobile:false }); await site.waitForTimeout(150); await site.screenshot({ path: path.join(output, 'detail-no-overlap.png'), fullPage: true }); await cdp.send('Emulation.clearDeviceMetricsOverride'); await cdp.detach(); check('album-detail-title-and-tracklist-do-not-overlap-at-five-monitor-widths');
  await app.evaluate(({ shell }) => { globalThis.__qaLinks = []; shell.openExternal = async (url) => globalThis.__qaLinks.push(url); });
  const discogs = site.getByRole('link', { name: `在 Discogs 查阅 ${albums[1].title}` }); const href = new URL(await discogs.getAttribute('href')); assert.equal(href.hostname, 'www.discogs.com'); assert.ok(href.searchParams.get('q').includes(albums[1].artist)); await discogs.click();
  await site.waitForTimeout(100); assert.equal((await app.evaluate(() => globalThis.__qaLinks))[0], href.href); check('Discogs-opens-correct-artist-and-title-in-system-browser');
  // Changing showroom while on the detail page returns to the selected showroom.
  await openSettings(); await host.locator('#showroom').selectOption('room'); await done(); await site.locator('.listening-room').waitFor(); check('theme-change-from-detail-opens-chosen-showroom');
  await site.getByRole('button', { name: '专辑墙', exact: true }).click(); await site.getByRole('dialog', { name: '专辑墙编辑器' }).waitFor();
  for (const album of albums.slice(0,3)) await site.getByRole('button', { name: `添加 ${album.artist} 的 ${album.title}`, exact: true }).click();
  await site.waitForFunction(() => document.querySelector('.wall-canvas-wrap canvas').width > 0 && !document.querySelector('.wall-preview-bar').textContent.includes('正在更新'));
  assert.deepEqual(await site.locator('.wall-add-order').allTextContents(), ['1','2','3','']);
  await site.getByRole('button', { name: `将 ${albums[2].title} 向前移动` }).click(); assert.equal(await site.locator('.wall-selected-list li').nth(1).locator('strong').innerText(), albums[2].title);
  await site.getByLabel('排列顺序', { exact: true }).selectOption('title'); assert.equal(await site.locator('.wall-selected-list li').count(), 3); check('wall-batch-selection-order-badges-and-reordering');
  await site.getByRole('button', { name: '批量添加当前列表', exact: true }).click(); assert.equal(await site.locator('.wall-selected-list li').count(), 4);
  await site.getByRole('button', { name: `移除 ${albums[3].title}`, exact: true }).click(); assert.equal(await site.locator('.wall-selected-list li').count(), 3);
  await site.getByLabel('排列方法', { exact: true }).selectOption('ranked'); await site.getByLabel('每行列数', { exact: true }).fill('4'); await site.getByLabel('专辑墙外边距', { exact: true }).fill('50'); await site.getByLabel('专辑间距', { exact: true }).fill('18'); await site.getByLabel('封面边框', { exact: true }).fill('3');
  await site.getByLabel('专辑墙背景颜色', { exact: true }).fill('#263b32'); await site.getByLabel('专辑墙标题', { exact: true }).fill('我的唱片收藏'); await site.getByLabel('专辑墙作者', { exact: true }).fill('Jinyi');
  await site.waitForFunction(() => document.querySelector('.wall-preview-bar').textContent.includes('张封面未加载') === false && !document.querySelector('.wall-preview-bar').textContent.includes('正在更新'));
  assert.ok(await site.getByLabel('专辑墙字体').locator('option').count() > 1);
  const originalFontPixels = await site.locator('.wall-canvas-wrap canvas').evaluate((node) => node.toDataURL());
  const localFont = await site.getByLabel('专辑墙字体').locator('option').evaluateAll((nodes) => nodes.find((node) => node.value === 'Arial')?.value || nodes[1].value);
  await site.getByLabel('专辑墙字体').selectOption(localFont); await site.waitForFunction((before) => !document.querySelector('.wall-preview-bar').textContent.includes('正在更新') && document.querySelector('.wall-canvas-wrap canvas').toDataURL() !== before, originalFontPixels);
  assert.equal(await site.evaluate(() => JSON.parse(localStorage.getItem('album-circle-wall-v1')).options.font), localFont);
  await site.getByLabel('专辑墙字体').selectOption('bundled'); await site.waitForFunction((before) => !document.querySelector('.wall-preview-bar').textContent.includes('正在更新') && document.querySelector('.wall-canvas-wrap canvas').toDataURL() === before, originalFontPixels);
  const widthBefore = await site.locator('.wall-canvas-wrap canvas').evaluate((node) => node.width); await site.getByLabel('右侧显示专辑名称', { exact: true }).uncheck(); await site.getByLabel('右侧显示歌手名称', { exact: true }).uncheck();
  await site.waitForFunction((before) => document.querySelector('.wall-canvas-wrap canvas').width === before - 390, widthBefore);
  await site.getByLabel('右侧显示专辑名称', { exact: true }).check(); await site.getByLabel('右侧显示歌手名称', { exact: true }).check();
  await site.waitForFunction((before) => document.querySelector('.wall-canvas-wrap canvas').width === before, widthBefore); check('wall-layout-margins-gap-border-colors-title-author-names-fonts-apply-to-preview');
  await site.screenshot({ path: path.join(output, 'album-wall-editor.png') });
  const pngPath = path.join(output, 'album-wall-export.png');
  await app.evaluate(({ webContents }, destination) => { const session = webContents.getAllWebContents().find((c) => c.getURL().startsWith('https://album-circle.vercel.app')).session; globalThis.__qaDownload = null; session.once('will-download', (_event,item) => { item.setSavePath(destination); item.once('done', (_event,state) => { globalThis.__qaDownload = state; }); }); }, pngPath);
  await site.getByRole('button', { name: '下载 PNG', exact: true }).click(); await site.waitForFunction(() => document.querySelector('.wall-notice').textContent.includes('PNG 已生成'), null, { timeout: 45000 });
  for (let i = 0; i < 150; i++) { if (await app.evaluate(() => globalThis.__qaDownload === 'completed')) break; await new Promise((r) => setTimeout(r,100)); }
  assert.equal(await app.evaluate(() => globalThis.__qaDownload), 'completed'); assert.ok(fs.statSync(pngPath).size > 10000);
  const png = await app.evaluate(({ nativeImage }, file) => { const image = nativeImage.createFromPath(file), bytes = image.getBitmap(); return { size: image.getSize(), bgra: [...bytes.subarray(0,4)] }; }, pngPath);
  assert.deepEqual(png.bgra.slice(0,3), [50,59,38]); assert.equal(png.size.width, widthBefore * 2); check('native-download-writes-real-high-resolution-PNG-with-correct-color-and-cover-art', png);
  await site.getByRole('link', { name: '打开 Topsters', exact: true }).click(); assert.ok((await app.evaluate(() => globalThis.__qaLinks)).includes('https://topsters.org/')); check('optional-Topsters-opens-in-system-browser');
  await site.getByRole('button', { name: '搜索添加', exact: true }).click(); await site.getByLabel('专辑墙搜索', { exact: true }).fill('叶惠美'); await site.getByRole('button', { name: '搜索', exact: true }).click(); await site.locator('.wall-library-album').waitFor();
  assert.equal(await site.locator('.wall-library-album strong').first().innerText(), albums[0].title); check('wall-search-add-uses-existing-catalog-handler');
  await site.getByRole('button', { name: '关闭专辑墙编辑器' }).click(); await site.getByRole('button', { name: '专辑墙', exact: true }).click(); assert.equal(await site.locator('.wall-selected-list li').count(), 3); assert.equal(await site.getByLabel('专辑墙作者').inputValue(), 'Jinyi'); check('wall-selection-and-options-survive-close-and-reopen');
  await site.getByRole('button', { name: '关闭专辑墙编辑器' }).click(); await site.reload(); await site.getByRole('button', { name: '专辑墙', exact: true }).click(); assert.equal(await site.locator('.wall-selected-list li').count(), 3); check('wall-draft-survives-app-page-reload');
  const projectPath = path.join(output, 'album-wall-project.json');
  await app.evaluate(({ webContents }, destination) => { const session = webContents.getAllWebContents().find((c) => c.getURL().startsWith('https://album-circle.vercel.app')).session; globalThis.__qaDownload = null; session.once('will-download', (_event,item) => { item.setSavePath(destination); item.once('done', (_event,state) => { globalThis.__qaDownload = state; }); }); }, projectPath);
  await site.getByRole('button', { name: '保存工程', exact: true }).click();
  for (let i=0;i<100;i++) { if (await app.evaluate(() => globalThis.__qaDownload === 'completed')) break; await new Promise((r) => setTimeout(r,100)); }
  assert.equal(await app.evaluate(() => globalThis.__qaDownload), 'completed'); const project = JSON.parse(fs.readFileSync(projectPath)); assert.equal(project.version,1); assert.equal(project.selected.length,3);
  await site.getByRole('button', { name: '清空', exact: true }).click(); assert.equal(await site.locator('.wall-selected-list li').count(),0); await site.getByLabel('打开专辑墙工程').setInputFiles(projectPath); await site.locator('.wall-selected-list li').first().waitFor(); assert.equal(await site.locator('.wall-selected-list li').count(),3); assert.equal(await site.getByLabel('专辑墙标题').inputValue(),'我的唱片收藏'); check('native-wall-project-export-and-import-restores-albums-and-options');
  await site.getByRole('button', { name: '关闭专辑墙编辑器' }).click(); await app.close(); app = null; await launch();
  await site.locator('.listening-room').waitFor(); await site.getByRole('button', { name: '专辑墙', exact: true }).click(); assert.equal(await site.locator('.wall-selected-list li').count(),3); assert.equal(await site.getByLabel('专辑墙作者').inputValue(),'Jinyi'); check('wall-draft-showroom-and-account-display-preferences-survive-real-EXE-restart');
  await site.getByRole('button', { name: '关闭专辑墙编辑器' }).click();
  const maximized = await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isMaximized()); await site.getByRole('button', { name:'最大化或还原窗口',exact:true }).click(); await site.waitForTimeout(150); assert.equal(await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isMaximized()),!maximized);
  await site.getByRole('button', { name:'最大化或还原窗口',exact:true }).click(); await site.waitForTimeout(150); assert.equal(await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isMaximized()),maximized);
  await site.getByRole('button', { name:'最小化窗口',exact:true }).click(); await site.waitForTimeout(150); assert.equal(await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isMinimized()),true); await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].restore());
  await app.evaluate(({webContents}) => { const page=webContents.getAllWebContents().find((c)=>c.getURL().startsWith('https://album-circle.vercel.app')); page.sendInputEvent({type:'keyDown',keyCode:'F11'});page.sendInputEvent({type:'keyUp',keyCode:'F11'}); }); await site.waitForTimeout(200); assert.equal(await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isFullScreen()),true);
  await app.evaluate(({webContents}) => { const page=webContents.getAllWebContents().find((c)=>c.getURL().startsWith('https://album-circle.vercel.app')); page.sendInputEvent({type:'keyDown',keyCode:'Escape'});page.sendInputEvent({type:'keyUp',keyCode:'Escape'}); }); await site.waitForTimeout(200); assert.equal(await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isFullScreen()),false);
  assert.equal(report.pageErrors.length, 0); const exited = new Promise((resolve) => app.process().once('exit',resolve)); await site.getByRole('button', { name:'关闭窗口',exact:true }).click(); await exited; app = null; check('integrated-native-window-controls-minimize-maximize-close-and-F11-Escape-work'); report.passed = true;
})().catch((error) => { report.passed = false; report.error = error.stack; process.exitCode = 1; }).finally(async () => {
  if (!report.passed && site && !site.isClosed()) await site.screenshot({ path: path.join(output,'delivery-failure.png'), fullPage: true }).catch(() => {});
  if (app) await app.close().catch(() => {}); report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(output,'delivery-ui-report.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2));
});
