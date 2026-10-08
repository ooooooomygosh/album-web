'use strict';

const { app, BrowserWindow, WebContentsView, Menu, Tray, dialog, ipcMain, clipboard, shell, protocol, screen, net, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { SITE_ORIGIN, SHELL_URL, isSiteUrl, isShellUrl, isExternalUrl, safeSavedWindow } = require('./policy.cjs');
const { createQQMusic } = require('./qq-music.cjs');
const { createSiteRouter } = require('./site-router.cjs');
const { DEFAULT_SETTINGS, normalizeSettings, appearanceScript, listSystemFonts } = require('./settings.cjs');
const { createWallpaper } = require('./wallpaper.cjs');
const { createLocalAPI } = require('./local-api.cjs');
const { createMusicService } = require('./music-service.cjs');
const { openQQLogin, openNeteaseLogin, clearQQLogin, clearNeteaseLogin } = require('./music-login.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'album-desktop', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.setName('Album Circle');
app.setAppUserModelId('com.albumcircle.desktop');

// Tests receive a separate storage directory. The distributed app cannot be configured to load another site.
if (process.env.ALBUM_DESKTOP_TEST_PROFILE) {
  app.setPath('userData', path.resolve(process.env.ALBUM_DESKTOP_TEST_PROFILE));
}

const icon = path.join(__dirname, 'assets', 'icon.png');
const toolbarHeight = 0;
let mainWindow;
let siteView;
let loadTimer;
let retryTimer;
let loading = false;
let currentError = '';
let documentHttpFailed = false;
let lastGoodUrl = `${SITE_ORIGIN}/`;
let startupComplete = false;
let preferences = {};
let appearance = { ...DEFAULT_SETTINGS };
let settingsOpen = false;
let systemFonts = [];
let wallpaper;
let music;
let localAPI;
let wallpaperTray;
let quitting = false;
let wallpaperState = { active: false, busy: false, error: '' };

function restoreMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
}
function wallpaperStatus(state) {
  wallpaperState = state;
  if (state.active && !wallpaperTray) {
    wallpaperTray = new Tray(icon);
    wallpaperTray.setToolTip('Album Circle · 桌面动态背景');
    wallpaperTray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开 Album Circle', click: restoreMainWindow },
      { label: '停止桌面动态背景', click: () => { wallpaper.stop(); restoreMainWindow(); } },
      { type: 'separator' }, { label: '退出应用', click: () => app.quit() }
    ]));
    wallpaperTray.on('double-click', restoreMainWindow);
  } else if (!state.active && !state.busy && wallpaperTray) {
    wallpaperTray.destroy(); wallpaperTray = null;
    if (!quitting && mainWindow && !mainWindow.isVisible()) restoreMainWindow();
  }
  if (siteView && !siteView.webContents.isDestroyed()) siteView.webContents.executeJavaScript(`window.albumRoomWallpaperState = ${JSON.stringify(state)}; window.dispatchEvent(new CustomEvent('album-room-wallpaper', {detail: window.albumRoomWallpaperState}));`).catch(() => {});
}

function settingsPath() { return path.join(app.getPath('userData'), 'settings.json'); }
function currentDisplay() {
  const display = mainWindow ? screen.getDisplayMatching(mainWindow.getBounds()) : screen.getPrimaryDisplay();
  return { name: display.label || '显示器', width: Math.round(display.bounds.width * display.scaleFactor), height: Math.round(display.bounds.height * display.scaleFactor), scale: Math.round(display.scaleFactor * 100), refreshRate: display.displayFrequency };
}
async function applyAppearance() {
  if (mainWindow && !mainWindow.isDestroyed()) await mainWindow.webContents.executeJavaScript(appearanceScript(appearance, { fonts: systemFonts })).catch(() => {});
  if (siteView && !siteView.webContents.isDestroyed() && isSiteUrl(siteView.webContents.getURL())) {
    siteView.webContents.setZoomFactor(appearance.zoom / 100);
    await siteView.webContents.executeJavaScript(appearanceScript(appearance, { fonts: systemFonts, platform: process.platform })).catch(() => {});
  }
  await wallpaper?.applyAppearance();
}
function toggleSettings(open = !settingsOpen) {
  settingsOpen = open;
  siteView?.setVisible(!open && !currentError && !loading);
  sendState();
}
async function saveAppearance(value) {
  const next = normalizeSettings(value);
  if (next.font !== 'bundled' && !(await listSystemFonts()).includes(next.font)) throw new Error('该字体未安装，请刷新本机字体列表后选择。');
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(settingsPath() + '.tmp', JSON.stringify(next));
  fs.renameSync(settingsPath() + '.tmp', settingsPath());
  const modeChanged = appearance.connectionMode !== next.connectionMode;
  appearance = next;
  await applyAppearance();
  if (modeChanged) { lastGoodUrl = SITE_ORIGIN + '/'; await navigate(lastGoodUrl); }
  sendState();
  return { settings: appearance, display: currentDisplay() };
}

