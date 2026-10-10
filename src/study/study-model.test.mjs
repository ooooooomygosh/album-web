import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStudy, addDeck, parseCards, addCards, studyQueue, review, previews, intervalLabel, daysUntil, addCountdown, nextCountdown, heatmap, removeDeck, cardStage, RATINGS } from './study-model.mjs';

const T0 = new Date('2026-10-10T09:00:00').getTime();

test('study: parse cards from lines, tabs and full-width colons', () => {
  assert.deepEqual(parseCards('apple - 苹果\n# comment\nephemeral\t短暂的\n光合作用：植物利用光能\nlonely'), [
    { front: 'apple', back: '苹果' }, { front: 'ephemeral', back: '短暂的' }, { front: '光合作用', back: '植物利用光能' }, { front: 'lonely', back: '' }]);
});

test('study: decks, de-duplicated cards and a daily queue of due + new cards', () => {
  let state = addDeck(normalizeStudy({}), '英语单词', T0);
  const deck = state.decks[0].id;
  let result = addCards(state, deck, parseCards('apple - 苹果\nApple - again\nbook - 书'), T0); state = result.state;
  assert.equal(result.added, 2);
  state = { ...state, newPerDay: 1 };
  let queue = studyQueue(state, deck, T0);
  assert.equal(queue.cards.length, 1); assert.equal(queue.fresh, 1); assert.equal(queue.cards[0].front, 'apple');
  state = review(state, queue.cards[0].id, RATINGS[2].rating, T0);
  assert.equal(cardStage(state.cards[0]), 'learning');
  assert.equal(state.log['2026-10-10'].learned, 1);
  queue = studyQueue(state, deck, T0 + 60000);
  assert.equal(queue.fresh, 0, 'the daily new-card limit holds');
  queue = studyQueue(state, deck, T0 + 60 * 60000);
  assert.equal(queue.due, 1, 'a learning card comes back the same day');
  assert.equal(normalizeStudy(JSON.parse(JSON.stringify(state))).cards[0].memory.reps, 1, 'memory survives JSON');
  assert.equal(removeDeck(state, deck).cards.length, 0);
});

test('study: rating previews read like a scheduler, Easy waits longest', () => {
  const labels = previews({ memory: null }, T0);
  assert.deepEqual(Object.keys(labels).length, 4);
  assert.match(labels[RATINGS[0].rating], /分钟/);
  assert.match(labels[RATINGS[3].rating], /天/);
  assert.equal(intervalLabel(90 * 60000), '2 小时'); assert.equal(intervalLabel(45 * 86400000), '2 个月'); assert.equal(intervalLabel(400 * 86400000), '1.1 年');
});

test('study: countdowns in whole local days and a heatmap of focus minutes', () => {
  assert.equal(daysUntil('2026-10-10', T0), 0); assert.equal(daysUntil('2026-12-26', T0), 77);
  let state = addCountdown(normalizeStudy({}), '考研', '2026-12-26'); state = addCountdown(state, '已过', '2026-01-01'); state = addCountdown(state, '四级', '2026-12-12');
  assert.deepEqual(nextCountdown(state, T0), { ...state.countdowns.find((c) => c.title === '四级'), days: 63 });
  const map = heatmap(new Map([['2026-10-10', 130], ['2026-10-09', 30]]), T0, 4);
  assert.equal(map.length, 4); assert(map.every((week) => week.length === 7));
  const flat = map.flat(), today = flat.find((d) => d.key === '2026-10-10');
  assert.equal(today.level, 4); assert.equal(flat.find((d) => d.key === '2026-10-09').level, 2);
  assert(flat.slice(flat.indexOf(today) + 1).every((d) => d.future && d.level === 0));
});

test('study: malformed storage is cleaned', () => {
  const state = normalizeStudy({ decks: [{ id: 'd', name: 'A' }, { name: '' }], cards: [{ deckId: 'd', front: 'x', memory: { state: 9, due: 'x' } }, { deckId: 'missing', front: 'y' }], countdowns: [{ title: 't', date: 'bad' }], log: { nope: 1 } });
  assert.equal(state.decks.length, 1); assert.equal(state.cards.length, 1); assert.equal(state.cards[0].memory.state, 0); assert.equal(state.countdowns.length, 0); assert.deepEqual(state.log, {});
});
