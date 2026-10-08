import { wallGeometry, normalizeWall } from './album-wall-model.mjs';
const cache = new Map();
export async function loadWallCover(value, desktop = false) {
  if (!value) return null;
  if (!cache.has(value)) cache.set(value, (async () => {
    try {
      const external = new URL(value, window.location.href).origin !== window.location.origin;
      const target = desktop ? `/desktop-image?url=${encodeURIComponent(value)}` : external ? `/api/cover?url=${encodeURIComponent(value)}` : value;
      const response = await fetch(target, { credentials: 'omit', signal: AbortSignal.timeout(18000) });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/') || blob.size > 8 * 1024 * 1024) return null;
      return await createImageBitmap(blob);
    } catch { return null; }
  })());
  // Bound decoded artwork memory. Current selection keeps its own references.
  if (cache.size > 150) { const first = cache.keys().next().value; cache.delete(first); }
  return cache.get(value);
}
function wrap(context, text, width) {
  const lines = []; let line = '';
  for (const character of String(text)) { const next = line + character; if (line && context.measureText(next).width > width) { lines.push(line.trim()); line = character; } else line = next; }
  if (line) lines.push(line.trim());
  return lines;
}
export async function paintWall(canvas, albums, value, images, requestedScale = 1) {
  const o = normalizeWall(value), geometry = wallGeometry(albums.length, o);
  const family = o.font === 'bundled' ? 'HarmonyOS Sans SC Bundled' : o.font;
  await Promise.all([document.fonts.load(`400 22px ${JSON.stringify(family)}`), document.fonts.load(`700 42px ${JSON.stringify(family)}`)]);
  let ctx = canvas.getContext('2d'); ctx.font = `400 22px ${JSON.stringify(family)}, sans-serif`;
  const lines = albums.map((album, index) => ({ index, title: o.showNames ? wrap(ctx, album.title, 318) : [], artist: o.showArtists ? wrap(ctx, album.artist, 318) : [] }));
  const listHeight = lines.reduce((sum, line) => sum + line.title.length * 29 + line.artist.length * 26 + 20, 0);
  const height = Math.ceil(Math.max(geometry.height, geometry.listTop + listHeight + o.margin)), width = Math.ceil(geometry.width), scale = requestedScale;
  if (width * scale > 8192 || height * scale > 8192 || width * height * scale * scale > 36000000) throw new Error('图片过大，请增加列数、减少专辑或降低下载倍率。');
  canvas.width = width * scale; canvas.height = height * scale; ctx = canvas.getContext('2d'); ctx.scale(scale, scale);
  ctx.fillStyle = o.background; ctx.fillRect(0, 0, width, height); ctx.fillStyle = o.textColor; ctx.textBaseline = 'top';
  let titleY = o.margin;
  if (o.title) { ctx.font = `700 42px ${JSON.stringify(family)}, sans-serif`; ctx.fillText(o.title, o.margin, titleY, geometry.contentWidth); titleY += 66; }
  if (o.author) { ctx.font = `400 24px ${JSON.stringify(family)}, sans-serif`; ctx.fillText(o.author, o.margin, titleY, geometry.contentWidth); }
  for (const cell of geometry.cells) {
    const image = images[cell.index], album = albums[cell.index];
    ctx.fillStyle = o.textColor; ctx.fillRect(cell.x, cell.y, cell.size, cell.size);
    const inset = o.border, size = cell.size - inset * 2;
    if (image) { const side = Math.min(image.width, image.height); ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, cell.x + inset, cell.y + inset, size, size); }
    else { ctx.fillStyle = '#344144'; ctx.fillRect(cell.x + inset, cell.y + inset, size, size); ctx.fillStyle = '#f0f5f1'; ctx.font = `400 18px ${JSON.stringify(family)}, sans-serif`; wrap(ctx, album.title, size - 28).slice(0, 5).forEach((line, index) => ctx.fillText(line, cell.x + 14, cell.y + 22 + 26 * index)); }
  }
  if (o.showNames || o.showArtists) {
    let y = geometry.listTop;
    for (const line of lines) {
      ctx.fillStyle = o.textColor; ctx.globalAlpha = .56; ctx.font = `400 18px ${JSON.stringify(family)}, sans-serif`; ctx.fillText(String(line.index + 1).padStart(2, '0'), geometry.listX, y + 3); ctx.globalAlpha = 1;
      ctx.font = `700 22px ${JSON.stringify(family)}, sans-serif`;
      line.title.forEach((text) => { ctx.fillText(text, geometry.listX + 42, y); y += 29; });
      ctx.font = `400 21px ${JSON.stringify(family)}, sans-serif`; ctx.globalAlpha = .7;
      line.artist.forEach((text) => { ctx.fillText(text, geometry.listX + 42, y); y += 26; }); ctx.globalAlpha = 1; y += 20;
    }
  }
  return { width: canvas.width, height: canvas.height, missing: images.filter((image) => !image).length };
}
export function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
