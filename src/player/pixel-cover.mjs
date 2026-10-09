// Pixel covers in the cabin palette. Two paths:
//  1. existing artwork → centre crop → 32×32 → ordered-dither quantize to the
//     cabin ramp → nearest-neighbour upscale;
//  2. no artwork (or pixels we may not read) → a small scene generated from a
//     seed of title + artist, so the same album always gets the same cover.
// Grid maths is pure; only renderers touch a canvas.
import { loadWallCover } from '../album-wall-canvas.mjs';

// Mirror of src/styles/tokens.css. Live CSS values win when present.
export const PALETTE_TOKENS = [
  ['--px-shadow', '#0d0805'], ['--px-bg', '#1c120b'], ['--px-surface', '#2e1d12'], ['--px-surface-2', '#3a2416'],
  ['--px-surface-3', '#4d311c'], ['--px-border', '#8a5a32'], ['--px-border-hi', '#b07a46'], ['--px-accent-lo', '#a8743c'],
  ['--px-accent', '#e0ad69'], ['--px-accent-hi', '#ffd99c'], ['--px-ink', '#ffe9cb'], ['--px-ink-dim', '#c9a47a'],
  ['--px-night', '#22304a'], ['--px-accent-2', '#7fb8a8'], ['--px-good', '#9ccf8c'], ['--px-warn', '#e06a4e']
];
export const GRID = 32;

export function hexToRgb(hex) {
  const value = String(hex || '').trim().replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  if (!/^[\da-f]{6}$/i.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}
export function readPalette(style) {
  return PALETTE_TOKENS.map(([name, fallback]) => hexToRgb(style?.getPropertyValue?.(name)) || hexToRgb(fallback));
}

// Redmean distance: cheap and closer to perception than plain RGB.
export function nearestIndex(rgb, palette) {
  let best = 0, bestDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [r, g, b] = palette[i], mean = (rgb[0] + r) / 2, dr = rgb[0] - r, dg = rgb[1] - g, db = rgb[2] - b;
    const distance = (2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db;
    if (distance < bestDistance) { bestDistance = distance; best = i; }
  }
  return best;
}
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
// RGBA pixels (size×size) → palette indices; light 4×4 Bayer dithering and a
// warm lift so cool photos still sit inside the cabin's lamplight.
export function quantize(pixels, size, palette, { dither = 18, warmth = 10 } = {}) {
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, offset = (BAYER[y % 4][x % 4] / 16 - 0.5) * dither;
    out[y * size + x] = nearestIndex([pixels[i] + offset + warmth, pixels[i + 1] + offset + warmth * 0.4, pixels[i + 2] + offset - warmth * 0.6], palette);
  }
  return out;
}

// Small deterministic PRNG (mulberry32) seeded from a string hash (FNV-1a).
export function hashString(text) { let h = 0x811c9dc5; for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0; }
export function seededRandom(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const P = Object.fromEntries(PALETTE_TOKENS.map(([name], index) => [name.replace('--px-', ''), index]));
export const SCENES = ['window', 'hills', 'vinyl', 'cabin'];

// Procedural 32×32 cover: returns palette indices. Scenes share the same
// sky/ground language so a shelf of generated covers looks like one set.
export function proceduralGrid({ title = '', artist = '' } = {}) {
  const seed = hashString(`${title}\u0000${artist}`), rand = seededRandom(seed), n = GRID;
  const grid = new Uint8Array(n * n), set = (x, y, c) => { if (x >= 0 && y >= 0 && x < n && y < n) grid[y * n + x] = c; };
  const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c); };
  const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) set(cx + x, cy + y, c); };
  const scene = SCENES[seed % SCENES.length], dusk = rand() < 0.5;
  // Sky: banded dusk (ember→amber) or night (night→surface) with stars.
  const bands = dusk ? [P.night, P['surface-3'], P['accent-lo'], P.accent, P['accent-hi']] : [P.shadow, P.bg, P.night, P.night, P['surface-2']];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const t = y / n + ((x + y) % 2) * 0.02; grid[y * n + x] = bands[Math.min(bands.length - 1, Math.floor(t * bands.length))]; }
  if (!dusk) for (let i = 0; i < 14; i++) set(Math.floor(rand() * n), Math.floor(rand() * n * 0.55), rand() < 0.3 ? P['accent-hi'] : P.ink);
  const sunX = 6 + Math.floor(rand() * 20), sunY = 6 + Math.floor(rand() * 6);
  disc(sunX, sunY, dusk ? 4 : 3, dusk ? P['accent-hi'] : P.ink);
  if (!dusk) disc(sunX + 2, sunY - 1, 3, bands[Math.min(4, Math.floor((sunY / n) * 5))]); // crescent moon
  const hill = (base, amp, colour, phase) => { for (let x = 0; x < n; x++) { const h = Math.round(base + Math.sin(x / (3 + amp) + phase) * amp); for (let y = h; y < n; y++) set(x, y, colour); } };
  if (scene === 'hills' || scene === 'cabin') { hill(19, 2, P['accent-2'], rand() * 6); hill(23, 2, P.good, rand() * 6); hill(27, 1, P.surface, rand() * 6); }
  if (scene === 'cabin') {
    const cx = 9 + Math.floor(rand() * 12);
    rect(cx, 18, 10, 7, P.border); rect(cx, 18, 10, 1, P['border-hi']);
    for (let i = 0; i < 6; i++) rect(cx - 1 + i, 17 - i, 12 - i * 2, 1, P.warn); // roof
    rect(cx + 2, 20, 3, 3, P['accent-hi']); rect(cx + 6, 21, 2, 4, P.shadow); // lit window + door
    rect(cx + 7, 11, 2, 4, P['surface-3']);
  }
  if (scene === 'window') {
    rect(0, 0, n, 3, P.surface); rect(0, n - 7, n, 7, P.surface); rect(0, 0, 3, n, P.surface); rect(n - 3, 0, 3, n, P.surface);
    rect(15, 3, 2, n - 10, P['surface-3']); rect(3, 13, n - 6, 2, P['surface-3']);
    rect(0, n - 7, n, 1, P['border-hi']); rect(5, n - 10, 4, 3, P.good); rect(6, n - 12, 2, 2, P.good); rect(5, n - 7, 4, 2, P.warn); // plant pot
    rect(22, n - 9, 5, 2, P['accent-hi']); rect(23, n - 11, 3, 2, P.ink); // candle glow
  }
  if (scene === 'vinyl') {
    rect(0, 22, n, n - 22, P['surface-3']); rect(0, 22, n, 1, P['border-hi']);
    for (let y = 24; y < n; y += 3) rect(0, y, n, 1, P.surface);
    disc(16, 19, 9, P.shadow); disc(16, 19, 7, P.bg); disc(16, 19, 5, P.shadow);
    disc(16, 19, 3, [P.warn, P['accent-2'], P.accent, P.good][Math.floor(rand() * 4)]); set(16, 19, P.ink);
    set(12, 14, P['ink-dim']); set(11, 15, P['ink-dim']);
  }
  // 1px frame like a printed sleeve edge.
  for (let i = 0; i < n; i++) { set(i, 0, P.shadow); set(i, n - 1, P.shadow); set(0, i, P.shadow); set(n - 1, i, P.shadow); }
  return { grid, scene, dusk };
}

