export const PURCHASE_STORAGE_KEY = 'album-circle-purchases-v1';
export function purchaseAlbumKey(item) {
  if (item.externalIds?.qqAlbumMid) return `qq:${item.externalIds.qqAlbumMid}`;
  if (item.collectionId) return `itunes:${item.collectionId}`;
  return `item:${item.id}`;
}
export function validPurchase(record) {
  if (!record || !['cd', 'vinyl'].includes(record.format) || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return false;
  const date = new Date(`${record.date}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === record.date;
}
export function readPurchases(storage) {
  try {
    const value = storage.getItem(PURCHASE_STORAGE_KEY);
    if (!value || value.length > 512000) return {};
    const records = JSON.parse(value);
    if (!records || typeof records !== 'object' || Array.isArray(records)) return {};
    return Object.fromEntries(Object.entries(records).filter(([key, record]) => /^(qq|itunes|item):/.test(key) && validPurchase(record)).slice(0, 5000));
  } catch { return {}; }
}
