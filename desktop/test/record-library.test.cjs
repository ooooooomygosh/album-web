const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = import('../../src/record-library.mjs');
test('record styles validate colour input and preserve full transparency', async () => {
  const { normalizeStyle } = await model;
  assert.deepEqual(normalizeStyle({ base: 'red; color: black', opacity: -9, splash: '#FFCC00', splatter: true }), { base: '#16191d', opacity: 0, splashes: ['#ffcc00'], splatter: true });
  assert.equal(normalizeStyle({ opacity: 999 }).opacity, 100);
  assert.deepEqual(normalizeStyle({ splashes: ['#FFCC00', 'bad', '#aabbcc', '#445566'] }).splashes, ['#ffcc00', '#efe3c1', '#aabbcc']);
  const { radialSplatterLayers } = await import('../../src/vinyl-splatter.mjs');
  assert.deepEqual(radialSplatterLayers(3).map((layer) => layer.paint.match(/M/g).length), [33, 18, 9]);
  assert.deepEqual(radialSplatterLayers(2).map((layer) => layer.paint.match(/M/g).length), [39, 21]);
  assert.equal(radialSplatterLayers(1)[0].paint.match(/M/g).length, 60);
});
test('box membership is by stable album identity, allowing more than one box', async () => {
  const { albumKey, matchesLibraryFilters, normalizeLibrary } = await model;
  const item = { id: 'one', externalIds: { qqAlbumMid: 'album-mid' } }, otherRoomItem = { ...item, id: 'two' };
  const key = albumKey(item), data = normalizeLibrary({ rooms: { room: { boxes: [{ id: 'a', name: '我的摇滚', keys: [key] }, { id: 'b', name: '周末', keys: [key] }] } } });
  assert.equal(albumKey(item), albumKey(otherRoomItem));
  assert.equal(matchesLibraryFilters(otherRoomItem, data, 'room', { box: 'a' }), true);
  assert.equal(matchesLibraryFilters(item, data, 'room', { box: 'b' }), true);
  assert.equal(matchesLibraryFilters(item, data, 'room', { box: 'unfiled' }), false);
  assert.equal(matchesLibraryFilters(item, data, 'other-room', { box: 'a' }), false);
});
test('genre, decade and provider filters combine and manual empty genre is respected', async () => {
  const { normalizeLibrary, matchesLibraryFilters, genresFor, albumKey } = await model;
  const item = { id: 'x', year: '2003', tags: ['album', 'qq', 'Rock'], externalIds: { qqAlbumMid: 'x' } }, data = normalizeLibrary();
  assert.deepEqual(genresFor(item, data), ['Rock']);
  assert.equal(matchesLibraryFilters(item, data, 'room', { genre: 'Rock', decade: '2000', provider: 'qq' }), true);
  assert.equal(matchesLibraryFilters(item, data, 'room', { genre: 'Jazz', decade: '2000' }), false);
  data.genres[albumKey(item)] = [];
  assert.deepEqual(genresFor(item, data), []);
  assert.equal(matchesLibraryFilters(item, data, 'room', { genre: 'unmarked' }), true);
});
test('library loading isolates accounts and rejects malformed or oversized records', async () => {
  const { readLibrary, LIBRARY_PREFIX, MAX_LIBRARY_BYTES } = await model;
  const values = new Map([[LIBRARY_PREFIX + 'a', JSON.stringify({ styles: { 'qq:test': { base: '#0faaaa' } } })]]);
  const storage = { getItem: (key) => values.get(key) };
  assert.equal(readLibrary(storage, 'a').styles['qq:test'].base, '#0faaaa');
  assert.deepEqual(readLibrary(storage, 'b').styles, {});
  values.set(LIBRARY_PREFIX + 'a', '[');
  assert.deepEqual(readLibrary(storage, 'a').rooms, {});
  values.set(LIBRARY_PREFIX + 'a', 'x'.repeat(MAX_LIBRARY_BYTES + 1));
  assert.deepEqual(readLibrary(storage, 'a').styles, {});
});
test('malformed rooms, duplicate boxes and script names never become executable preferences', async () => {
  const { normalizeLibrary, genreList } = await model;
  const data = normalizeLibrary(JSON.parse('{"rooms":{"__proto__":{"look":"pixel"},"a":null,"b":{"look":"bad","boxes":[{"id":"x","name":"  Jazz  ","keys":["qq:a","qq:a","bogus"]},{"id":"y","name":"jazz","keys":[]}]}}}'));
  assert.deepEqual(Object.keys(data.rooms), ['b']);
  assert.equal(data.rooms.b.look, 'pixel'); // The pixel cabin is the default look.
  assert.equal(data.rooms.b.boxes.length, 1);
  assert.deepEqual(data.rooms.b.boxes[0].keys, ['qq:a']);
  assert.equal(genreList('摇滚，摇滚,爵士').length, 2);
});
