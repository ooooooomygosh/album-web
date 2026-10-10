'use strict';
// 桌面模式: the cabin becomes the desktop. The main window fills the display's
// work area (taskbar / Dock / menu bar stay usable), stays below every other
// window and remains fully interactive — unlike the wallpaper, which is
// painted behind the desktop icons and cannot be clicked.
//
//   macOS    window level −1: above the desktop icons, below normal windows.
//   Windows  DesktopHost.exe keep-bottom: an out-of-process WinEvent hook that
//            pushes the window to HWND_BOTTOM whenever it is raised. Explorer's
//            windows are never reparented or modified.
const { spawn } = require('node:child_process');

function createDesktopMode({ getWindow, screen, platform = process.platform, helperPath, spawnProcess = spawn, onChange = () => {}, log = () => {} }) {
  let active = false, saved = null, keeper = null, refitTimer = null;
  const win = () => { const value = getWindow(); return value && !value.isDestroyed() ? value : null; };
  const handle = (value) => value.getNativeWindowHandle().readBigUInt64LE().toString();
  function stopKeeper() { if (!keeper) return; const child = keeper; keeper = null; try { child.stdin?.end(); child.kill(); } catch {} }
  function startKeeper(value) {
    if (platform !== 'win32' || !helperPath) return;
    try {
      const child = spawnProcess(helperPath, ['keep-bottom', handle(value), String(process.pid)], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
      keeper = child;
      child.on('error', (error) => { log('desktop-mode-keeper-error', error.message); if (keeper === child) keeper = null; });
      child.on('exit', (code) => { if (keeper === child) { keeper = null; if (active) log('desktop-mode-keeper-exit', String(code)); } });
    } catch (error) { log('desktop-mode-keeper-error', error.message); }
  }
  function fit(value = win()) {
    if (!value) return;
    const area = screen.getDisplayMatching(value.getBounds()).workArea;
    value.setBounds({ x: area.x, y: area.y, width: area.width, height: area.height });
  }
  function enter() {
    const value = win(); if (!value || active) return state();
    saved = { bounds: value.isMaximized() || value.isFullScreen() ? value.getNormalBounds() : value.getBounds(), maximized: value.isMaximized() };
    if (value.isFullScreen()) value.setFullScreen(false);
    if (platform === 'darwin' && value.isSimpleFullScreen?.()) value.setSimpleFullScreen(false);
    if (value.isMaximized()) value.unmaximize();
    value.setResizable(false); value.setMovable(false); value.setFullScreenable(false);
    fit(value);
    if (platform === 'darwin') {
      // NSNormalWindowLevel − 1: under every app window, over Finder's icons.
      value.setAlwaysOnTop(true, 'normal', -1);
      value.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
      value.setHiddenInMissionControl?.(true);
    }
    active = true;
    if (!value.isVisible()) value.showInactive(); // never jump in front of the user's work
    startKeeper(value);
    log('desktop-mode-entered', platform);
    onChange(state());
    return state();
  }
  function exit({ restore = true } = {}) {
    const value = win(); stopKeeper(); clearTimeout(refitTimer);
    if (!active) return state();
    active = false;
    if (value) {
      if (platform === 'darwin') { value.setAlwaysOnTop(false); value.setVisibleOnAllWorkspaces(false); value.setHiddenInMissionControl?.(false); }
      value.setResizable(true); value.setMovable(true); value.setFullScreenable(true);
      if (restore && saved) { value.setBounds(saved.bounds); if (saved.maximized) value.maximize(); }
      if (restore) { value.show(); value.focus(); }
    }
    saved = null; log('desktop-mode-exited');
    onChange(state());
    return state();
  }
  function state() { return { active, platform, kept: Boolean(keeper) || platform === 'darwin' }; }
  return {
    enter, exit, state, get active() { return active; },
    toggle() { return active ? exit() : enter(); },
    // Displays change (resolution, docking, a monitor unplugged): fill the new work area.
    refit() { if (!active) return; clearTimeout(refitTimer); refitTimer = setTimeout(() => fit(), 120); },
    stop() { exit({ restore: false }); }
  };
}
module.exports = { createDesktopMode };
