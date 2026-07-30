import { chromium } from '@playwright/test';

const baseUrl = process.env.APP_URL || 'http://localhost:5173';
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const stamp = Date.now();
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function withBypass(path) {
  if (!bypassSecret || !baseUrl.includes('vercel.app')) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}x-vercel-protection-bypass=${encodeURIComponent(bypassSecret)}`;
}

async function request(path, options = {}, token = '') {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (bypassSecret) headers['x-vercel-protection-bypass'] = bypassSecret;
  const response = await fetch(`${baseUrl}${withBypass(path)}`, { ...options, headers });
  const text = await response.text();
  let data = {};
  try {
    data = JSON.parse(text || '{}');
  } catch {
    throw new Error(`${path} returned non-JSON ${response.status}: ${text.slice(0, 240)}`);
  }
  if (!response.ok) throw new Error(`${path} failed ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function signup(name, avatar) {
  return request('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'signup',
      email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}@album.test`,
      password: 'password123',
      name,
      avatar
    })
  });
}

const owner = await signup('Member Owner', 'MO');
const viewer = await signup('Member Viewer', 'MV');
const room = await request('/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: `成员资料验收 ${stamp}`, slug: `member-profile-${stamp}` })
}, owner.token);
await request('/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'join', roomId: room.room.id })
}, viewer.token);

const added = await request(`/api/items?roomId=${room.room.id}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'song',
    title: '公开资料之歌',
    artist: 'Album Circle QA',
    albumTitle: 'Room Signals',
    year: '2026',
    cover: '',
    palette: ['#5cb7ff', '#f3d74c', '#f8fbff'],
    tags: ['profile-smoke'],
    source: 'member-profile-smoke'
  })
}, owner.token);

const updated = await request('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'updateProfile',
    name: 'Profile Sync Owner',
    avatar: 'PS',
    avatarDataUrl: tinyPng,
    profile: {
      bio: '公开简介会同步到房间成员卡片。',
      location: 'Sydney',
      favoriteGenres: ['Art Pop', 'Dream Pop'],
      favoriteArtists: ['王菲', 'Frank Ocean'],
      favoriteBands: ['The xx'],
      favoriteAlbums: ['唱游', 'Blonde'],
      favoriteSongs: ['我爱你 - 李荣浩'],
      gender: 'private',
      birthYear: 1999,
      mbti: 'INFJ',
      major: 'private field'
    },
    publicTags: ['专辑补完者', '深夜人声控']
  })
}, owner.token);
if (!updated.user.avatarDataUrl || !updated.user.publicTags?.includes('专辑补完者')) throw new Error('Profile update response missing avatar/tags.');

const roomAfter = await request(`/api/rooms?roomId=${encodeURIComponent(room.room.id)}`, {}, viewer.token);
const syncedProfile = roomAfter.room.memberProfiles?.[owner.user.id];
if (!syncedProfile?.avatarDataUrl || syncedProfile.bio !== '公开简介会同步到房间成员卡片。') {
  throw new Error(`Room member profile was not synced: ${JSON.stringify(syncedProfile)}`);
}
if (syncedProfile.profile?.gender || syncedProfile.profile?.mbti || syncedProfile.profile?.major || syncedProfile.profile?.birthYear) {
  throw new Error(`Private fields leaked into room member profile: ${JSON.stringify(syncedProfile.profile)}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 930 }, deviceScaleFactor: 1 });
if (bypassSecret) await context.setExtraHTTPHeaders({ 'x-vercel-protection-bypass': bypassSecret });
await context.addInitScript((session) => {
  localStorage.setItem('album-circle-session', JSON.stringify(session));
}, { token: viewer.token, user: viewer.user });
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(withBypass(`${baseUrl}?room=${encodeURIComponent(room.room.id)}`), { waitUntil: 'networkidle' });
await page.locator('.cabinet-grid[aria-label="专辑陈列柜"]').waitFor({ timeout: 25000 });
await page.locator('.member-stack button[title*="Profile Sync Owner"]').click();
await page.locator('.member-modal').waitFor({ timeout: 10000 });
await page.getByRole('dialog', { name: /Profile Sync Owner/ }).getByText('公开简介会同步到房间成员卡片。').waitFor({ timeout: 5000 });
await page.getByText('专辑补完者').waitFor({ timeout: 5000 });
await page.getByText('深夜人声控').waitFor({ timeout: 5000 });
await page.getByText('Art Pop、Dream Pop').waitFor({ timeout: 5000 });
await page.getByText('王菲、Frank Ocean').waitFor({ timeout: 5000 });
await page.locator('.member-modal .member-added-list button').filter({ hasText: '公开资料之歌' }).first().click();
await page.locator('.showroom-detail').filter({ hasText: '公开资料之歌' }).waitFor({ timeout: 10000 });
await page.locator('.credit-strip .author-chip').filter({ hasText: 'Profile Sync Owner' }).click();
await page.locator('.member-modal').filter({ hasText: '当前房间添加' }).waitFor({ timeout: 10000 });
const avatarSrc = await page.locator('.member-modal .member-profile-avatar img').first().getAttribute('src');
if (!avatarSrc?.startsWith('data:image/png')) throw new Error(`Expected synced avatar data URL, got ${avatarSrc?.slice(0, 80)}`);
if (errors.length) throw new Error(`Browser console errors: ${errors.join(' | ')}`);
await browser.close();

console.log(JSON.stringify({
  baseUrl,
  roomId: room.room.id,
  ownerId: owner.user.id,
  viewerId: viewer.user.id,
  addedItemId: added.item.id,
  syncedName: syncedProfile.name,
  syncedTags: syncedProfile.publicTags,
  syncedPublicFields: Object.keys(syncedProfile.profile || {})
}, null, 2));
