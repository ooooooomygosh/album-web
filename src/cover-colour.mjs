import { DEFAULT_RECORD_STYLE } from './record-library.mjs';

// Most populated RGB bucket, averaged within that bucket. Transparent pixels
// do not vote; unlike a global average, opposing colours cannot turn to grey.
export function dominantColour(pixels) {
  const buckets = new Map();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bucket.count++; bucket.r += r; bucket.g += g; bucket.b += b; buckets.set(key, bucket);
  }
  const winner = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  return winner ? '#' + ['r', 'g', 'b'].map((channel) => Math.round(winner[channel] / winner.count).toString(16).padStart(2, '0')).join('') : DEFAULT_RECORD_STYLE.base;
}
