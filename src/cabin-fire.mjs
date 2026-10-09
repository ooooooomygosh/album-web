// A small advected combustion texture for the fixed-camera hearth. No external
// images, shaders or frame-dependent random walks. Warm and pixel use different
// sampling/palettes, and the scene owns the final firebox/occlusion mask.
const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
const lattice = new Float32Array(128 * 128);
for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) lattice[y * 128 + x] = hash(x, y);
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = lattice[(iy & 127) * 128 + (ix & 127)], b = lattice[(iy & 127) * 128 + ((ix + 1) & 127)];
  const c = lattice[((iy + 1) & 127) * 128 + (ix & 127)], d = lattice[((iy + 1) & 127) * 128 + ((ix + 1) & 127)];
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
export function fireSample(x, rise, seconds) {
  if (rise < -.08 || rise > 1) return { heat: 0, alpha: 0 };
  const h = Math.max(0, rise);
  // Flow coordinates move downward through the sampling field: the visible
  // texture travels upward. Two nested warps create rolling eddies, not swaying
  // triangles. Increasing breakup with height lets tips split and disappear.
  const flow = h * 3.9 - seconds * 1.22;
  const eddy = noise(x * 4.7 + 3, flow * .7 + 19);
  const warp = (eddy - .5) * (.08 + h * .48);
  const u = x + warp;
  const broad = noise(u * 6.8 + 11, flow + 7);
  const fine = noise(u * 17.5 + eddy * 2.8, flow * 2.35 + 31);
  const fibre = noise(u * 36 + broad * 3, flow * 3.7 + 61);
  // Uneven fuel sources over the logs. The root is continuous, but individual
  // plumes merge and separate above it rather than repeating an even row.
  const fuel = .64 + .24 * noise(x * 8 + 21, seconds * .38 + 9);
  const height = .42 + .42 * noise(u * 3.2 + 5, seconds * .51 + 14);
  const edge = smooth(0, .11, x) * (1 - smooth(.96, 1.08, x));
  const plume = (1 - h / height) * fuel;
  const turbulence = (broad - .44) * (.3 + h * .98) + (fine - .48) * (.1 + h * .53) + (fibre - .5) * .07;
  const fissures = smooth(.52, .8, fine) * smooth(.12, .48, h) * .2;
  const density = plume + turbulence - fissures - .16;
  const root = (1 - smooth(0, .13, h)) * (.58 + fine * .28);
  const heat = clamp(Math.max(density, root) * edge);
  const alpha = smooth(.015, .15, heat) * (1 - smooth(.8, .99, h)) * smooth(-.065, -.005, rise);
  return { heat, alpha };
}
export function fillFireTexture(data, width, height, seconds, pixel = false) {
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / (width - 1), v = y / (height - 1);
    // Root follows the firebox's perspective and leaves charred logs visible.
    const fuelEdge = (noise(u * 9 + 4, 18) - .5) * .045;
    const rise = (.78 + u * .075 + fuelEdge - v) / .73;
    const sample = fireSample(u, rise, seconds), i = (y * width + x) * 4;
    let heat = sample.heat;
    if (pixel) heat = Math.round(heat * 7) / 7;
    const core = smooth(.43, .83, heat);
    data[i] = 255;
    data[i + 1] = Math.round(103 + 141 * smooth(.03, .73, heat));
    data[i + 2] = Math.round(9 + 184 * core);
    // A narrow hot edge, an opaque luminous core, and true empty gaps. Avoid
    // stacking translucent solid ribbons, which reads like plastic curtains.
    data[i + 3] = Math.round(255 * (pixel ? (sample.alpha > .48 ? 1 : 0) : sample.alpha));
  }
  return data;
}
export function createFirePainter(pixel) {
  const buffer = document.createElement('canvas'); buffer.width = pixel ? 26 : 112; buffer.height = pixel ? 48 : 208;
  const ctx = buffer.getContext('2d');
  if (!ctx) return null;
  let texture;
  try { texture = ctx.createImageData(buffer.width, buffer.height); } catch { return null; }
  return (target, width, height, seconds) => {
    fillFireTexture(texture.data, buffer.width, buffer.height, seconds, pixel); ctx.putImageData(texture, 0, 0);
    target.drawImage(buffer, 0, 0, width, height);
    // Charred front logs occlude the lower flame roots, with uneven narrow
    // ember seams. They sit entirely inside the existing firebox clip.
    target.save(); target.lineCap = pixel ? 'square' : 'round';
    for (const [x, y, end, dy] of [[11, height * .827, width * .62, 8], [width * .4, height * .86, width + 3, -5]]) {
      target.strokeStyle = '#20120d'; target.lineWidth = pixel ? 5 : 6;
      target.beginPath(); target.moveTo(x, y); target.lineTo(end, y + dy); target.stroke();
      target.strokeStyle = '#7d3213'; target.lineWidth = pixel ? 1 : .8;
      target.beginPath(); target.moveTo(x + 2, y - 1.7); target.lineTo(end - 2, y + dy - 1.4); target.stroke();
    }
    target.restore();
    // Sparse glowing cracks over the fuel bed; not floating confetti sparks.
    for (let i = 0; i < 21; i++) {
      const x = (i * 43.71 % 83) + 8, y = height * .85 + x * .045 + (i % 3) * 2;
      const glow = .25 + noise(i * 7, seconds * .7) * .55;
      target.fillStyle = `rgba(255,${Math.round(92 + glow * 95)},24,${glow})`;
      target.fillRect(x, y, pixel ? 3 : 1.7, pixel ? 2 : .8);
    }
  };
}
