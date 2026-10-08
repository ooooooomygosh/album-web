// Renders the PWA icons from the pixel cat sprite. Run: node scripts/generate-pwa-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import { catFrame, PALETTE, SIZE } from '../src/pet/cat-sprites.mjs';

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (bytes) => { let r = 0xffffffff; for (const b of bytes) r = table[(r ^ b) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4); data.copy(out, 8); out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length); return out; };

function icon(size) {
  const frame = catFrame('idle', 0, 'headphones'), scale = Math.floor(size * .7 / SIZE), offset = Math.floor((size - SIZE * scale) / 2);
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
      const o = y * (size * 4 + 1) + 1 + x * 4; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
for (const size of [192, 512]) fs.writeFileSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url), icon(size));
