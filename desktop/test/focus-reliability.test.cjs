'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const model = import('../../src/focus/focus-model.mjs');
const MINUTE = 60000, now = Date.UTC(2026, 9, 8, 12);

test('free focus can clear selection; clearing completed tasks clears their selection', async () => {
  const m = await model;
  let state = m.addTask(m.normalizeFocus(), 'Write notes', now);
  const id = state.tasks[0].id;
  state = m.selectTask(state, id);
  assert.equal(m.selectTask(state, '').timer.taskId, '');
  assert.equal(m.selectTask(state, 'missing').timer.taskId, '');
  assert.equal(m.selectTask(state, id).timer.taskId, id);
  assert.equal(m.selectTask(state, id, true).timer.taskId, '');
  state = m.updateTask(state, id, { done: true }, now);
  state = m.clearDone(state);
  assert.equal(state.tasks.length, 0);
  assert.equal(state.timer.taskId, '');
});

test('an active timer keeps its original duration through settings edits and reload', async () => {
  const m = await model;
  let state = m.startPhase(m.normalizeFocus({ settings: { focusMin: 2 } }), 'focus', now);
  state.settings.focusMin = 50;
  state = m.normalizeFocus(JSON.parse(JSON.stringify(state)));
  const result = m.tick(state, now + 2 * MINUTE);
  assert.equal(result.state.rewards.xp, 2);
  assert.equal(result.state.sessions[0].end - result.state.sessions[0].start, 2 * MINUTE);
  assert.equal(result.state.timer.phase, 'shortBreak');
});

test('pause/resume excludes paused time and repeated ticks never duplicate rewards', async () => {
  const m = await model;
  let state = m.startPhase(m.normalizeFocus({ settings: { focusMin: 2, autoBreak: false } }), 'focus', now);
  state = m.pause(state, now + MINUTE);
  assert.equal(m.tick(state, now + 60 * MINUTE).event, null);
  state = m.resume(state, now + 60 * MINUTE);
  assert.equal(m.remainingMs(state.timer, now + 60 * MINUTE), MINUTE);
  state = m.tick(state, now + 61 * MINUTE).state;
  assert.equal(state.rewards.xp, 2);
  assert.equal(state.rewards.fish, 1);
  assert.equal(m.tick(state, now + 62 * MINUTE).event, null);
});

test('sleep across multiple phases credits only the active focus and returns idle', async () => {
  const m = await model;
  const state = m.startPhase(m.normalizeFocus({ settings: { focusMin: 2, shortMin: 1, autoFocus: true } }), 'focus', now);
  const result = m.tick(state, now + 120 * MINUTE);
  assert.equal(result.state.timer.phase, 'idle');
  assert.equal(result.state.rewards.fish, 1);
  assert.equal(result.state.sessions.length, 1);
});

test('statistics split at real local midnight across both DST transitions', () => {
  const source = `import assert from 'node:assert/strict';
    import { minutesByDay } from './src/focus/focus-model.mjs';
    for (const [start, end, expected] of [
      ['2026-11-01T00:00:00', '2026-11-02T00:30:00', [['2026-11-01',1500],['2026-11-02',30]]],
      ['2026-03-08T00:00:00', '2026-03-09T00:30:00', [['2026-03-08',1380],['2026-03-09',30]]]
    ]) assert.deepEqual([...minutesByDay([{start: new Date(start).getTime(), end: new Date(end).getTime()}])], expected);`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: require('node:path').resolve(__dirname, '../..'), env: { ...process.env, TZ: 'America/New_York' }, timeout: 5000, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || String(run.error));
});

test('music requests report malformed service responses and preserve aborts', async (t) => {
  const { musicRequest } = await import('../../src/room-playback.mjs');
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>offline</html>'));
  await assert.rejects(musicRequest('/config'), /有效数据/);
  globalThis.fetch = async () => Response.json({ error: 'Permission denied' }, { status: 403 });
  await assert.rejects(musicRequest('/resolve', {}), /Permission denied/);
  globalThis.fetch = async (_url, { signal }) => { signal.throwIfAborted(); return Response.json({ ok: true }); };
  const controller = new AbortController(); controller.abort();
  await assert.rejects(musicRequest('/config', undefined, controller.signal), { name: 'AbortError' });
});

test('built-in notes persist as capped plain text and stay isolated by local profile', async () => {
  const m = await model;
  const a = m.normalizeFocus({ notes: '<script>alert(1)</script>\nA\u0000B' });
  assert.equal(a.notes, '<script>alert(1)</script>\nAB');
  assert.equal(m.normalizeFocus({ notes: 'a'.repeat(9000) }).notes.length, m.MAX_NOTE_LENGTH);
  assert.equal(m.normalizeFocus({ notes: { html: 'invalid' } }).notes, '');
  const saved = new Map([[m.FOCUS_PREFIX + 'a', JSON.stringify(a)]]);
  const storage = { getItem: (key) => saved.get(key) };
  assert.equal(m.readFocus(storage, 'a').notes, a.notes);
  assert.equal(m.readFocus(storage, 'b').notes, '');
  const recovered = m.normalizeFocus(JSON.parse(JSON.stringify(a)));
  assert.equal(recovered.notes, a.notes);
});

test('long local metadata scans do not inherit the 20-second playback timeout', async (t) => {
  const { musicRequest, musicRequestTimeout } = await import('../../src/room-playback.mjs');
  assert.equal(musicRequestTimeout('/local/rescan'), 600000);
  assert.equal(musicRequestTimeout('/local/remove-folder'), 600000);
  assert.equal(musicRequestTimeout('/local/summary'), 20000);
  assert.equal(musicRequestTimeout('/resolve'), 20000);
  const delays = [];
  t.mock.method(globalThis, 'setTimeout', (_callback, delay) => { delays.push(delay); return 0; });
  t.mock.method(globalThis, 'clearTimeout', () => {});
  t.mock.method(globalThis, 'fetch', async () => Response.json({ scanning: false, trackCount: 20000 }));
  assert.equal((await musicRequest('/local/rescan', {})).trackCount, 20000);
  await musicRequest('/local/remove-folder', { path: '/test/music' });
  await musicRequest('/local/summary');
  assert.deepEqual(delays, [600000, 600000, 20000]);
});
