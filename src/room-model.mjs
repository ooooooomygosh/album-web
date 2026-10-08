export const ROOM_SIZE = { width: 1448, height: 1086 };
export const SHELF = {
  warm: { columns: [[437, 156], [604, 162], [776, 164], [949, 163]], rows: [[200, 155], [371, 154], [536, 158]] },
  pixel: { columns: [[445, 150], [606, 160], [776, 161], [946, 160]], rows: [[208, 150], [374, 152], [542, 159]] }
};
export function roomGeometry(width, height, safeArea) {
  // Fill both edges. Keep the cabinet's centre anchored while the floor is cropped.
  const coverScale = Math.max(width / ROOM_SIZE.width, height / ROOM_SIZE.height);
  const safeTop = Math.max(0, safeArea?.top || 0), safeBottom = Math.max(0, safeArea?.bottom || 0);
  const scale = safeArea ? Math.min(coverScale, Math.max(100, height - safeTop - safeBottom) / 501) : coverScale;
  const artWidth = ROOM_SIZE.width * scale, artHeight = ROOM_SIZE.height * scale;
  const left = artWidth < width ? (width - artWidth) / 2 : Math.max(width - artWidth, Math.min(0, width / 2 - 774 * scale));
  let top = Math.max(height - artHeight, Math.min(0, height / 2 - 448 * scale));
  if (safeArea) top = Math.max(safeTop - 200 * scale, Math.min(top, height - safeBottom - 701 * scale));
  return { width: artWidth, height: artHeight, left, top };
}
export function shelfWindow(items, row) {
  const rows = Math.ceil(items.length / 4), maxRow = Math.max(0, rows - 3);
  const startRow = Math.max(0, Math.min(maxRow, Math.round(row) || 0));
  return { startRow, maxRow, rows, items: items.slice(startRow * 4, startRow * 4 + 12) };
}
export function trackNames(item) {
  const tracks = Array.isArray(item?.tracks) ? item.tracks : [];
  return tracks.map((track) => typeof track === 'string' ? track : track?.title || track?.name || '').filter(Boolean);
}
