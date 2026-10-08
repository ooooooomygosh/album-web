'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const model = import('../../src/cabin-fire.mjs');
test('fire keeps a luminous fuel bed and real dark gaps instead of filling the hearth with a solid curtain', async () => {
  const { fillFireTexture } = await model, width = 112, height = 208;
  for (const time of [0, .5, 1, 2, 4, 6, 60]) {
    const data = fillFireTexture(new Uint8ClampedArray(width * height * 4), width, height, time);
    let brightRoot = 0, emptyMiddle = 0, upperFlame = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (y > 145 && y < 172 && data[i + 3] > 200 && data[i + 1] > 210) brightRoot++;
      if (y > 80 && y < 145 && data[i + 3] < 20) emptyMiddle++;
      if (y < 110 && data[i + 3] > 180) upperFlame++;
      if (y < 8 || y > 193) assert.equal(data[i + 3], 0, 'flames dissipate before the top and leave the log bed below');
    }
    assert.ok(brightRoot > 700); assert.ok(emptyMiddle > 400); assert.ok(upperFlame > 30);
  }
});
test('advected fire is deterministic, changes without whole-frame flashes, and pixel style uses hard stepped colours', async () => {
  const { fillFireTexture } = await model;
  const make = (t, pixel = false) => fillFireTexture(new Uint8ClampedArray(112 * 208 * 4), 112, 208, t, pixel);
  const a = make(1), b = make(1 + 1 / 24), c = make(2);
  assert.deepEqual(a, make(1)); assert.notDeepEqual(a, c);
  let mean = 0; for (let i = 3; i < a.length; i += 4) mean += Math.abs(a[i] - b[i]);
  assert.ok(mean / (112 * 208) < 12);
  const pixel = make(1, true), colours = new Set();
  for (let i = 0; i < pixel.length; i += 4) { assert.ok(pixel[i + 3] === 0 || pixel[i + 3] === 255); if (pixel[i + 3]) colours.add(`${pixel[i]},${pixel[i + 1]},${pixel[i + 2]}`); }
  assert.ok(colours.size <= 8); assert.ok(colours.size >= 4);
});
