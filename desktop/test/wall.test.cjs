'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { createSiteRouter } = require('../site-router.cjs');
test('wall settings bound expensive dimensions and preserve optional metadata', async () => {
  const { normalizeWall, wallGeometry, orderAlbums, readWall } = await import('../../src/album-wall-model.mjs');
  const options = normalizeWall({ columns: 999, margin: -99, gap: -1, scale: 20, title: '', showNames: false, font: '";evil' });
  assert.equal(options.columns, 12); assert.equal(options.margin, 0); assert.equal(options.scale, 3); assert.equal(options.title, ''); assert.equal(options.font, 'bundled');
  const grid = wallGeometry(13, { columns: 4, gap: 10 }); assert.equal(grid.cells.length, 13); assert.equal(grid.cells[4].x, grid.cells[0].x); assert.ok(grid.cells[4].y > grid.cells[0].y);
  const ranked = wallGeometry(20, { columns: 5, layout: 'ranked' }); assert.ok(ranked.cells[0].size > ranked.cells[3].size);
  const items = [{ title: 'B', artist: 'x', type: 'album', cover: '' }, { title: 'A', artist: 'y', type: 'album', cover: '' }];
  assert.deepEqual(orderAlbums(items, 'title').map((i) => i.title), ['A', 'B']); assert.deepEqual(items.map((i) => i.title), ['B', 'A']);
  const draft = readWall({ getItem: () => JSON.stringify({ selected: [...items, items[0], { type: 'song', title: 'song' }], options: {} }) }); assert.equal(draft.selected.length, 2);
});
test('desktop cover transport permits real catalog artwork and refuses arbitrary hosts/documents', async () => {
  const seen = [], router = createSiteRouter({ webRoot: path.join(__dirname, 'fixtures/web'), qq: {}, forward: async (request) => { seen.push(request.url); return new Response('cover', { headers: { 'Content-Type': request.url.includes('document') ? 'text/html' : 'image/jpeg' } }); } });
  const request = (url) => new Request('https://album-circle.vercel.app/desktop-image?url=' + encodeURIComponent(url));
  assert.equal((await router(request('https://127.0.0.1/private'))).status, 400); assert.equal((await router(request('https://y.gtimg.cn.evil.example/image.jpg'))).status, 400);
  assert.equal((await router(request('https://user:pass@y.gtimg.cn/image.jpg'))).status, 400); assert.equal((await router(request('https://y.gtimg.cn/document'))).status, 502);
  const image = await router(request('https://y.gtimg.cn/music/photo_new/album.jpg')); assert.equal(image.status, 200); assert.equal(await image.text(), 'cover'); assert.equal(seen.length, 2);
});
