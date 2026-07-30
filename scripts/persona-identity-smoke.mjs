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
  const pattern = /弱线索|弱证据|辅助语境|辅助线索|调味料，不是主食材|真正权重仍然是你选了哪些歌|不会盖过真实音乐选择|背景线索只用来|不能替代音乐偏好本身|精神图谱|同等级?证据|同级证据|同权证据|同权线索|同一层级|坐标|互相照亮|互相校准|从哪里听|被什么击中|未来探索路线|未来路线|核心矛盾|社交播放方式|30\s*天|90\s*天|资料解释|证据维度|画像会更立体|不是音乐之外的附属品|不只是音乐和背景两层|人口统计|human spirit map|%\s*可信度/;
  if (pattern.test(text)) {
    throw new Error(`${label} still contains rigid report language: ${text.slice(0, 1000)}`);
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
const expectDeepSeek = process.env.EXPECT_DEEPSEEK_PERSONA === '1' || Boolean(process.env.DEEPSEEK_API_KEY);
if (expectDeepSeek && (persona.fallback || report.model === 'fallback')) {
  throw new Error(`Persona fell back instead of using DeepSeek: ${JSON.stringify({ fallback: persona.fallback, model: report.model, finishReason: persona.finishReason, debugError: persona.debugError })}`);
}
const identityText = textBlob(report.identitySignals);
const reportText = textBlob(report);
for (const value of Object.values(expected)) {
  if (!identityText.includes(String(value))) {
    throw new Error(`Persona identitySignals missing ${value}: ${identityText}`);
  }
}
if ((report.identitySignals?.fields || []).length < 4) throw new Error(`identitySignals fields incomplete: ${identityText}`);
if (String(report.lifeReading?.text || '').length < 180) {
  throw new Error(`lifeReading is too thin: ${textBlob(report.lifeReading)}`);
}
if ((report.dailyVibes || []).length < 3 || (report.oracleCards || []).length < 3 || !report.musicAge?.listeningAge) {
  throw new Error(`Persona playful modules incomplete: ${reportText.slice(0, 1200)}`);
}
if (!(/我爱你/.test(reportText) && /李荣浩/.test(reportText))) {
  throw new Error(`Persona did not cite the concrete song and artist: ${reportText.slice(0, 1200)}`);
}
if (!(/情绪/.test(reportText) && /干净|收得|评论/.test(reportText))) {
  throw new Error(`Persona did not connect the comment with the reading: ${reportText.slice(0, 1200)}`);
}
for (const value of Object.values(expected)) {
  if (!reportText.includes(String(value))) {
    throw new Error(`Persona did not use profile field ${value} in the broader report: ${reportText.slice(0, 1200)}`);
  }
}
assertNoDownrankLanguage(report, 'Persona report');
if (!report.recommendations?.artists?.length || !report.recommendations?.albums?.length || !report.recommendations?.songs?.length) {
  throw new Error(`Persona recommendations incomplete: ${textBlob(report.recommendations)}`);
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
const birthMentioned = chatText.includes(String(expected.birthYear)) || chatText.includes(`${String(expected.birthYear).slice(2)}年`);
if (!chatText.includes(expected.mbti) || !chatText.includes(expected.major) || !birthMentioned || !chatText.includes(expected.gender)) {
  throw new Error(`Persona chat did not cite identity fields: ${chatText}`);
}
assertNoDownrankLanguage(chatText, 'Persona chat');

const refreshed = await request('/api/auth', { method: 'GET' }, user.token);
assertNoDownrankLanguage(refreshed.user?.latestPersona, 'Refreshed auth latestPersona');
if (!textBlob(refreshed.user?.latestPersona).includes(expected.mbti)) {
  throw new Error(`Refreshed auth latestPersona did not expose normalized persona fields: ${textBlob(refreshed.user?.latestPersona)}`);
}

console.log(JSON.stringify({
  baseUrl,
  userId: user.user.id,
  roomId: room.room.id,
  fallback: persona.fallback,
  model: report.model,
  identitySignals: report.identitySignals,
  playfulModules: {
    lifeReadingLength: String(report.lifeReading?.text || '').length,
    dailyVibes: report.dailyVibes?.length || 0,
    oracleCards: report.oracleCards?.length || 0,
    musicAge: report.musicAge?.listeningAge || ''
  },
  recommendationCounts: {
    artists: report.recommendations?.artists?.length || 0,
    albums: report.recommendations?.albums?.length || 0,
    songs: report.recommendations?.songs?.length || 0
  },
  chatPreview: chatText.slice(0, 220)
}, null, 2));
