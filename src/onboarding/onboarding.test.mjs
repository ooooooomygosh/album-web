import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from './onboarding-model.mjs';
import { createPlayerAdapter, createDesktopAdapter, DESKTOP_MODE_EVENT } from './onboarding-adapter.mjs';

const memory = (seed = {}) => { const data = { ...seed }; return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data, get length() { return Object.keys(data).length; }, ...Object.fromEntries(Object.entries(data)) }; };

test('brand-new cabin opens the wizard; legacy or returning cabins do not', () => {
  assert.equal(m.isNewCabin(memory()), true);
  assert.equal(m.isNewCabin(memory({ 'flow-cabin-welcome-v1': 'seen' })), false);
  const legacy = m.readOnboarding(memory({ 'flow-cabin-welcome-v1': 'seen' }));
  assert.equal(legacy.status, 'done');
  assert.equal(m.shouldAutoOpen(legacy, { isNew: true }), false);
  assert.equal(m.shouldAutoOpen(m.initialState(), { isNew: true }), true);
  assert.equal(m.shouldAutoOpen(m.initialState(), { isNew: false }), false);
});

test('progress persists and resumes; skip and done never auto-open', () => {
  const store = memory();
  let s = m.next(m.start(m.initialState()));
  s = m.chooseSource(s, 'qq');
  m.writeOnboarding(store, s, 5);
  const back = m.readOnboarding(store);
  assert.deepEqual([back.status, back.step, back.source, back.updatedAt], ['active', 'source', 'qq', 5]);
  assert.equal(m.shouldAutoOpen(back), true);
  assert.equal(m.shouldAutoOpen(m.skip(back)), false);
  assert.equal(m.shouldAutoOpen(m.complete(back)), false);
  const again = m.reopen(m.complete(back));
  assert.deepEqual([again.status, again.step, again.source], ['active', 'welcome', 'qq']);
});

test('step navigation is clamped and visits every step in order', () => {
  let s = m.start(m.initialState()); const seen = [s.step];
  for (let i = 0; i < 10; i++) { s = m.next(s); if (seen.at(-1) !== s.step) seen.push(s.step); }
  assert.deepEqual(seen, m.STEPS);
  assert.equal(m.back(m.goTo(s, 'welcome')).step, 'welcome');
  assert.equal(m.goTo(s, 'nope'), s);
});

test('corrupt or hostile stored state is normalized', () => {
  const s = m.readOnboarding(memory({ [m.ONBOARDING_KEY]: '{"status":"x","step":"evil","source":"spotify","permissions":{"notifications":"granted","x":"yes"},"tested":"maybe"}' }));
  assert.deepEqual([s.status, s.step, s.source, s.permissions, s.tested], ['new', 'welcome', '', { notifications: 'granted' }, '']);
  assert.equal(m.readOnboarding(memory({ [m.ONBOARDING_KEY]: '{bad' })).status, 'new');
  const broken = { getItem() { throw new Error('denied'); } };
  assert.equal(m.readOnboarding(broken).status, 'skipped');
  assert.equal(m.isNewCabin(broken), false);
});

test('sources and permissions follow web / desktop / mac', () => {
  const web = m.sourceOptions({ desktop: false, mac: true });
  assert.deepEqual(web.filter((s) => s.available).map((s) => s.id), ['local']);
  assert.ok(web.find((s) => s.id === 'qq').reason.includes('桌面版'));
  assert.equal(m.sourceOptions({ desktop: true, mac: false }).some((s) => s.id === 'appleMusic'), false);
  assert.equal(m.sourceOptions({ desktop: true, mac: true }).find((s) => s.id === 'appleMusic').available, true);
  assert.deepEqual(m.permissionItems({ notifications: true }).map((p) => p.id), ['notifications']);
  assert.deepEqual(m.permissionItems({ notifications: true, desktop: true, mac: true }, 'appleMusic').map((p) => p.id), ['notifications', 'appleMusic', 'autostart']);
  assert.equal(m.providerFor('appleMusic'), 'system');
});

