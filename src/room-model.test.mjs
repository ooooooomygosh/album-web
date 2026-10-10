import assert from 'node:assert/strict';
import test from 'node:test';
import { roomGeometry, roomGeometryAroundPanel } from './room-model.mjs';
import { ROOM_SCENES } from './scene-catalog.mjs';

const safe = { top: 130, bottom: 130, left: 300 };
const panel = { left: 1064, right: 1424, top: 140, bottom: 298 };
test('closed focus tools keep the base scene geometry', () => {
  for (const scene of ROOM_SCENES) {
    const geometry = { ...scene.geometry, band: scene.band };
    assert.deepEqual(roomGeometryAroundPanel(1440, 900, safe, geometry, null), roomGeometry(1440, 900, safe, geometry));
  }
});
test('short focus tabs can use space below their real rectangle', () => {
  const scene = ROOM_SCENES[0], geometry = { ...scene.geometry, band: scene.band };
  const insetPanel = { ...panel, left: 900, right: 1260 };
  const short = roomGeometryAroundPanel(1440, 1080, safe, geometry, insetPanel);
  const tall = roomGeometryAroundPanel(1440, 1080, safe, geometry, { ...insetPanel, bottom: 887 });
  assert(short.width > tall.width, 'a short tab must not reserve the tall timer rail');
});
test('floating panels avoid the interaction band in every scene', () => {
  for (const scene of ROOM_SCENES) for (const bottom of [298, 687]) {
    const art = roomGeometryAroundPanel(1440, 900, safe, { ...scene.geometry, band: scene.band }, { ...panel, bottom });
    const k = art.width / 1448, band = scene.band;
    const b = { left: art.left + band.left*k, right: art.left + band.right*k, top: art.top + band.top*k, bottom: art.top + band.bottom*k };
    assert(b.right <= panel.left-12 || b.left >= panel.right+12 || b.bottom <= panel.top-12 || b.top >= bottom+12, scene.id);
  }
});