// Palette indices → RGBA pixels at `scale`× (nearest neighbour).
export function gridToRgba(grid, size, palette, scale = 1) {
  const out = new Uint8ClampedArray(size * scale * size * scale * 4), width = size * scale;
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const [r, g, b] = palette[grid[Math.floor(y / scale) * size + Math.floor(x / scale)]], i = (y * width + x) * 4;
    out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
  }
  return out;
}

// ---------- browser renderers ----------
const OUT = 256;
function paletteFromDocument() { try { return readPalette(getComputedStyle(document.documentElement)); } catch { return readPalette(null); } }
function gridToDataUrl(grid, palette) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = OUT;
  const context = canvas.getContext('2d');
  context.putImageData(new ImageData(gridToRgba(grid, GRID, palette, OUT / GRID), OUT, OUT), 0, 0);
  return canvas.toDataURL('image/png');
}
export function generatedCover(item) { return gridToDataUrl(proceduralGrid(item).grid, paletteFromDocument()); }

// createImageBitmap rejects SVG; inline / same-origin art can still be drawn
// through an <img> without tainting the canvas.
function loadElement(src) {
  let local = false; try { const url = new URL(src, location.href); local = ['data:', 'blob:'].includes(url.protocol) || url.origin === location.origin; } catch {}
  if (!local) return null;
  return new Promise((resolve) => { const image = new Image(); image.onload = () => resolve(image.naturalWidth ? Object.assign(image, { width: image.naturalWidth, height: image.naturalHeight }) : null); image.onerror = () => resolve(null); image.src = src; });
}
// Returns { cover, method: 'pixelated' | 'generated', reason? }. Cross-origin
// artwork without CORS cannot be read back; we say so instead of faking it.
export async function pixelCover(item, { source = item?.cover } = {}) {
  const palette = paletteFromDocument();
  if (!source) return { cover: gridToDataUrl(proceduralGrid(item).grid, palette), method: 'generated', reason: '没有原封面，按专辑名生成。' };
  try {
    // Same path as the album wall: local/inline art directly, catalog art via
    // the desktop image proxy, so its pixels may be read back.
    const image = await loadWallCover(source) || await loadElement(source), side = Math.min(image?.width || 0, image?.height || 0);
    if (!side) throw new Error('原封面暂时无法读取。');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = GRID;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, GRID, GRID);
    const grid = quantize(context.getImageData(0, 0, GRID, GRID).data, GRID, palette);
    return { cover: gridToDataUrl(grid, palette), method: 'pixelated' };
  } catch (error) {
    const reason = error?.name === 'SecurityError' ? '原封面来自不允许读取像素的网站，改为按专辑名生成。' : `${error?.message || '原封面读取失败。'} 已按专辑名生成。`;
    return { cover: gridToDataUrl(proceduralGrid(item).grid, palette), method: 'generated', reason };
  }
}
