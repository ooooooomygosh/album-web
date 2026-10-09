const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanSnapshot, cleanCompanion } = require('../wallpaper-model.cjs');
test('all scene and species selections survive persistence and read-only companion contracts', async () => {
  const { ROOM_SCENES } = await import('../../src/scene-catalog.mjs');
  const { PETS } = await import('../../src/pet/pet-catalog.mjs');
  const { normalizeLibrary } = await import('../../src/record-library.mjs');
  for (const scene of ROOM_SCENES) for (const pet of PETS) {
    const saved = normalizeLibrary({ rooms: { local: { look: scene.id, petId: pet.id } } });
    const restored = normalizeLibrary(JSON.parse(JSON.stringify(saved))).rooms.local;
    assert.equal(restored.look, scene.id); assert.equal(restored.petId, pet.id);
    const wall = cleanSnapshot({ ...restored, credential: 'do-not-copy', items: [] });
    assert.equal(wall.look, scene.id); assert.equal(wall.petId, pet.id); assert.equal(wall.credential, undefined);
    const companion = cleanCompanion({ petId: pet.id, credential: 'do-not-copy' });
    assert.equal(companion.petId, pet.id); assert.equal(companion.credential, undefined);
  }
});
test('old preferences default to the original cat without discarding record boxes', async () => {
  const { normalizeLibrary } = await import('../../src/record-library.mjs');
  const room = normalizeLibrary({ rooms: { local: { look: 'warm', boxes: [{ id: 'jazz', name: '爵士', keys: ['qq:123'] }] } } }).rooms.local;
  assert.equal(room.petId, 'cat'); assert.equal(room.look, 'warm'); assert.equal(room.boxes[0].keys[0], 'qq:123');
  const bad = normalizeLibrary({ rooms: { local: { look: '__proto__', petId: 'constructor' } } }).rooms.local;
  assert.equal(bad.look, 'pixel'); assert.equal(bad.petId, 'cat');
});
test('cat-only skin and minute display survive alongside every species and scene', async () => {
  const { normalizeFocus, focusSnapshot } = await import('../../src/focus/focus-model.mjs');
  const { PETS } = await import('../../src/pet/pet-catalog.mjs');
  const focus = focusSnapshot(normalizeFocus({ settings: { catSkin: 'black', hideSeconds: true } }), Date.now());
  for (const pet of PETS) {
    const wall = cleanSnapshot({ look: 'forest', petId: pet.id, focus, items: [] });
    const companion = cleanCompanion({ petId: pet.id, focus });
    assert.equal(wall.petId, pet.id); assert.equal(companion.petId, pet.id);
    assert.equal(wall.focus.catSkin, 'black'); assert.equal(wall.focus.hideSeconds, true);
    assert.equal(companion.focus.catSkin, 'black');
  }
});
