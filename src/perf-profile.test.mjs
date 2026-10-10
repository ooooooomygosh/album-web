import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLevel, hardwareHint, measuredFps } from './perf-profile.mjs';
test('performance level: explicit choice wins, auto uses probe then hardware', () => {
  assert.equal(resolveLevel('smooth', 'high', 'high'), 'low');
  assert.equal(resolveLevel('quality', 'low', 'low'), 'high');
  assert.equal(resolveLevel('auto', 'low', 'high'), 'low');
  assert.equal(resolveLevel('auto', '', 'low'), 'low');
  assert.equal(hardwareHint({ hardwareConcurrency: 4 }), 'low');
  assert.equal(hardwareHint({ hardwareConcurrency: 8, deviceMemory: 8 }), 'high');
  assert.equal(Math.round(measuredFps([0, 100, 200, 300])), 10);
});
