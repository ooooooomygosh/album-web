const baseUrl = process.env.APP_URL || 'http://localhost:5173';
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const stamp = Date.now();

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
  const data = JSON.parse(text || '{}');
  if (!response.ok) throw new Error(`${path} failed ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

const user = await request('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'signup',
    email: `hero-${stamp}@album.test`,
    password: 'password123',
    name: 'Hero QA',
    avatar: 'H'
  })
});

const room = await request('/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: `Hero Config QA ${stamp}`, slug: `hero-config-${stamp}` })
}, user.token);

const validBackground = 'https://firebasestorage.googleapis.com/v0/b/music-b0420.firebasestorage.app/o/album-circle-avatars%2Fdemo.webp?alt=media';
const saved = await request('/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'settings',
    roomId: room.room.id,
    visibility: 'public',
    joinMode: 'open',
    discoverable: true,
    description: 'Hero config round trip.',
    heroConfig: {
      eyebrow: 'qa room',
      title: 'Hero Round Trip',
      titleSuffix: '保存视觉主题',
      description: '检查首页编辑器保存后可以稳定回显。',
      accentName: 'QA Observatory',
      backgroundUrl: validBackground,
      visualMode: 'editorial',
      motionLevel: 'still'
    }
  })
}, user.token);

if (saved.room.heroConfig.title !== 'Hero Round Trip') throw new Error('Hero title did not persist.');
if (saved.room.heroConfig.backgroundUrl !== validBackground) throw new Error(`Trusted Firebase image URL was stripped: ${saved.room.heroConfig.backgroundUrl}`);
if (saved.room.heroConfig.visualMode !== 'editorial' || saved.room.heroConfig.motionLevel !== 'still') throw new Error('Hero mode did not persist.');

const cleared = await request('/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'settings',
    roomId: room.room.id,
    description: '',
    heroConfig: {
      eyebrow: '',
      title: '',
      titleSuffix: '',
      description: '',
      accentName: '',
      backgroundUrl: '',
      visualMode: 'vinyl',
      motionLevel: 'ambient'
    }
  })
}, user.token);

if (cleared.room.heroConfig.title !== '' || cleared.room.heroConfig.backgroundUrl !== '') {
  throw new Error(`Explicitly cleared hero fields were restored unexpectedly: ${JSON.stringify(cleared.room.heroConfig)}`);
}
if (cleared.room.heroConfig.visualMode !== 'vinyl') throw new Error('Hero visual mode did not update after clear.');

const invalid = await request('/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'settings',
    roomId: room.room.id,
    heroConfig: {
      ...cleared.room.heroConfig,
      backgroundUrl: 'https://example.com/not-an-image-page'
    }
  })
}, user.token);

if (invalid.room.heroConfig.backgroundUrl !== '') {
  throw new Error(`Invalid background URL was not stripped: ${invalid.room.heroConfig.backgroundUrl}`);
}

console.log(JSON.stringify({
  baseUrl,
  roomId: room.room.id,
  persisted: saved.room.heroConfig,
  cleared: cleared.room.heroConfig,
  invalidBackground: invalid.room.heroConfig.backgroundUrl
}, null, 2));
