// Desktop widget positions, stored as fractions of the room so a layout made
// on a laptop still makes sense on a 4K monitor. Pure helpers for tests.
export const WIDGET_KEY = 'album-circle-desktop-widgets-v1';
export const WIDGET_IDS = ['clock', 'music', 'focus', 'todo'];
export const defaultWidgetLayout = () => ({ clock: { x: .025, y: .04 }, music: { x: .025, y: .72 }, focus: { x: .77, y: .06 }, todo: { x: .77, y: .3 } });
const fraction = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(.98, Number(value))) : fallback;
export function clampWidget(position, width = .2, height = .15) {
  return { x: Math.max(0, Math.min(1 - Math.min(width, 1), fraction(position?.x, 0))), y: Math.max(0, Math.min(1 - Math.min(height, 1), fraction(position?.y, 0))) };
}
export function normalizeWidgetLayout(value) {
  const base = defaultWidgetLayout(), raw = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(WIDGET_IDS.map((id) => [id, { x: fraction(raw[id]?.x, base[id].x), y: fraction(raw[id]?.y, base[id].y) }]));
}
export function readWidgetLayout(storage = globalThis.localStorage) { try { return normalizeWidgetLayout(JSON.parse(storage.getItem(WIDGET_KEY))); } catch { return defaultWidgetLayout(); } }
export function writeWidgetLayout(layout, storage = globalThis.localStorage) { try { storage.setItem(WIDGET_KEY, JSON.stringify(normalizeWidgetLayout(layout))); } catch {} }
