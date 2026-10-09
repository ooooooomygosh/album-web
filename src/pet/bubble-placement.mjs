/** Collision-aware placement for the room cat's speech bubble.
 * `base` is the bubble's rect at its default spot (centred above the cat),
 * `cat` the cat's rect, `obstacles` rects it must not cover (record cells,
 * toolbar, console, footer, paging, focus panel). Returns the first candidate
 * with no overlap that stays on screen, else the least-bad one. */
export const BUBBLE_OBSTACLES = '.room-record-slot, .room-empty, .scene-deck, .app-titlebar, .cabin-toolbar > *, .room-turntable, .room-now-playing, .room-shelf-navigation, .focus-dock';
const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const shift = (r, dx, dy) => ({ left: r.left + dx, right: r.right + dx, top: r.top + dy, bottom: r.bottom + dy });
export function chooseBubbleOffset(base, cat, obstacles, view, gap = 6) {
  const w = base.right - base.left, h = base.bottom - base.top, catMid = (cat.top + cat.bottom) / 2;
  const toSide = (cat.right - cat.left) / 2 + w / 2 + gap, down = catMid - h / 2 - base.top;
  const candidates = [
    ['top', 0, 0], ['top', -(w / 2 - 14), 0], ['top', w / 2 - 14, 0],
    ['right', toSide, down], ['left', -toSide, down],
    ['top', 0, -h - gap], ['top', -(w / 2 - 14), -h - gap], ['top', w / 2 - 14, -h - gap]
  ];
  let best = null;
  for (const [side, dx, dy] of candidates) {
    const r = shift(base, dx, dy);
    const off = Math.max(0, view.left - r.left) + Math.max(0, r.right - view.right) + Math.max(0, view.top - r.top) + Math.max(0, r.bottom - view.bottom);
    const cost = obstacles.reduce((sum, o) => sum + area(r, o), 0) + off * h * 4;
    if (!best || cost < best.cost) best = { side, dx: Math.round(dx), dy: Math.round(dy), cost };
    if (cost === 0) break;
  }
  return best;
}

/** Choose where the room cat sits (and where its bubble goes) so neither covers
 * a record cell or a panel: floor spots along its baseline, or perched on top of
 * the turntable console. Keeps the current spot while it is still clear. */
export const CAT_OBSTACLES = BUBBLE_OBSTACLES;
const inset = (r, k) => { const dx = (r.right - r.left) * k, dy = (r.bottom - r.top) * k; return { left: r.left + dx, right: r.right - dx, top: r.top + dy, bottom: r.bottom }; };
export function chooseCatSpot({ cat, floorTop = cat.top, bubble, obstacles, consoleRect, view, home }) {
  const w = cat.right - cat.left, h = cat.bottom - cat.top;
  const spots = [];
  for (let x = view.left + 8; x <= view.right - w - 8; x += Math.max(8, w / 4)) spots.push({ perch: false, left: x, top: floorTop });
  if (consoleRect) for (let x = consoleRect.left; x <= consoleRect.right - w; x += Math.max(8, w / 4)) spots.push({ perch: true, left: x, top: consoleRect.top - h });
  const offscreen = (r) => Math.max(0, view.left - r.left) + Math.max(0, r.right - view.right) + Math.max(0, view.top - r.top) + Math.max(0, r.bottom - view.bottom);
  const evaluate = (spot) => {
    const body = inset({ left: spot.left, right: spot.left + w, top: spot.top, bottom: spot.top + h }, .14);
    let cost = obstacles.reduce((sum, o) => sum + area(body, o), 0) * 2 + offscreen(body) * h * 4, bubblePick = null;
    if (bubble) {
      const dx = spot.left - cat.left, dy = spot.top - cat.top;
      bubblePick = chooseBubbleOffset(shift(bubble, dx, dy), { left: spot.left, right: spot.left + w, top: spot.top, bottom: spot.top + h }, obstacles, view);
      cost += bubblePick.cost;
    }
    return { ...spot, cost, bubble: bubblePick, distance: Math.abs(spot.left - home) + (spot.perch ? w : 0) };
  };
  const current = evaluate({ perch: Boolean(cat.perch), left: cat.left, top: cat.top });
  if (current.cost === 0) return current;
  return spots.map(evaluate).reduce((best, s) => (s.cost < best.cost - 1 || (Math.abs(s.cost - best.cost) <= 1 && s.distance < best.distance)) ? s : best, current);
}
