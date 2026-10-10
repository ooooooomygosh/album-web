// Renders the app icons from the pixel cat sprite (desktop PNG / ICO, tray,
// favicon) and the README pose sheet. Run: npm run icons
import zlib from 'node:zlib';
import fs from 'node:fs';
import { catFrame, PALETTE, POSES, SIZE } from '../src/pet/cat-sprites.mjs';

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (bytes) => { let r = 0xffffffff; for (const b of bytes) r = table[(r ^ b) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4); data.copy(out, 8); out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length); return out; };

function icon(size, transparent = false) {
  const frame = catFrame('idle', 0, 'headphones'), scale = Math.max(1, Math.floor(size * (transparent ? 1 : .7) / SIZE)), offset = Math.floor((size - SIZE * scale) / 2);
  const [br, bg, bb] = hex('#3a2416'), [gr, gg, gb] = hex('#a8612a');
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const glow = Math.max(0, 1 - Math.hypot(x - size / 2, y - size * .62) / (size * .62)); // Warm fireplace glow.
      let r = br + (gr - br) * glow, g = bg + (gg - bg) * glow, b = bb + (gb - bb) * glow;
      const px = Math.floor((x - offset) / scale), py = Math.floor((y - offset) / scale);
      const colour = px >= 0 && py >= 0 && px < SIZE && py < SIZE ? PALETTE[frame[py][px]] : null;
      if (colour) [r, g, b] = hex(colour);
      const o = y * (size * 4 + 1) + 1 + x * 4; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = transparent && !colour ? 0 : 255;
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const write = (target, data) => fs.writeFileSync(new URL(target, import.meta.url), data);
write('../public/icons/icon-192.png', icon(192));
write('../public/icons/icon-512.png', icon(512));
write('../desktop/assets/icon.png', icon(1024));
write('../desktop/assets/tray.png', icon(32, true)); // Tray and menu bar size.
// A Windows ICO holding one 256 px PNG image.
const png = icon(256), header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[6] = 0; header[7] = 0; header[8] = 0; header[9] = 0; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
write('../desktop/assets/icon.ico', Buffer.concat([header, png]));

// README pose sheet: the first frame of every pose, one accessory each.
function poseSheet() {
  const poses = Object.keys(POSES), accessories = ['', 'headphones', 'scarf', 'beanie', 'headphones', ''], scale = 6, cell = (SIZE + 4) * scale;
  const width = cell * poses.length, height = cell, raw = Buffer.alloc((width * 4 + 1) * height);
  const [br, bg, bb] = hex('#2e1d12');
  poses.forEach((pose, column) => {
    const frame = catFrame(pose, pose === 'groove' ? 2 : pose === 'celebrate' ? 1 : 0, accessories[column]);
    for (let y = 0; y < height; y++) for (let x = 0; x < cell; x++) {
      const px = Math.floor((x - 2 * scale) / scale), py = Math.floor((y - 2 * scale) / scale);
      const colour = px >= 0 && py >= 0 && px < SIZE && py < SIZE ? PALETTE[frame[py][px]] : null;
      const [r, g, b] = colour ? hex(colour) : [br, bg, bb], o = y * (width * 4 + 1) + 1 + (column * cell + x) * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  });
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
fs.mkdirSync(new URL('../docs/images/', import.meta.url), { recursive: true });
write('../docs/images/cat-poses.png', poseSheet());

// Tray / menu-bar icons, one per pet so the icon follows the chosen companion.
// macOS: template images (black + alpha, @1x 16 px and @2x 32 px) that the menu
// bar tints for light/dark. Windows: a colour ICO with 16 / 32 px PNG frames.
{
  const { petFrame, PET_PALETTES } = await import('../src/pet/pet-sprites.mjs');
  const { PETS } = await import('../src/pet/pet-catalog.mjs');
  const png = (size, pixel) => {
    const raw = Buffer.alloc((size * 4 + 1) * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const c = pixel(x, y), o = y * (size * 4 + 1) + 1 + x * 4; if (c) { raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = c[3]; } }
    const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  };
  // Crop to the painted pixels so small icons stay legible, then nearest-sample.
  const sampler = (frame, size) => {
    let x0 = SIZE, y0 = SIZE, x1 = 0, y1 = 0;
    frame.forEach((row, y) => row.forEach((v, x) => { if (v) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }));
    const side = Math.max(x1 - x0, y1 - y0) + 1, ox = x0 - Math.floor((side - (x1 - x0 + 1)) / 2), oy = y0 - Math.floor((side - (y1 - y0 + 1)) / 2);
    return (x, y) => frame[oy + Math.floor(y * side / size)]?.[ox + Math.floor(x * side / size)] || 0;
  };
  fs.mkdirSync(new URL('../desktop/assets/tray/', import.meta.url), { recursive: true });
  for (const { id } of PETS) {
    const frame = petFrame(id, 'idle', 0, ''), palette = PET_PALETTES[id];
    const template = (size) => { const at = sampler(frame, size); return png(size, (x, y) => { const v = at(x, y); return v && v !== 6 && v !== 7 ? [0, 0, 0, v === 1 ? 255 : 210] : null; }); };
    const colour = (size) => { const at = sampler(frame, size); return png(size, (x, y) => { const v = at(x, y), c = v && palette[v]; return c ? [...hex(c), 255] : null; }); };
    write(`../desktop/assets/tray/${id}Template.png`, template(16));
    write(`../desktop/assets/tray/${id}Template@2x.png`, template(32));
    write(`../desktop/assets/tray/${id}.png`, colour(32));
    const frames = [colour(16), colour(32)], head = Buffer.alloc(6 + 16 * frames.length);
    head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(frames.length, 4);
    let offset = head.length;
    frames.forEach((data, i) => { const e = 6 + i * 16, size = i ? 32 : 16; head[e] = size; head[e + 1] = size; head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12); offset += data.length; });
    write(`../desktop/assets/tray/${id}.ico`, Buffer.concat([head, ...frames]));
  }
}
