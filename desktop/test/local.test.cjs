'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
test('local collection needs no cloud credentials and persists across requests', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'album-local-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const api = require('../local-api.cjs').createLocalAPI(directory), session = await api.bootstrap();
  const request = (pathname, body, token = session.token) => api.route(new Request('https://album-circle.vercel.app' + pathname, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) }));
  assert.match(session.token, /^local-/);
  assert.equal((await request('/api/items?roomId=local-room', undefined, 'invalid')).status, 401);
  const result = await (await request('/api/items?roomId=local-room', { type: 'album', title: '离线专辑', artist: '本地歌手', tracks: ['第一首'], trackDetails: [{ title: '第一首', providerId: '001n4C3p1yv0FU' }] })).json();
  assert.equal(result.item.title, '离线专辑');
  const list = await (await request('/api/items?roomId=local-room')).json();
  assert.equal(list.items.length, 1); assert.equal(list.items[0].trackDetails[0].providerId, '001n4C3p1yv0FU');
  assert.ok(fs.readFileSync(path.join(directory, 'collection.json'), 'utf8').includes('离线专辑'));
  const settings = await (await request('/api/auth', { action: 'updateSettings', settings: { showroom: { style: 'room' } } })).json();
  assert.equal(settings.user.settings.showroom.style, 'room');
  const fallback = await (await request('/api/ai/background', { item: list.items[0] })).json();
  assert.equal(fallback.fallback, true);
});
test('share snapshot keeps selected-room visuals and strips credentials and unrelated collections', async () => {
  const { cleanSharedRoom } = await import('../../lib/shared-room.js');
  const snapshot = cleanSharedRoom({ roomId: 'local-room', name: '我的木屋', token: 'PRIVATE', items: [{ id: 'one', type: 'album', title: '收藏', artist: '歌手', token: 'PRIVATE', externalIds: { qqAlbumMid: 'original' } }], library: { styles: { 'qq:original': { base: '#aabbcc' }, 'qq:private': { base: '#ffffff' } }, rooms: { 'local-room': { look: 'pixel', boxes: [] }, private: { look: 'warm', boxes: [] } } }, appearance: { showroom: 'room', maToken: 'PRIVATE' } });
  assert.equal(snapshot.library.rooms.shared.look, 'pixel'); assert.equal(snapshot.appearance.showroom, 'room');
  assert.deepEqual(Object.keys(snapshot.library.styles), ['qq:original']); assert.deepEqual(Object.keys(snapshot.library.rooms), ['shared']);
  assert.equal(JSON.stringify(snapshot).includes('PRIVATE'), false);
});
test('optional cloud sync forwards only fixed API routes and preserves session authorization', async () => {
  const { createSiteRouter } = require('../site-router.cjs'); let seen;
  const router = createSiteRouter({ webRoot: path.join(__dirname, 'fixtures/web'), localAPI: {}, getAppearance: () => ({ connectionMode: 'local' }), qq: {}, forward: async (request) => { seen = request; return Response.json({ ok: true }); } });
  await router(new Request('https://album-circle.vercel.app/desktop-cloud/api/rooms', { method: 'POST', headers: { Authorization: 'Bearer test-cloud-token' }, body: JSON.stringify({ name: '同步房间' }) }));
  assert.equal(seen.url, 'https://album-circle.vercel.app/api/rooms'); assert.equal(seen.headers.get('authorization'), 'Bearer test-cloud-token');
  assert.equal((await seen.json()).name, '同步房间');
  assert.equal((await router(new Request('https://album-circle.vercel.app/desktop-cloud/api/admin'))).status, 400);
});
test('public shares need no login to view and only the publishing owner can revoke them', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'album-share-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  process.env.ALBUM_CIRCLE_LOCAL_FIRESTORE = '1'; process.env.ALBUM_CIRCLE_LOCAL_FIRESTORE_FILE = path.join(directory, 'shares.json');
  const { db, hashSecret } = await import('../../api/_firebase.js'), handler = (await import('../../api/shared.js')).default;
  await db().collection('albumCircleUsers').doc('publisher').set({ name: 'Publisher', sessionHashes: [hashSecret('publisher-token')] });
  await db().collection('albumCircleUsers').doc('other').set({ sessionHashes: [hashSecret('other-token')] });
  const call = async (method, query = {}, body = {}, token = '') => { let code, data; const res = { status(value) { code = value; return this; }, setHeader() { return this; }, end(value) { data = JSON.parse(value); } }; await handler({ method, query, body, headers: token ? { authorization: 'Bearer ' + token } : {} }, res); return { code, data }; };
  const created = await call('POST', {}, { snapshot: { name: 'Share', items: [{ title: 'Album', artist: 'Artist' }] } }, 'publisher-token');
  assert.equal(created.code, 201);
  assert.equal((await call('GET', { id: created.data.id })).data.snapshot.name, 'Share');
  assert.equal((await call('DELETE', { id: created.data.id }, {}, 'other-token')).code, 403);
  assert.equal((await call('DELETE', { id: created.data.id }, {}, 'publisher-token')).code, 200);
  assert.equal((await call('GET', { id: created.data.id })).code, 404);
});
