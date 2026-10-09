'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

async function setup(t, options = {}) {
  const { createMusicBrainzScheduler } = await import('../musicbrainz-scheduler.mjs');
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  return createMusicBrainzScheduler({ now: () => Date.now(), ...options });
}

test('MusicBrainz search and detail work share spaced starts even with stalled responses', async (t) => {
  const schedule = await setup(t);
  const starts = [];
  let finishFirst;
  const first = schedule(() => { starts.push(Date.now()); return new Promise(r => { finishFirst = r; }); });
  const second = schedule(() => { starts.push(Date.now()); return 'detail'; });
  const third = schedule(() => { starts.push(Date.now()); return 'other search'; });
  assert.deepEqual(starts, [0]);
  t.mock.timers.tick(1099);
  assert.deepEqual(starts, [0]);
  t.mock.timers.tick(1);
  assert.deepEqual(starts, [0, 1100]);
  t.mock.timers.tick(1100);
  assert.deepEqual(starts, [0, 1100, 2200]);
  finishFirst('search');
  assert.deepEqual(await Promise.all([first, second, third]), ['search', 'detail', 'other search']);
});

test('aborted queued and pre-aborted work never starts and leaves no reserved slot', async (t) => {
  const schedule = await setup(t);
  await schedule(() => 'first');
  const controller = new AbortController();
  let cancelledStarts = 0;
  const queued = schedule(() => { cancelledStarts++; }, controller.signal);
  const rejected = assert.rejects(queued, { name: 'AbortError' });
  controller.abort();
  await rejected;
  await assert.rejects(schedule(() => { cancelledStarts++; }, controller.signal), { name: 'AbortError' });
  let liveStart;
  const next = schedule(() => { liveStart = Date.now(); });
  t.mock.timers.tick(1100);
  await next;
  assert.equal(cancelledStarts, 0);
  assert.equal(liveStart, 1100);
});

test('MusicBrainz queue is bounded and one failure does not poison later work', async (t) => {
  const schedule = await setup(t, { maxQueued: 1 });
  await assert.rejects(schedule(() => { throw new Error('network failure'); }), /network failure/);
  const next = schedule(() => 'recovered');
  await assert.rejects(schedule(() => 'overflow'), /queue is full/);
  t.mock.timers.tick(1100);
  assert.equal(await next, 'recovered');
});