test('player adapter prefers the teammate API and falls back honestly', async () => {
  const commands = [];
  const fallback = createPlayerAdapter({ env: { desktop: true }, win: {}, command: (...a) => commands.push(a), request: async (path) => path === '/config' ? { qqLoggedIn: true } : { albumCount: 1, trackCount: 3 } });
  assert.deepEqual(await fallback.connectSource('qq'), { ok: true, pending: 'album-music-account' });
  assert.deepEqual(commands, [['music-login', { provider: 'qq' }]]);
  assert.equal((await fallback.getSourceStatus('qq')).connected, true);
  assert.equal((await fallback.getSourceStatus('local')).detail, '1 张专辑 · 3 首');
  assert.equal(await fallback.requestPermission('appleMusic'), 'unsupported');
  assert.equal(await fallback.qualities(), null);
  const web = createPlayerAdapter({ env: { desktop: false }, win: {} });
  assert.equal((await web.connectSource('local')).fallback, 'add-album');
  assert.equal((await web.connectSource('netease')).ok, false);
  assert.equal((await web.testPlayback()).ok, false);

  const calls = [];
  const api = { listSources: () => [{ id: 'qq', available: true }, { id: 'appleMusic', label: 'Apple Music', available: false, reason: '未授权' }], connectSource: async (id) => { calls.push(id); return { ok: true }; }, getSourceStatus: () => ({ connected: true, detail: 'VIP' }), requestPermission: async () => 'granted', testPlayback: async () => ({ ok: true }), listAudioQualities: () => ['standard', 'lossless'], getAudioQuality: () => 'standard', setAudioQuality: () => true };
  const real = createPlayerAdapter({ api, env: { desktop: true } });
  const list = await real.listSources();
  assert.equal(list[0].label, 'QQ 音乐'); assert.equal(list[1].reason, '未授权');
  assert.deepEqual(await real.connectSource('qq'), { ok: true }); assert.deepEqual(calls, ['qq']);
  assert.equal(await real.requestPermission('appleMusic'), 'granted');
  assert.equal((await real.testPlayback()).kind, 'track');
  assert.deepEqual(await real.qualities(), { options: ['standard', 'lossless'], current: 'standard' });
  const failing = createPlayerAdapter({ api: { connectSource: () => { throw new Error('网络错误'); } } });
  assert.deepEqual(await failing.connectSource('qq'), { ok: false, error: '网络错误' });
});

test('notification permission maps browser answers', async () => {
  const ask = (answer, permission = 'default') => createPlayerAdapter({ win: { Notification: { permission, requestPermission: async () => answer } } }).requestPermission('notifications');
  assert.equal(await ask('granted'), 'granted'); assert.equal(await ask('default'), 'skipped'); assert.equal(await ask('x', 'denied'), 'denied');
  assert.equal(await createPlayerAdapter({ win: {} }).requestPermission('notifications'), 'unsupported');
});

test('desktop adapter uses 沉入桌面 API, reports unsupported reason, and falls back', async () => {
  const listeners = {}; const win = { addEventListener: (n, f) => { listeners[n] = f; }, removeEventListener: (n) => { delete listeners[n]; } };
  const api = { getDesktopModeStatus: () => ({ active: false, supported: false, reason: '需要 macOS 13+' }), enterDesktopMode: () => {} };
  const real = createDesktopAdapter({ api, win });
  assert.deepEqual(await real.status(), { active: false, busy: false, supported: false, via: '', reason: '需要 macOS 13+' });
  let got; const off = real.subscribe((d) => { got = d; }); listeners[DESKTOP_MODE_EVENT]({ detail: { active: true } });
  assert.deepEqual(got, { active: true }); off(); assert.equal(listeners[DESKTOP_MODE_EVENT], undefined);
  let active = false; const local = createDesktopAdapter({ win: {}, env: { desktop: true }, fallback: { get active() { return active; }, enter: () => { active = true; }, exit: () => { active = false; } } });
  await local.enter(); assert.equal((await local.status()).active, true); await local.exit(); assert.equal(active, false);
});

test('desktop adapter passes busy/via and prefers onDesktopModeChange', async () => {
  let cb, offed = false;
  const api = { getDesktopModeStatus: () => ({ active: true, busy: true, supported: true, via: 'wallpaper', reason: '' }), onDesktopModeChange: (f) => { cb = f; return () => { offed = true; }; } };
  const a = createDesktopAdapter({ api, win: {} });
  assert.deepEqual(await a.status(), { active: true, busy: true, supported: true, via: 'wallpaper', reason: '' });
  let got; const off = a.subscribe((d) => { got = d; }); cb({ active: false }); assert.deepEqual(got, { active: false }); off(); assert.equal(offed, true);
});
