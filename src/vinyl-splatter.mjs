// One fixed organic radial stencil. Only palette assignment changes with 1–3 colours.
// Combined paths avoid hundreds of DOM nodes on a large shelf.
const cache = new Map();
const round = (value) => Math.round(value * 100) / 100;
export function radialSplatterLayers(count = 3) {
  count = Math.max(1, Math.min(3, Math.round(count)));
  if (cache.has(count)) return cache.get(count);
  const layers = Array.from({ length: count }, () => ({ paint: '', fine: '', drops: '', glints: '' }));
  const layerFor = (index) => { const rank = index * 7 % 20; return count === 1 ? 0 : count === 2 ? (rank < 13 ? 0 : 1) : rank < 11 ? 0 : rank < 17 ? 1 : 2; };
  for (let i = 0; i < 60; i++) {
    const angle = (i * 6 + (i * 13 % 7 - 3) * .65) * Math.PI / 180;
    const point = (radius, offset = 0) => `${round(100 + Math.sin(angle) * radius + Math.cos(angle) * offset)} ${round(100 - Math.cos(angle) * radius + Math.sin(angle) * offset)}`;
    const start = 31 + i * 7 % 10, end = 56 + i * 17 % 41, width = .6 + i * 11 % 9 * .26;
    const layer = layers[layerFor(i)];
    layer.paint += `M${point(start, -width)} C${point(start + 14, -width * 1.25)} ${point(end - 13, -width * .5)} ${point(end - 4, -.4)} Q${point(end + 2, -.8)} ${point(end, .8)} C${point(end - 7, width * 1.3)} ${point(start + 9, width * .4)} ${point(start, width)}Z`;
    layer.glints += `M${point(start + 4, -width * .45)} Q${point((start + end) / 2, -width * .6)} ${point(end - 5, -.2)}`;
  }
  for (let i = 0; i < 96; i++) {
    const angle = (i * 137.508) * Math.PI / 180;
    const point = (radius, offset = 0) => `${round(100 + Math.sin(angle) * radius + Math.cos(angle) * offset)} ${round(100 - Math.cos(angle) * radius + Math.sin(angle) * offset)}`;
    const layer = layers[layerFor(i)], end = 55 + i * 19 % 44;
    layer.fine += `M${point(35 + i % 10)} Q${point(60, i % 3 - 1)} ${point(end)}`;
    if (i % 2 === 0) {
      const radius = 59 + i * 13 % 38, dot = .25 + i % 4 * .17;
      layer.drops += `M${point(radius, -dot)} a${dot} ${dot} 0 1 0 ${dot * 2} 0 a${dot} ${dot} 0 1 0 ${-dot * 2} 0`;
    }
  }
  cache.set(count, layers); return layers;
}
