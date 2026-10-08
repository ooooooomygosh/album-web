'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
test('purchase records accept actual calendar dates and only CD or vinyl', async () => {
  const { validPurchase, readPurchases } = await import('../../src/purchase-records.mjs');
  assert.ok(validPurchase({ date: '2024-02-29', format: 'cd' }));
  assert.equal(validPurchase({ date: '2025-02-29', format: 'vinyl' }), false);
  assert.equal(validPurchase({ date: '2026-10-08', format: 'mp3' }), false);
  assert.deepEqual(readPurchases({ getItem: () => '{broken' }), {});
  assert.deepEqual(readPurchases({ getItem: () => JSON.stringify({ 'qq:one': { date: '2026-10-08', format: 'vinyl' }, 'qq:two': { date: '2026-02-31', format: 'cd' } }) }), { 'qq:one': { date: '2026-10-08', format: 'vinyl' } });
});
test('the same QQ album keeps purchase identity across room item IDs', async () => {
  const { purchaseAlbumKey } = await import('../../src/purchase-records.mjs');
  assert.equal(purchaseAlbumKey({ id: 'room-a', externalIds: { qqAlbumMid: '000MkMni19ClKG' } }), purchaseAlbumKey({ id: 'room-b', externalIds: { qqAlbumMid: '000MkMni19ClKG' } }));
});
