import test from 'node:test';
import assert from 'node:assert/strict';
import { clampWidget, normalizeWidgetLayout, readWidgetLayout, writeWidgetLayout, defaultWidgetLayout } from './widget-layout.mjs';

test('widget layout: positions stay on screen and bad storage falls back', () => {
  assert.deepEqual(clampWidget({ x: 1.5, y: -2 }, .2, .1), { x: .8, y: 0 });
  assert.deepEqual(normalizeWidgetLayout({ clock: { x: 'x', y: .5 }, extra: { x: 1 } }).clock, { x: defaultWidgetLayout().clock.x, y: .5 });
  const store = new Map(), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.deepEqual(readWidgetLayout(storage), defaultWidgetLayout());
  writeWidgetLayout({ ...defaultWidgetLayout(), todo: { x: .4, y: .4 } }, storage);
  assert.deepEqual(readWidgetLayout(storage).todo, { x: .4, y: .4 });
  storage.setItem('album-circle-desktop-widgets-v1', '{broken'); assert.deepEqual(readWidgetLayout(storage), defaultWidgetLayout());
});
