import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from './focus-model.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
const MIN = 60000, NOW = new Date(2026, 9, 9, 15).getTime();

test('presets apply valid settings and are detected back', () => {
  for (const preset of model.FOCUS_PRESETS) {
    const settings = model.normalizeSettings({ ...model.DEFAULT_SETTINGS, ...model.presetSettings(preset.id) });
    assert.equal(model.activePreset(settings), preset.id);
  }
  assert.equal(model.activePreset(model.DEFAULT_SETTINGS), 'classic');
  assert.equal(model.activePreset({ focusMin: 33 }), '');
  assert.equal(model.presetSettings('nope'), null);
});

test('phase progress follows the running and paused timer', () => {
  const state = model.normalizeFocus();
  assert.equal(model.phaseProgress(state.timer, state.settings, NOW), 0);
  const running = model.startPhase(state, 'focus', NOW);
  near(model.phaseProgress(running.timer, running.settings, NOW + 5 * MIN), .2);
  const paused = model.pause(running, NOW + 10 * MIN);
  near(model.phaseProgress(paused.timer, paused.settings, NOW + 20 * MIN), .4);
  assert.equal(model.phaseProgress(running.timer, running.settings, NOW + 99 * MIN), 1);
});

test('renaming a task trims text and ignores empty names', () => {
  let state = model.addTask(model.normalizeFocus(), 'Write README', NOW);
  const id = state.tasks[0].id;
  state = model.renameTask(state, id, '  Polish README\n');
  assert.equal(state.tasks[0].text, 'Polish README');
  assert.equal(model.renameTask(state, id, '   '), state);
});

test('task progress counts items finished today', () => {
  let state = model.normalizeFocus();
  for (const text of ['a', 'b', 'c']) state = model.addTask(state, text, NOW);
  state = model.updateTask(state, state.tasks[0].id, { done: true }, NOW);
  state = model.updateTask(state, state.tasks[1].id, { done: true }, NOW - 2 * 24 * 60 * MIN);
  assert.deepEqual(model.taskProgress(state.tasks, NOW), { total: 3, done: 2, open: 1, doneToday: 1 });
});

test('completed focus round earns a reward and starts a break', () => {
  const state = model.startPhase(model.normalizeFocus(), 'focus', NOW);
  const { state: next, event } = model.tick(state, NOW + 25 * MIN);
  assert.equal(event.completed, true);
  assert.equal(next.rewards.fish, 1);
  assert.equal(next.timer.phase, 'shortBreak');
});
