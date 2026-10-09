const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile, stat } = require('node:fs/promises');
const path = require('node:path');
const catalog = import('../../src/scene-catalog.mjs');

test('six stable scene IDs preserve legacy looks and normalize invalid settings', async () => {
  const { ROOM_SCENES, ROOM_SCENE_IDS, getRoomScene, normalizeRoomSceneId } = await catalog;
  assert.deepEqual(ROOM_SCENE_IDS, ['night-study', 'pixel', 'warm', 'forest', 'seaside', 'starlight']);
  assert.equal(new Set(ROOM_SCENES.map((scene) => scene.art)).size, 6);
  for (const scene of ROOM_SCENES) {
    assert.equal(getRoomScene(scene.id), scene);
    assert.equal(normalizeRoomSceneId(scene.id), scene.id);
    assert.ok(scene.label && scene.description && scene.alt);
    assert.match(scene.style.accent, /^#[a-f\d]{6}$/i);
    assert.match(scene.style.background, /^#[a-f\d]{6}$/i);
  }
  for (const invalid of [undefined, null, '', 'constructor', '__proto__', 'invalid', 1, {}, []]) {
    assert.equal(normalizeRoomSceneId(invalid), 'pixel');
    assert.equal(getRoomScene(invalid).id, 'pixel');
  }
});

test('all assets exist and original SVG scenes are self-contained accessible illustrations', async () => {
  const { ROOM_SCENES } = await catalog;
  for (const scene of ROOM_SCENES) {
    const file = path.join(__dirname, '../../public', scene.art);
    assert.ok((await stat(file)).size > 1000);
    if (!scene.art.endsWith('.svg')) continue;
    const source = await readFile(file, 'utf8');
    assert.match(source, /viewBox="0 0 1448 1086"/);
    assert.match(source, /<title id="title">.+<\/title>/);
    assert.match(source, /<desc id="desc">.+<\/desc>/);
    assert.doesNotMatch(source, /<(?:script|foreignObject|image)\b|(?:href|src)=["'](?:https?:|data:|\/\/)/i);
    // Every interactive position corresponds to a real, unobstructed illustrated cubby.
    for (const [x, width] of scene.geometry.columns) for (const [y, height] of scene.geometry.rows) {
      assert.ok(source.includes(`<rect x="${x}" y="${y}" width="${width}" height="${height}"`));
    }
  }
});

test('scene geometries fit nine or twelve covers and preserve existing calibrated shelf bounds', async () => {
  const { ROOM_SCENES, getRoomScene } = await catalog;
  const { SHELF } = await import('../../src/room-model.mjs');
  assert.deepEqual(getRoomScene('warm').geometry, SHELF.warm);
  assert.deepEqual(getRoomScene('pixel').geometry, SHELF.pixel);
  for (const scene of ROOM_SCENES) {
    const { columns, rows } = scene.geometry;
    assert.equal(columns.length * rows.length, scene.id === 'night-study' ? 9 : 12);
    for (const [pairs, boundary] of [[columns, 1448], [rows, 1086]]) {
      pairs.forEach(([start, extent], index) => {
        assert.ok(start >= 0 && extent > 0 && start + extent <= boundary);
        if (index) assert.ok(pairs[index - 1][0] + pairs[index - 1][1] <= start);
      });
    }
    assert.ok(Object.isFrozen(scene) && Object.isFrozen(scene.geometry.columns[0]));
  }
});
