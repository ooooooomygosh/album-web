const { test } = require('node:test');
const assert = require('node:assert/strict');
test('focus backup carries notes but not an active timer or arbitrary fields', async () => {
  const { backupFocus, restoreFocus } = await import('../../src/backup-model.mjs');
  const { normalizeFocus } = await import('../../src/focus/focus-model.mjs');
  const current = normalizeFocus({ notes: '<b>纯文本</b>\n第二行' });
  const copy = backupFocus({ ...current, timer: { phase: 'focus' }, secret: 'omit' });
  assert.equal(copy.notes, current.notes); assert.equal(copy.timer, undefined); assert.equal(copy.secret, undefined);
  assert.equal(normalizeFocus(restoreFocus(JSON.parse(JSON.stringify(copy)), current)).notes, current.notes);
});
test('legacy imports preserve existing notes while explicit empty notes clear them', async () => {
  const { restoreFocus } = await import('../../src/backup-model.mjs');
  assert.equal(restoreFocus({ tasks: [] }, { notes: 'retain' }).notes, 'retain');
  assert.equal(restoreFocus({ notes: '' }, { notes: 'retain' }).notes, '');
  assert.deepEqual(restoreFocus(null, { notes: 'retain' }), { notes: 'retain' });
});
