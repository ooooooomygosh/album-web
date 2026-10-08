'use strict';
const { execFile } = require('node:child_process');
const DEFAULT_SETTINGS = Object.freeze({ theme: 'cover', font: 'bundled', weight: 400, zoom: 100, reduceMotion: false, showroom: 'original', showPurchases: false, connectionMode: 'local' });
const WEIGHTS = [250, 300, 400, 500, 700, 900];
function normalizeSettings(value = {}) {
  const font = typeof value.font === 'string' && value.font.length <= 160 && !/[\x00-\x1f\x7f"'\\;{}<>]/.test(value.font) ? value.font : 'bundled';
  return {
    theme: value.theme === 'simple' ? 'simple' : 'cover', font, connectionMode: value.connectionMode === 'cloud' ? 'cloud' : 'local',
    weight: WEIGHTS.includes(Number(value.weight)) ? Number(value.weight) : 400,
    zoom: Number.isFinite(Number(value.zoom)) ? Math.max(75, Math.min(150, Math.round(Number(value.zoom) / 5) * 5)) : 100,
    reduceMotion: value.reduceMotion === true, showroom: ['room', 'coverflow'].includes(value.showroom) ? value.showroom : 'original', showPurchases: value.showPurchases === true
  };
}
function appearanceScript(value, extra = {}) {
  const settings = normalizeSettings(value);
  const family = settings.font === 'bundled' ? 'HarmonyOS Sans SC Bundled' : settings.font;
  return `(() => { const s = ${JSON.stringify({ ...settings, ...extra })}; const root = document.documentElement;
    window.albumDesktopAppearance = s;
    root.dataset.desktopClient = 'true';
    root.dataset.desktopTheme = s.theme; root.dataset.desktopReduceMotion = String(s.reduceMotion);
    root.dataset.desktopShowroom = s.showroom;
    root.dataset.desktopPurchases = String(s.showPurchases);
    root.style.setProperty('--desktop-font', ${JSON.stringify(JSON.stringify(family) + ', "HarmonyOS Sans SC Bundled", sans-serif')});
    root.style.setProperty('--desktop-weight', String(s.weight));
    root.style.setProperty('--desktop-heading-weight', String(s.weight >= 700 ? 900 : 700));
    window.dispatchEvent(new CustomEvent('album-desktop-settings', { detail: s }));
  })()`;
}
let fontsPromise;
function listSystemFonts() {
  if (!fontsPromise) fontsPromise = new Promise((resolve) => {
    if (process.platform === 'darwin') {
      execFile('/usr/sbin/system_profiler', ['SPFontsDataType', '-json'], { timeout: 20000, maxBuffer: 20 * 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
        try { const names = JSON.parse(stdout).SPFontsDataType.flatMap((file) => (file.typefaces || []).map((font) => font.family)); resolve(error ? [] : [...new Set(names)].filter((name) => typeof name === 'string' && normalizeSettings({ font: name }).font === name).sort()); } catch { resolve([]); }
      }); return;
    }
    if (process.platform !== 'win32') { resolve([]); return; }
    const script = "[Console]::OutputEncoding = [Text.UTF8Encoding]::new(); Add-Type -AssemblyName System.Drawing; $albumFontCollection = [System.Drawing.Text.InstalledFontCollection]::new(); @($albumFontCollection.Families | ForEach-Object { $_.Name } | Sort-Object -Unique) | ConvertTo-Json -Compress; $albumFontCollection.Dispose()";
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
      try { const names = JSON.parse(stdout.replace(/^\uFEFF/, '')); resolve(error ? [] : [].concat(names).filter((name) => typeof name === 'string' && normalizeSettings({ font: name }).font === name)); }
      catch { resolve([]); }
    });
  });
  return fontsPromise;
}
module.exports = { DEFAULT_SETTINGS, WEIGHTS, normalizeSettings, appearanceScript, listSystemFonts };
