'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSettings, DEFAULT_SETTINGS, appearanceScript } = require('../settings.cjs');
const { safeSavedWindow } = require('../policy.cjs');
test('saved appearance rejects CSS injection and clamps excessive scaling', () => {
  assert.deepEqual(normalizeSettings(), DEFAULT_SETTINGS);
  assert.equal(normalizeSettings({ font: '"; url(https://example.com)' }).font, 'bundled');
  assert.equal(normalizeSettings({ zoom: 999, weight: 600, theme: 'invalid' }).zoom, 150);
  assert.equal(normalizeSettings({ weight: 600 }).weight, 400);
  assert.equal(normalizeSettings({ weight: 250 }).weight, 250);
  assert.equal(normalizeSettings({ font: 'Microsoft YaHei' }).font, 'Microsoft YaHei');
  assert.ok(appearanceScript(DEFAULT_SETTINGS).includes('HarmonyOS Sans SC Bundled'));
});
test('restore fits small work areas and clamps partly offscreen saved windows', () => {
  const area = { x: -800, y: 0, width: 800, height: 480 };
  assert.deepEqual(safeSavedWindow({ x: -750, y: 200, width: 1360, height: 900 }, area), { x: -800, y: 0, width: 800, height: 480 });
});
