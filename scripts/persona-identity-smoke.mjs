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

function textBlob(value) {
  return JSON.stringify(value || {}, null, 2);
}

function assertNoDownrankLanguage(value, label) {
  const text = textBlob(value);
  const pattern = /弱线索|弱证据|辅助语境|辅助线索|调味料，不是主食材|真正权重仍然是你选了哪些歌|不会盖过真实音乐选择|背景线索只用来|不能替代音乐偏好本身/;
  if (pattern.test(text)) {
    throw new Error(`${label} still downranks profile signals: ${text.slice(0, 1000)}`);
  }
}

const expected = {
  gender: '非二元',
  birthYear: 1998,
  mbti: 'INFJ',
  major: '计算机科学'
};

const user = await request('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'signup',
    email: `persona-${stamp}@album.test`,
    password: 'password123',
    name: 'Persona QA',
    avatar: 'P'
  })
});

const saved = await request('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'updateProfile',
    name: 'Persona QA',
    avatar: 'P',
    publicTags: ['深夜人声控', '专辑补完者'],
    profile: {
      bio: '喜欢把歌曲放进专辑和生活场景里理解。',
      location: 'Shanghai',
      favoriteGenres: ['Dream Pop', '另类 R&B', '华语流行'],
      favoriteArtists: ['王菲', 'Frank Ocean', '李荣浩'],
      favoriteBands: ['The xx', 'Radiohead'],
      favoriteAlbums: ['唱游', 'Blonde', 'In Rainbows'],
      favoriteSongs: ['我爱你 - 李荣浩', '暗涌 - 王菲'],
      ...expected
    }
  })
}, user.token);

for (const [key, value] of Object.entries(expected)) {
  if (String(saved.user.profile?.[key]) !== String(value)) {
    throw new Error(`Profile ${key} did not persist: ${JSON.stringify(saved.user.profile)}`);
  }
}

const room = await request('/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: `Persona Identity QA ${stamp}`, slug: `persona-identity-${stamp}` })
}, user.token);

await request(`/api/items?roomId=${room.room.id}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: `persona-song-${stamp}`,
    type: 'song',
    title: '我爱你',
    artist: '李荣浩',
    albumTitle: '嗯',
    year: '2017',
    cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6d/16/d1/6d16d1a5-cf5d-1d68-18ca-5bfb6a64c880/190296939846.jpg/600x600bb.jpg',
    tags: ['华语流行', '情绪克制'],
    context: '测试用户主动添加的代表歌曲。'
  })
}, user.token);

await request(`/api/comments?roomId=${room.room.id}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: '我喜欢这首歌不是因为它很大声，而是因为它把情绪收得很干净。',
    mood: '8.8',
    albumId: `persona-song-${stamp}`,
    albumTitle: '我爱你'
  })
}, user.token);

const persona = await request('/api/ai/recommend?action=persona', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'persona',
    tone: 'playful',
    history: { mode: 'mine', selected: [] }
  })
}, user.token);

const report = persona.report || {};
const identityText = textBlob(report.identitySignals);
const spiritText = textBlob(report.humanSpiritMap);
for (const value of Object.values(expected)) {
  if (!identityText.includes(String(value))) {
    throw new Error(`Persona identitySignals missing ${value}: ${identityText}`);
  }
  if (!spiritText.includes(String(value))) {
    throw new Error(`Persona humanSpiritMap missing ${value}: ${spiritText}`);
  }
}
if ((report.identitySignals?.fields || []).length < 4) throw new Error(`identitySignals fields incomplete: ${identityText}`);
if (String(report.humanSpiritMap?.text || '').length < 260 || (report.humanSpiritMap?.tensions || []).length < 3) {
  throw new Error(`humanSpiritMap is too thin: ${spiritText}`);
}
if (!(/我爱你/.test(spiritText) && /李荣浩/.test(spiritText))) {
  throw new Error(`humanSpiritMap did not cite the concrete song and artist: ${spiritText}`);
}
if (!(/情绪/.test(spiritText) && /干净|收得|评论/.test(spiritText))) {
  throw new Error(`humanSpiritMap did not connect the comment evidence with the identity reading: ${spiritText}`);
}
assertNoDownrankLanguage(report, 'Persona report');
if (!report.recommendations?.artists?.length || !report.recommendations?.albums?.length || !report.recommendations?.songs?.length) {
  throw new Error(`Persona recommendations incomplete: ${textBlob(report.recommendations)}`);
}
if (/30\s*天|90\s*天|核心矛盾|社交播放方式|未来路线/.test(textBlob(report))) {
  throw new Error(`Persona report contains removed rigid wording: ${textBlob(report).slice(0, 900)}`);
}

const chat = await request('/api/ai/recommend?action=persona-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'persona-chat',
    question: '你有没有读到我的 MBTI、专业、出生年份和性别？这些怎么影响推荐？',
    report,
    history: { mode: 'mine', selected: [] }
  })
}, user.token);

const chatText = String(chat.answer || '');
if (!chatText.includes(expected.mbti) || !chatText.includes(expected.major) || !chatText.includes(String(expected.birthYear)) || !chatText.includes(expected.gender)) {
  throw new Error(`Persona chat did not cite identity fields: ${chatText}`);
}
assertNoDownrankLanguage(chatText, 'Persona chat');

const refreshed = await request('/api/auth', { method: 'GET' }, user.token);
assertNoDownrankLanguage(refreshed.user?.latestPersona, 'Refreshed auth latestPersona');
if (!textBlob(refreshed.user?.latestPersona?.humanSpiritMap).includes(expected.mbti)) {
  throw new Error(`Refreshed auth latestPersona did not expose normalized spirit map: ${textBlob(refreshed.user?.latestPersona)}`);
}

console.log(JSON.stringify({
  baseUrl,
  userId: user.user.id,
  roomId: room.room.id,
  fallback: persona.fallback,
  model: report.model,
  identitySignals: report.identitySignals,
  humanSpiritMap: {
    title: report.humanSpiritMap?.title,
    textLength: String(report.humanSpiritMap?.text || '').length,
    tensionCount: report.humanSpiritMap?.tensions?.length || 0
  },
  recommendationCounts: {
    artists: report.recommendations?.artists?.length || 0,
    albums: report.recommendations?.albums?.length || 0,
    songs: report.recommendations?.songs?.length || 0
  },
  chatPreview: chatText.slice(0, 220)
}, null, 2));
