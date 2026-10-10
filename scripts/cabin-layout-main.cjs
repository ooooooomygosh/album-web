// Test bootstrap only: a hidden renderer with an isolated, temporary profile.
const { app, BrowserWindow } = require('electron');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const profile = mkdtempSync(path.join(tmpdir(), 'flow-cabin-layout-'));
app.setPath('userData', profile);
app.disableHardwareAcceleration();
app.whenReady().then(() => {
  const window = new BrowserWindow({ width:1440, height:900, show:false,
    webPreferences:{ offscreen:true, sandbox:true, contextIsolation:true, nodeIntegration:false } });
  window.loadURL('about:blank');
});
app.on('window-all-closed', () => app.quit());
app.on('quit', () => {
  // Only remove this test's freshly created child of the OS temporary directory.
  if (path.dirname(path.resolve(profile)) !== path.resolve(tmpdir()) || !path.basename(profile).startsWith('flow-cabin-layout-')) return;
  try { rmSync(profile, { recursive:true, force:true }); } catch {}
});
