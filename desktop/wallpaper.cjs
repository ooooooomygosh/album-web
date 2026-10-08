'use strict';
const { BrowserWindow, ipcMain, screen } = require('electron');
const { execFile } = require('node:child_process');
const path = require('node:path');
const { cleanSnapshot } = require('./wallpaper-model.cjs');
const { readCompanion } = require('./companion-sync.cjs');
const URL = 'album-desktop://wallpaper/wallpaper.html';
function createWallpaper({ app, getMain, getSite, status, appearanceScript, getAppearance, log, registerProtocol }) {
  let window, snapshot, timer, healthTimer, polling = false, active = false, busy = false, generation = 0, lastJSON = '', handle;
  const helperPath = app.isPackaged ? path.join(process.resourcesPath, 'native', 'DesktopHost.exe') : path.join(__dirname, 'native', 'bin', 'DesktopHost.exe');
  const hwnd = (win) => win.getNativeWindowHandle().readBigUInt64LE().toString();
  const native = (command, target = handle) => new Promise((resolve, reject) => {
    const args = [command, target, String(process.pid)]; if (command === 'attach') args.push(hwnd(getMain()));
    execFile(helperPath, args, { windowsHide: true, timeout: 8000, maxBuffer: 16384, encoding: 'utf8' }, (error, out) => {
      if (error) return reject(new Error('Windows 桌面暂时无法挂载动态背景。请停止其他动态壁纸软件后重试。'));
      try { const value = JSON.parse(out); if (!value.behindIcons || !value.visible) throw new Error('unverified desktop layer'); resolve(value); } catch { reject(new Error('无法确认 Windows 桌面层的位置，已取消应用动态背景。')); }
    });
  });
  const announce = (error = '') => status({ active, busy, error });
  function stop(error = '') {
    generation++; active = false; busy = false; clearInterval(timer); clearInterval(healthTimer); timer = healthTimer = null;
    const old = window; window = null; handle = null; snapshot = null; lastJSON = '';
    if (old && !old.isDestroyed()) old.destroy(); announce(error); log('wallpaper-stopped');
  }
  const readRoom = () => readCompanion(getSite());
  async function sync() {
    if (!active || polling) return; polling = true; const token = generation;
    try {
      const result = await readRoom(); if (token !== generation) return;
      if (!result?.authenticated) { stop(); return; }
      const next = cleanSnapshot(result.room); // Other pages retain the last room until explicitly stopped.
      if (next) { const json = JSON.stringify(next); if (json !== lastJSON) { snapshot = next; lastJSON = json; window?.webContents.send('wallpaper:update', snapshot); } }
      else if (snapshot?.spinning) { snapshot = { ...snapshot, spinning: false, statusText: '已离开房间 · 旋转已暂停' }; lastJSON = JSON.stringify(snapshot); window?.webContents.send('wallpaper:update', snapshot); }
    } catch { /* A brief page reload leaves the last validated scene visible. */ }
    finally { polling = false; }
  }
  async function start() {
    if (active || busy) return; busy = true; announce(); const token = ++generation;
    try {
      if (!['win32', 'darwin'].includes(process.platform)) throw new Error('动态桌面支持 macOS 与 Windows。');
      const result = await readRoom(), first = cleanSnapshot(result?.room);
      if (!result?.authenticated || !first) throw new Error('请先进入温馨房间，再应用桌面动态背景。');
      if (token !== generation) return;
      snapshot = first; lastJSON = JSON.stringify(first);
      const display = screen.getDisplayMatching(getMain().getBounds());
      const created = new BrowserWindow({ ...display.bounds, title: 'Album Circle · 动态桌面', ...(process.platform === 'darwin' ? { type: 'desktop', hiddenInMissionControl: true } : {}), frame: false, show: false, skipTaskbar: true, focusable: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false, hasShadow: false, backgroundColor: '#38200f',
        webPreferences: { preload: path.join(__dirname, 'wallpaper-preload.cjs'), partition: 'album-circle-wallpaper', sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, backgroundThrottling: false, spellcheck: false } });
      window = created; handle = process.platform === 'win32' ? hwnd(created) : null; created.webContents.setFrameRate(30);
      if (!(await created.webContents.session.protocol.isProtocolHandled('album-desktop'))) registerProtocol(created.webContents.session.protocol);
      created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      created.webContents.on('will-navigate', (event) => event.preventDefault());
      created.webContents.on('will-frame-navigate', (event) => event.preventDefault());
      created.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
      created.webContents.session.setPermissionCheckHandler(() => false);
      created.on('closed', () => { if (window === created) stop('动态背景已停止，请重新应用。'); });
      await created.loadURL(URL);
      if (token !== generation) return;
      await created.webContents.executeJavaScript(appearanceScript(getAppearance()));
      let attached;
      if (process.platform === 'darwin') { created.setIgnoreMouseEvents(true); created.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false }); created.showInactive(); attached = { parentClass: 'macOS desktop', visible: created.isVisible() }; if (!attached.visible) throw new Error('桌面背景未能显示。'); } else attached = await native('attach');
      if (token !== generation) return;
      active = true; busy = false; announce(); log('wallpaper-attached', attached.parentClass);
      timer = setInterval(sync, 750);
      let healthBusy = false;
      if (process.platform === 'win32') healthTimer = setInterval(async () => { if (!active || healthBusy) return; healthBusy = true; const current = generation; try { await native('probe'); } catch (error) { if (current === generation) stop(error.message); } finally { healthBusy = false; } }, 10000);
    } catch (error) { if (token === generation) stop(error.message); }
  }
  ipcMain.handle('wallpaper:snapshot', (event) => {
    if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== URL) throw new Error('Unknown wallpaper sender');
    return snapshot;
  });
  return { start, stop, get active() { return active; }, get busy() { return busy; }, async reposition() { if (active) { try { if (process.platform === 'darwin') { window.setBounds(screen.getDisplayMatching(getMain().getBounds()).bounds); return; } await native('attach'); } catch (error) { stop(error.message); } } }, async applyAppearance() { if (window && !window.isDestroyed()) await window.webContents.executeJavaScript(appearanceScript(getAppearance())).catch(() => {}); }, get window() { return window; }, get handle() { return handle; } };
}
module.exports = { createWallpaper };
