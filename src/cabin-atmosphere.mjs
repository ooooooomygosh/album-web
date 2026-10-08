// Original scene-specific animation. Coordinates are in the unchanged 1448×1086 artwork.
export const ATMOSPHERE = {
  warm: { window: { x: 188, y: 170, width: 218, height: 286 }, panes: [[2, 3, 99, 109], [115, 3, 98, 109], [2, 124, 99, 156], [115, 124, 98, 156]], fire: { x: 1354, y: 538, width: 94, height: 180 }, opening: [[8, 8], [94, 24], [94, 171], [8, 155]] },
  pixel: { window: { x: 188, y: 170, width: 218, height: 286 }, panes: [[5, 7, 94, 102], [115, 7, 91, 102], [5, 126, 94, 157], [115, 126, 91, 157]], fire: { x: 1354, y: 538, width: 94, height: 192 }, opening: [[9, 13], [94, 18], [94, 188], [9, 172]] }
};
const fract = (value) => value - Math.floor(value);
const hash = (index) => fract(Math.sin(index * 127.1 + 311.7) * 43758.5453);
// Continuous value noise: no per-frame random jumps and no fixed repeating flicker cycle.
export function gentleNoise(time, seed = 1) {
  const cell = Math.floor(time), part = fract(time), weight = part * part * (3 - 2 * part);
  return hash(cell + seed * 101) * (1 - weight) + hash(cell + 1 + seed * 101) * weight;
}
export function atmosphereFrame(seconds, look = 'warm', weather = 'snow') {
  const geometry = ATMOSPHERE[look] || ATMOSPHERE.warm, { width, height } = geometry.window;
  const snow = weather === 'snow' ? Array.from({ length: 64 }, (_, i) => {
    const depth = hash(i + 9), speed = 9 + depth * 21;
    return { x: fract(hash(i + 21) + Math.sin(seconds * .21 + i) * .035 + seconds * (.003 + depth * .002)) * width,
      y: (hash(i + 61) * height + seconds * speed) % height, radius: .6 + depth * 1.25, alpha: .28 + depth * .48 };
  }) : [];
  const heat = gentleNoise(seconds * .23, 87) * .7 + gentleNoise(seconds * .51, 92) * .3;
  return { snow, light: .065 + heat * .045, surfaces: surfaceLighting(seconds) };
}
// A single bounded loop for both canvases and the composited light. Hidden windows
// retain their last frame; reduced motion draws a steady representative frame.
export function createAtmosphereLoop({ draw, request, cancel, now }) {
  let handle = null, disposed = false, mode = '', elapsed = 0, previous = 0, lastPaint = -Infinity;
  function tick(timestamp) {
    handle = null; if (disposed || mode !== 'running') return;
    elapsed += Math.min(100, Math.max(0, timestamp - previous)); previous = timestamp;
    if (timestamp - lastPaint >= 1000 / 24) { draw(elapsed / 1000); lastPaint = timestamp; }
    handle = request(tick);
  }
  return {
    setMode(next) {
      if (disposed || next === mode) return;
      if (handle !== null) cancel(handle); handle = null; mode = next;
      if (next === 'reduced') draw(0);
      if (next === 'running') { previous = now(); lastPaint = -Infinity; handle = request(tick); }
    },
    dispose() { disposed = true; if (handle !== null) cancel(handle); handle = null; }
  };
}

// Hand-authored 2.5D surface samples for this fixed camera. These are not inferred
// scene normals or ray-traced shadows: masks supply occlusion, normals supply incidence.
export const MATERIAL_SURFACES = {
  stone: { position: [1280, 648, 30], normal: [1, 0, .3], albedo: .8, roughness: .95, specular: .02 },
  floor: { position: [1110, 864, 220], normal: [0, -1, 0], albedo: .65, roughness: .72, specular: .06 },
  wood: { position: [1118, 609, 30], normal: [1, 0, .2], albedo: .42, roughness: .78, specular: .025 },
  metal: { position: [1344, 652, 35], normal: [.35, 0, 1], albedo: .18, roughness: .24, specular: .65 },
  glass: { position: [1364, 584, 30], normal: [.18, .15, 1], albedo: .035, roughness: .12, specular: .8 }
};
const unit = (v) => { const length = Math.hypot(...v) || 1; return v.map((x) => x / length); };
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
export function materialResponse(surface, source, energy) {
  const delta = source.map((value, i) => value - surface.position[i]), distance = Math.hypot(...delta);
  const normal = unit(surface.normal), light = unit(delta), incidence = Math.max(0, dot(normal, light));
  if (!incidence) return 0;
  const view = unit([724 - surface.position[0], 543 - surface.position[1], 1600 - surface.position[2]]);
  const half = unit(light.map((value, i) => value + view[i]));
  const specular = Math.pow(Math.max(0, dot(normal, half)), 8 + (1 - surface.roughness) * 72) * surface.specular;
  return Math.min(.18, energy / (1 + (distance / 520) ** 2) * (surface.albedo * incidence + specular));
}
export function surfaceLighting(seconds) {
  const heat = gentleNoise(seconds * .23, 87) * .7 + gentleNoise(seconds * .51, 92) * .3;
  const source = [1432 + (gentleNoise(seconds * .31, 21) - .5) * 8, 655 + (gentleNoise(seconds * .27, 62) - .5) * 10, 160];
  return Object.fromEntries(Object.entries(MATERIAL_SURFACES).map(([name, surface]) => [name, materialResponse(surface, source, .12 + heat * .065)]));
}
