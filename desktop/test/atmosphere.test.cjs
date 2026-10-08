'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const model = import('../../src/cabin-atmosphere.mjs');
test('scene-specific particles/flames are deterministic, bounded and weather-aware', async () => {
  const { ATMOSPHERE, atmosphereFrame } = await model;
  for (const look of ['warm', 'pixel']) {
    const g = ATMOSPHERE[look];
    assert.equal(g.panes.length, 4); assert.ok(g.fire.x + g.fire.width <= 1448);
    for (const [x, y, w, h] of g.panes) { assert.ok(x >= 0 && y >= 0 && x + w <= g.window.width && y + h <= g.window.height); }
    for (const time of [0, .5, 5, 3600]) {
      const frame = atmosphereFrame(time, look); assert.deepEqual(frame, atmosphereFrame(time, look));
      assert.equal(frame.snow.length, 64); assert.equal(frame.flames.length, 8);
      for (const flake of frame.snow) { assert.ok(flake.x >= 0 && flake.x < g.window.width && flake.y >= 0 && flake.y < g.window.height); }
      for (const flame of frame.flames) { assert.ok(flame.height >= 54 && flame.height <= 139 && flame.base - flame.height > 0); }
      assert.ok(frame.light >= .065 && frame.light <= .11);
    }
    assert.equal(atmosphereFrame(10, look, 'clear').snow.length, 0);
    assert.notDeepEqual(atmosphereFrame(0, look), atmosphereFrame(1, look));
  }
});
test('warm light and flame shape change smoothly without flash-sized frame steps', async () => {
  const { atmosphereFrame } = await model;
  let previous = atmosphereFrame(0);
  for (let i = 1; i <= 2400; i++) {
    const next = atmosphereFrame(i / 24);
    assert.ok(Math.abs(next.light - previous.light) < .002);
    next.flames.forEach((flame, index) => assert.ok(Math.abs(flame.height - previous.flames[index].height) < 5)); previous = next;
  }
});
test('one throttled animation loop pauses, resumes, freezes reduced motion and disposes completely', async () => {
  const { createAtmosphereLoop } = await model;
  const pending = new Map(), frames = []; let id = 0, now = 0;
  const loop = createAtmosphereLoop({ draw: (time) => frames.push(time), request: (cb) => { pending.set(++id, cb); return id; }, cancel: (key) => pending.delete(key), now: () => now });
  const step = (time) => { now = time; const [key, cb] = pending.entries().next().value; pending.delete(key); cb(time); };
  loop.setMode('running'); loop.setMode('running'); assert.equal(pending.size, 1);
  for (let i = 1; i <= 60; i++) step(i * 1000 / 60);
  assert.ok(frames.length >= 18 && frames.length <= 25); assert.equal(pending.size, 1);
  loop.setMode('hidden'); assert.equal(pending.size, 0); const last = frames.at(-1); now = 500000;
  loop.setMode('running'); step(now + 50); assert.ok(frames.at(-1) - last < .15);
  loop.setMode('reduced'); assert.equal(pending.size, 0); assert.equal(frames.at(-1), 0);
  const count = frames.length; loop.setMode('reduced'); assert.equal(frames.length, count);
  loop.setMode('running'); const stale = pending.values().next().value; loop.dispose(); assert.equal(pending.size, 0); stale(now + 50); assert.equal(pending.size, 0);
  loop.setMode('running'); assert.equal(pending.size, 0);
});
test('material incidence, distance and roughness produce bounded separate surface responses', async () => {
  const { MATERIAL_SURFACES, materialResponse, surfaceLighting } = await model;
  const sample = { ...MATERIAL_SURFACES.stone, position: [0, 0, 0], normal: [1, 0, 0] };
  assert.ok(materialResponse(sample, [100, 0, 0], .15) > materialResponse(sample, [900, 0, 0], .15));
  assert.equal(materialResponse(sample, [-100, 0, 0], .15), 0);
  let previous = surfaceLighting(0);
  for (let i = 1; i < 1000; i++) {
    const next = surfaceLighting(i / 24);
    assert.equal(Object.keys(next).length, 5);
    for (const name of Object.keys(next)) { assert.ok(next[name] >= 0 && next[name] <= .18); assert.ok(Math.abs(next[name] - previous[name]) < .003); }
    assert.ok(next.stone > next.wood); assert.ok(next.stone > next.floor); previous = next;
  }
  assert.equal('window' in previous, false); assert.equal('ui' in previous, false);
});