function preferencesPath() { return path.join(app.getPath('userData'), 'window.json'); }
function writeLog(event, detail = '') {
  try {
    const logFile = path.join(app.getPath('userData'), 'desktop.log');
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1024 * 1024) fs.renameSync(logFile, `${logFile}.previous`);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${event} ${String(detail).replace(/[\r\n]/g, ' ').slice(0, 240)}\n`);
  } catch { /* A log failure must not prevent the client from opening. */ }
}

function sendState(extra = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const candidateContents = siteView?.webContents;
  const contents = candidateContents && !candidateContents.isDestroyed() ? candidateContents : null;
  const state = {
    loading,
    error: currentError,
    url: isSiteUrl(contents?.getURL()) ? contents.getURL() : lastGoodUrl,
    title: contents?.getTitle() || 'Album Circle',
    canBack: Boolean(contents && !contents.isDestroyed() && contents.navigationHistory.canGoBack()),
    canForward: Boolean(contents && !contents.isDestroyed() && contents.navigationHistory.canGoForward()),
    version: app.getVersion(),
    settingsOpen, settings: appearance, display: currentDisplay(),
    ...extra
  };
  mainWindow.webContents.send('desktop:state', state);
}

function resizeView() {
  if (!mainWindow || mainWindow.isDestroyed() || !siteView) return;
  const [width, height] = mainWindow.getContentSize();
  siteView.setBounds({ x: 0, y: toolbarHeight, width, height: Math.max(0, height - toolbarHeight) });
}

function showFailure(message) {
  clearTimeout(loadTimer);
  loading = false;
  currentError = message;
  siteView?.setVisible(false);
  sendState();
  writeLog('connection-failed', message);
}

function openExternal(url) {
  if (!isExternalUrl(url)) return;
  shell.openExternal(url).catch(() => dialog.showMessageBox(mainWindow, {
    type: 'info', title: '无法打开浏览器', message: '请复制链接后，在系统浏览器中打开。'
  }));
}

function exitFullscreenOnEscape(event, input) {
  if (input.type === 'keyDown' && input.key === 'F11') { event.preventDefault(); mainWindow.setFullScreen(!mainWindow.isFullScreen()); return true; }
  if (input.type === 'keyDown' && input.key === 'Escape' && mainWindow?.isFullScreen()) {
    event.preventDefault();
    mainWindow.setFullScreen(false);
    return true;
  }
  if (input.type === 'keyDown' && input.key === 'Escape' && settingsOpen) { event.preventDefault(); toggleSettings(false); }
  return false;
}

async function navigate(url = lastGoodUrl) {
  if (!siteView || !isSiteUrl(url)) return;
  clearTimeout(loadTimer);
  clearTimeout(retryTimer);
  loading = true;
  currentError = '';
  documentHttpFailed = false;
  sendState();
  loadTimer = setTimeout(() => {
    if (loading) {
      siteView.webContents.stop();
      showFailure('连接等待时间较长，请检查网络后重试。');
    }
  }, 45000);
  try {
    await siteView.webContents.loadURL(url);
  } catch (error) {
    if (error.code !== 'ERR_ABORTED' && loading) showFailure('暂时无法连接 Album Circle，请检查网络后重试。');
  }
}

async function wireRemoteView() {
  const contents = siteView.webContents;
  contents.on('will-navigate', (event) => {
    const url = event.url;
    if (handleSiteCommand(url)) { event.preventDefault(); return; }
    if (!isSiteUrl(url)) { event.preventDefault(); openExternal(url); }
  });
  contents.on('will-frame-navigate', (event) => {
    if (!event.isMainFrame && !isSiteUrl(event.url)) event.preventDefault();
  });
  contents.on('will-redirect', (event, url) => {
    if (!isSiteUrl(url)) { event.preventDefault(); showFailure('网站重定向到了其他地址，请在浏览器中检查。'); }
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('album-desktop://action/')) { setImmediate(() => handleSiteCommand(url)); return { action: 'deny' }; }
    if (isSiteUrl(url)) setImmediate(() => navigate(url));
    else openExternal(url);
    return { action: 'deny' };
  });
  contents.on('did-start-loading', () => { loading = true; sendState(); });
  contents.on('did-finish-load', async () => {
    if (documentHttpFailed) { showFailure('原站服务暂时不可用，请稍后重新连接。'); return; }
    // Chromium can finish rendering its internal error document after did-fail-load.
    if (currentError) { loading = false; sendState(); return; }
    clearTimeout(loadTimer);
    loading = false;
    currentError = '';
    if (isSiteUrl(contents.getURL())) lastGoodUrl = contents.getURL();
    await applyAppearance();
    wallpaperStatus(wallpaperState);
    siteView.setVisible(!settingsOpen);
    sendState();
    writeLog('page-ready');
  });
  contents.on('did-stop-loading', () => { if (!currentError) loading = false; sendState(); });
  contents.on('did-navigate-in-page', () => {
    if (isSiteUrl(contents.getURL())) lastGoodUrl = contents.getURL();
    sendState();
  });
  contents.on('page-title-updated', () => sendState());
  contents.on('did-fail-load', (_event, errorCode, _description, _url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) showFailure('暂时无法连接 Album Circle，请检查网络后重试。');
  });
  contents.on('render-process-gone', (_event, details) => {
    showFailure('页面已暂停运行。点击重新连接即可恢复。');
    writeLog('renderer-exited', details.reason);
  });
  contents.on('before-input-event', (event, input) => {
    if (exitFullscreenOnEscape(event, input)) return;
    if (input.type !== 'keyDown') return;
    if ((input.control || input.meta) && input.key.toLowerCase() === 'r') { event.preventDefault(); navigate(); }
    if (input.alt && input.key === 'ArrowLeft' && contents.navigationHistory.canGoBack()) { event.preventDefault(); contents.navigationHistory.goBack(); }
    if (input.alt && input.key === 'ArrowRight' && contents.navigationHistory.canGoForward()) { event.preventDefault(); contents.navigationHistory.goForward(); }
  });
  const session = contents.session;
  const qq = createQQMusic((url, options) => net.fetch(url, { ...options, bypassCustomProtocolHandlers: true }));
  if (await session.protocol.isProtocolHandled('https')) session.protocol.unhandle('https');
  session.protocol.handle('https', createSiteRouter({
    webRoot: path.join(__dirname, 'web'),
    forward: (request) => session.fetch(request, { bypassCustomProtocolHandlers: true }),
    qq, localAPI, getAppearance: () => ({ ...appearance, platform: process.platform }),
    music: (request, pathname) => music.proxy(request, pathname, (url, options) => net.fetch(url, options))
  }));
  session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(isSiteUrl(webContents.getURL()) && permission === 'clipboard-sanitized-write');
  });
  session.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return isSiteUrl(requestingOrigin) && permission === 'clipboard-sanitized-write';
  });
  session.on('will-download', (event, item, source) => {
    // Only locally generated wall PNG/JSON downloads are permitted.
    const valid = source === contents && isSiteUrl(contents.getURL()) && item.getURL().startsWith(`blob:${SITE_ORIGIN}/`) && /\.(png|json)$/i.test(item.getFilename()) && item.getTotalBytes() <= 64 * 1024 * 1024;
    if (!valid) { event.preventDefault(); return; }
    item.setSaveDialogOptions({ title: '保存专辑墙', defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename())), filters: [{ name: item.getFilename().endsWith('.png') ? 'PNG 图片' : '专辑墙工程', extensions: [item.getFilename().endsWith('.png') ? 'png' : 'json'] }] });
  });
  // Request URLs, tokens and room identifiers are intentionally not written to logs.
  session.webRequest.onHeadersReceived({ urls: [`${SITE_ORIGIN}/*`] }, (details, callback) => {
    if (details.resourceType === 'mainFrame' && details.statusCode >= 400) {
      documentHttpFailed = true;
      setImmediate(() => showFailure('原站服务暂时不可用，请稍后重新连接。'));
    }
    const headers = { ...details.responseHeaders };
    if (details.resourceType === 'mainFrame' && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-security-policy')) {
      headers['Content-Security-Policy'] = ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; media-src 'self' https: blob:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'"];
    }
    callback({ responseHeaders: headers });
  });
}

function handleSiteCommand(value) {
  let url; try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'album-desktop:' || url.hostname !== 'action' || url.username || url.password || !isSiteUrl(siteView?.webContents.getURL())) return false;
  switch (url.pathname) {
    case '/settings': toggleSettings(true); break;
    case '/cloud-connect': saveAppearance({ ...appearance, connectionMode: 'cloud' }).then(() => toggleSettings(false)).catch(() => {}); break;
    case '/minimize': mainWindow.minimize(); break;
    case '/maximize': if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false); else if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); break;
    case '/close': mainWindow.close(); break;
    case '/wallpaper-start': wallpaper.start(); break;
    case '/wallpaper-stop': wallpaper.stop(); break;
    case '/music-login': if (['qq', 'netease'].includes(url.searchParams.get('provider'))) music.login(url.searchParams.get('provider')).then((result) => notifyMusic(result)).catch((error) => notifyMusic({ error: error.message })); break;
    case '/music-logout': if (['qq', 'netease'].includes(url.searchParams.get('provider'))) music.logout(url.searchParams.get('provider')).then(() => notifyMusic({ ok: true })).catch((error) => notifyMusic({ error: error.message })); break;
    case '/appearance': if (['true', 'false'].includes(url.searchParams.get('reduceMotion'))) saveAppearance({ ...appearance, reduceMotion: url.searchParams.get('reduceMotion') === 'true', ...(['cover', 'simple'].includes(url.searchParams.get('theme')) ? { theme: url.searchParams.get('theme') } : {}) }).catch(() => {}); break;
    default: return false;
  }
  return true;
}
function notifyMusic(result) {
  if (siteView && !siteView.webContents.isDestroyed()) siteView.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('album-music-account', {detail: ${JSON.stringify(result)}}));`).catch(() => {});
}

async function clearLogin() {
  const answer = await dialog.showMessageBox(mainWindow, {
    type: 'question', title: '清除本机登录',
    message: '清除这台电脑的登录状态和网站缓存？',
    detail: '下次需要重新登录。原站中的专辑、评论和账户数据会保留。',
    buttons: ['取消', '清除并重新登录'], defaultId: 0, cancelId: 0
  });
  if (answer.response !== 1) return;
  wallpaper.stop();
  // Personal collection notes survive the account/cache reset.
  const purchaseNotes = await siteView.webContents.executeJavaScript("Object.fromEntries(Object.entries(localStorage).filter(([key]) => key === 'album-circle-purchases-v1' || key === 'album-circle-wall-v1' || key.startsWith('album-circle-display-') || key.startsWith('album-circle-library-v1-')))");
  if (JSON.stringify(purchaseNotes).length > 8 * 1024 * 1024) {
    await dialog.showMessageBox(mainWindow, { type: 'error', title: '保留本机资料', message: '本机收藏设置较多，无法安全完成清理。', detail: '登录和收藏设置均未清除。请先备份应用数据再重试。' });
    return;
  }
  siteView.webContents.stop();
  await siteView.webContents.session.clearStorageData();
  await siteView.webContents.session.clearCache();
  await siteView.webContents.executeJavaScript(`Object.entries(${JSON.stringify(purchaseNotes)}).forEach(([key,value]) => localStorage.setItem(key,value))`);
  lastGoodUrl = `${SITE_ORIGIN}/`;
  await navigate();
}

function copyCurrentLink() {
  clipboard.writeText(lastGoodUrl);
  sendState({ notice: '当前链接已复制' });
}

function showToolbarMenu() {
  const [width] = mainWindow.getContentSize();
  Menu.buildFromTemplate([
    { label: `macOS / Windows 客户端 · ${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: '设置', click: () => toggleSettings(true) },
    { label: '清除本机登录', click: clearLogin },
    { label: '打开日志目录', click: () => shell.openPath(app.getPath('userData')) },
    { label: '在浏览器中打开', click: () => openExternal(lastGoodUrl) }
  ]).popup({ window: mainWindow, x: Math.max(0, width - 250), y: toolbarHeight });
}

function createMenus() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '应用', submenu: [
      { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => toggleSettings(true) },
      { label: '返回首页', accelerator: 'CmdOrCtrl+H', click: () => navigate(`${SITE_ORIGIN}/`) },
      { label: '刷新页面', accelerator: 'CmdOrCtrl+R', click: () => navigate() },
      { label: '复制当前链接', accelerator: 'CmdOrCtrl+Shift+C', click: copyCurrentLink },
      { label: '在浏览器中打开', click: () => openExternal(lastGoodUrl) },
      { type: 'separator' },
      { label: '清除本机登录', click: clearLogin },
      { type: 'separator' },
      { role: 'quit', label: '退出' }
    ]},
    { label: '编辑', submenu: [
      { role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' },
      { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }
    ]},
    { label: '查看', submenu: [
      { label: '放大', accelerator: 'CmdOrCtrl+Plus', click: () => saveAppearance({ ...appearance, zoom: appearance.zoom + 5 }).catch(() => {}) },
      { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => saveAppearance({ ...appearance, zoom: appearance.zoom - 5 }).catch(() => {}) },
      { label: '实际大小', accelerator: 'CmdOrCtrl+0', click: () => saveAppearance({ ...appearance, zoom: 100 }).catch(() => {}) },
      { role: 'togglefullscreen', label: '全屏' }
    ]},
    { label: '帮助', submenu: [
      { label: '打开日志目录', click: () => shell.openPath(app.getPath('userData')) },
      { label: '关于 Album Circle', click: () => dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'Album Circle', message: `Album Circle ${app.getVersion()}`,
        detail: 'macOS / Windows 客户端\n使用 HarmonyOS Sans SC 字体，Copyright 2021 Huawei Device Co., Ltd.\n字体原文件与授权协议随应用打包。\nQQ 搜索、封面和曲目来自 QQ 音乐。\n本地收藏无需账号；云端房间、分享与 AI 为可选服务。\n\n服务地址：' + SITE_ORIGIN + '\n登录状态保存在这台电脑。'
      }) }
    ]}
  ]));
}

function registerShellProtocol(targetProtocol = protocol) {
  const assets = {
    '/index.html': ['renderer/index.html', 'text/html; charset=utf-8'],
    '/app.css': ['renderer/app.css', 'text/css; charset=utf-8'],
    '/app.js': ['renderer/app.js', 'text/javascript; charset=utf-8'],
    '/fonts.css': ['renderer/fonts.css', 'text/css; charset=utf-8'],
    '/fonts/LICENSE.txt': ['web/fonts/LICENSE.txt', 'text/plain; charset=utf-8'],
    '/icon.png': ['assets/icon.png', 'image/png']
  };
  for (const weight of ['Thin', 'Light', 'Regular', 'Medium', 'Bold', 'Black']) assets[`/fonts/HarmonyOS_Sans_SC_${weight}.ttf`] = [`web/fonts/HarmonyOS_Sans_SC_${weight}.ttf`, 'font/ttf'];
  for (const name of fs.readdirSync(path.join(__dirname, 'renderer', 'icons'))) assets[`/icons/${name}`] = [`renderer/icons/${name}`, name.endsWith('.svg') ? 'image/svg+xml' : 'text/plain'];
  const wallpaperAssets = new Map();
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
  const list = (directory, prefix = '') => { for (const file of fs.readdirSync(directory, { withFileTypes: true })) { if (file.isSymbolicLink()) continue; const relative = `${prefix}/${file.name}`; if (file.isDirectory()) list(path.join(directory, file.name), relative); else if (mime[path.extname(file.name)] && (relative === '/wallpaper.html' || relative.startsWith('/assets/') || relative.startsWith('/room-scenes/') || relative.startsWith('/fonts/'))) wallpaperAssets.set(relative, path.join(directory, file.name)); } };
  list(path.join(__dirname, 'web'));
  targetProtocol.handle('album-desktop', (request) => {
    const url = new URL(request.url);
    if (url.hostname === 'wallpaper' && !url.username && !url.password && !url.port && ['GET', 'HEAD'].includes(request.method)) {
      const file = wallpaperAssets.get(url.pathname);
      if (!file) return new Response('Not found', { status: 404 });
      return new Response(request.method === 'HEAD' ? null : fs.readFileSync(file), { headers: { 'Content-Type': mime[path.extname(file)], 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'" } });
    }
    const entry = url.hostname === 'shell' && !url.username && !url.password ? assets[url.pathname] : null;
    if (!entry) return new Response('Not found', { status: 404 });
    return new Response(fs.readFileSync(path.join(__dirname, entry[0])), {
      headers: {
        'Content-Type': entry[1],
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'"
      }
    });
  });
}

function registerIpc() {
  ipcMain.handle('desktop:command', async (event, command) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || !isShellUrl(event.senderFrame.url)) throw new Error('Unknown sender');
    switch (command) {
      case 'ready': sendState(); break;
      case 'retry': await navigate(); break;
      case 'home': await navigate(`${SITE_ORIGIN}/`); break;
      case 'back': if (siteView.webContents.navigationHistory.canGoBack()) siteView.webContents.navigationHistory.goBack(); break;
      case 'forward': if (siteView.webContents.navigationHistory.canGoForward()) siteView.webContents.navigationHistory.goForward(); break;
      case 'copy': copyCurrentLink(); break;
      case 'browser': openExternal(lastGoodUrl); break;
      case 'clear': await clearLogin(); break;
      case 'menu': showToolbarMenu(); break;
      case 'settings': toggleSettings(true); break;
      case 'settings-close': toggleSettings(false); break;
      case 'fit-display': mainWindow.maximize(); sendState(); break;
      case 'minimize': mainWindow.minimize(); break;
      case 'maximize': if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); break;
      case 'close': mainWindow.close(); break;
      case 'network-restored': if (currentError) { clearTimeout(retryTimer); retryTimer = setTimeout(() => navigate(), 900); } break;
      default: throw new Error('Unknown command');
    }
    return true;
  });
  ipcMain.handle('desktop:settings', async (event, operation, value) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || !isShellUrl(event.senderFrame.url)) throw new Error('Unknown sender');
    if (operation === 'get') return { settings: appearance, fonts: await listSystemFonts(), display: currentDisplay() };
    if (operation === 'apply') return saveAppearance(value);
    if (operation === 'reset') return saveAppearance(DEFAULT_SETTINGS);
    throw new Error('Unknown settings operation');
  });
}

async function createWindow() {
  try { preferences = JSON.parse(fs.readFileSync(preferencesPath(), 'utf8')); } catch { preferences = {}; }
  try { appearance = normalizeSettings(JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))); } catch { appearance = { ...DEFAULT_SETTINGS }; }
  if (appearance.font !== 'bundled' && !(await listSystemFonts()).includes(appearance.font)) appearance.font = 'bundled';
  const display = Number.isFinite(preferences.x) && Number.isFinite(preferences.y) ? screen.getDisplayMatching(preferences) : screen.getPrimaryDisplay();
  mainWindow = new BrowserWindow({
    ...safeSavedWindow(preferences, display.workArea), minWidth: Math.min(900, display.workArea.width), minHeight: Math.min(600, display.workArea.height),
    title: 'Album Circle', icon, backgroundColor: '#111317', show: false,
    // Keep the native resize style: removing it breaks real fullscreen on Windows.
    autoHideMenuBar: true, frame: false, thickFrame: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  });
  siteView = new WebContentsView({
    webPreferences: { partition: 'persist:album-circle-v1', nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, spellcheck: false }
  });
  siteView.setBackgroundColor('#111317');
  mainWindow.contentView.addChildView(siteView);
  siteView.setVisible(false);
  resizeView();
  await wireRemoteView();
  createMenus();
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('before-input-event', exitFullscreenOnEscape);
  mainWindow.on('resize', () => { resizeView(); setImmediate(resizeView); });
  mainWindow.on('maximize', () => setImmediate(resizeView));
  mainWindow.on('unmaximize', () => setImmediate(resizeView));
  mainWindow.on('move', () => { if (settingsOpen) sendState(); });
  mainWindow.on('close', (event) => {
    if ((wallpaper?.active || wallpaper?.busy) && !quitting) { event.preventDefault(); mainWindow.hide(); return; }
    try {
      fs.mkdirSync(app.getPath('userData'), { recursive: true });
      fs.writeFileSync(preferencesPath(), JSON.stringify({ ...mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized(), displayAdapted: true }));
    } catch { /* Keep the last successfully saved window state. */ }
    clearTimeout(loadTimer); clearTimeout(retryTimer);
    if (siteView && !siteView.webContents.isDestroyed()) siteView.webContents.close();
  });
  mainWindow.on('closed', () => { mainWindow = null; siteView = null; });
  await mainWindow.loadURL(SHELL_URL);
  await applyAppearance();
  if (preferences.maximized || !preferences.displayAdapted) mainWindow.maximize();
  mainWindow.show();
  resizeView();
  listSystemFonts().then((fonts) => { systemFonts = fonts; return applyAppearance(); }).catch(() => {});
  startupComplete = true;
  await navigate();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    restoreMainWindow();
  });
  app.whenReady().then(async () => {
    screen.on('display-metrics-changed', () => { sendState(); wallpaper?.reposition(); });
    screen.on('display-removed', () => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMaximized() && !mainWindow.isFullScreen()) mainWindow.setBounds(safeSavedWindow(mainWindow.getBounds(), screen.getDisplayMatching(mainWindow.getBounds()).workArea));
      sendState();
      wallpaper?.reposition();
    });
    registerShellProtocol(); registerIpc();
    wallpaper = createWallpaper({ app, getMain: () => mainWindow, getSite: () => siteView?.webContents, status: wallpaperStatus, appearanceScript, getAppearance: () => appearance, log: writeLog, registerProtocol: registerShellProtocol });
    localAPI = createLocalAPI(path.join(app.getPath('userData'), 'local'));
    music = createMusicService({ directory: app.getPath('userData'), safeStorage, login: (provider) => provider === 'qq' ? openQQLogin(mainWindow) : openNeteaseLogin(mainWindow), logout: (provider) => provider === 'qq' ? clearQQLogin() : clearNeteaseLogin() });
    writeLog('started', app.getVersion()); await createWindow();
  }).catch((error) => {
    writeLog('startup-error', error.message);
    dialog.showErrorBox('Album Circle 启动失败', '请关闭后重新打开应用。\n' + error.message);
    app.quit();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (mainWindow) restoreMainWindow(); else createWindow().catch((error) => writeLog('startup-error', error.message)); });
  app.on('before-quit', () => { quitting = true; wallpaper?.stop(); music?.stop(); wallpaperTray?.destroy(); wallpaperTray = null; if (startupComplete) writeLog('closed'); });
}
