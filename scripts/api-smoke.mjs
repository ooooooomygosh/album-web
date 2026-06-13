const baseUrl = process.env.APP_URL || 'http://localhost:5173';
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const useVercelCurl = process.env.USE_VERCEL_CURL === '1';
const stamp = Date.now();

function withBypass(path) {
  if (!bypassSecret || !baseUrl.includes('vercel.app')) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}x-vercel-protection-bypass=${encodeURIComponent(bypassSecret)}`;
}

async function request(path, options = {}, token = '') {
  if (useVercelCurl) {
    const { spawnSync } = await import('node:child_process');
    const args = ['vercel', 'curl', path];
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options?.method || Object.keys(headers).length || options?.body) {
      args.push('--');
      if (options.method) args.push('--request', options.method);
      for (const [key, value] of Object.entries(headers)) args.push('--header', `${key}: ${value}`);
      if (options.body) args.push('--data', options.body);
    }
    const result = spawnSync('npx', args, { encoding: 'utf8', cwd: process.cwd() });
    if (result.status !== 0) throw new Error(`${path} vercel curl failed: ${result.stderr || result.stdout}`);
    const lines = result.stdout.trim().split(/\r?\n/);
    const jsonLine = [...lines].reverse().find((line) => line.trim().startsWith('{'));
    return JSON.parse(jsonLine);
  }

  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (bypassSecret) headers['x-vercel-protection-bypass'] = bypassSecret;
  const response = await fetch(`${baseUrl}${withBypass(path)}`, { ...options, headers });
  const text = await response.text();
  let data = {};
  try {
    data = JSON.parse(text || '{}');
  } catch (error) {
    throw new Error(`${path} returned non-JSON ${response.status}: ${text.slice(0, 280)}`);
  }
  if (!response.ok) throw new Error(`${path} failed ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

const userA = await request('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'signup', email: `alice-${stamp}@album.test`, password: 'password123', name: 'Alice', avatar: 'A' })
});
const userB = await request('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'signup', email: `ben-${stamp}@album.test`, password: 'password123', name: 'Ben', avatar: 'B' })
});
const userC = await request('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'signup', email: `cora-${stamp}@album.test`, password: 'password123', name: 'Cora', avatar: 'C' })
});
const adminLogin = process.env.ADMIN_LOGIN || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || '';
let adminUser = null;
let previousAdminConfig = null;
if (adminPassword) {
  adminUser = await request('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', email: adminLogin, password: adminPassword })
  });
  if (adminUser.user.role !== 'admin') throw new Error('Admin login did not return admin role.');
  previousAdminConfig = await request('/api/admin?action=config', {}, adminUser.token);
}

const roomA = await request('/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '周五听歌房', slug: `friday-${stamp}` })
}, userA.token);
await request('/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'join', roomId: roomA.room.id })
}, userB.token);
const roomC = await request('/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '另一个房间', slug: `other-${stamp}` })
}, userC.token);

const liSearch = await request('/api/search?term=%E6%9D%8E%E8%8D%A3%E6%B5%A9%20%E6%88%91%E7%88%B1%E4%BD%A0&type=song');
const liFirst = liSearch.candidates?.[0];
if (!liFirst || !/我[爱愛]你|I Love You/i.test(liFirst.title) || !/李荣浩|李榮浩|Li Ronghao/i.test(liFirst.artist)) throw new Error(`Li Ronghao search failed: ${JSON.stringify(liFirst)}`);

const albumSearch = await request('/api/search?term=Frank%20Ocean%20Blonde&type=album');
const blonde = albumSearch.candidates?.find((item) => /Blonde/i.test(item.title)) || albumSearch.candidates?.[0];
if (!blonde || blonde.type !== 'album') throw new Error(`Album search failed: ${JSON.stringify(blonde)}`);

const liBackground = await request('/api/ai/background', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ item: liFirst })
}, userA.token);
if (!liBackground.aiProfile?.melodyMotif || !liBackground.aiProfile?.arrangement || !liBackground.aiProfile?.discussionPrompts?.length) {
  throw new Error(`AI background profile incomplete: ${JSON.stringify(liBackground)}`);
}
const expectRichBackground = process.env.EXPECT_RICH_BACKGROUND !== '0';
if (expectRichBackground && (liBackground.fallback || liBackground.generated !== true)) {
  throw new Error(`AI background fell back instead of generating rich guide: ${JSON.stringify({ fallback: liBackground.fallback, generated: liBackground.generated, error: liBackground.error, model: liBackground.model })}`);
}
if ((process.env.EXPECT_TAVILY === '1' || expectRichBackground) && !liBackground.research?.sources?.length) {
  throw new Error(`Tavily research sources missing from background response: ${JSON.stringify(liBackground.research)}`);
}
const richFields = ['overview', 'albumContext', 'creativeBackground', 'melodyMotif', 'lyricPerspective', 'arrangement', 'releaseState'];
const usableBackgroundFields = richFields.filter((field) => String(liBackground.aiProfile?.[field] || '').length >= (field === 'overview' ? 100 : 70));
if (usableBackgroundFields.length < 6) throw new Error(`AI background profile has too few usable fields: ${JSON.stringify(Object.fromEntries(richFields.map((field) => [field, String(liBackground.aiProfile?.[field] || '').length])))}`);
const guideText = richFields.map((field) => liBackground.aiProfile[field]).join('\n');
if (!/推荐|先听|入口|主歌|副歌|旋律|歌词|人声|编曲|节奏|发行/.test(guideText)) {
  throw new Error(`AI background profile is not a concrete listening guide: ${guideText.slice(0, 300)}`);
}
const addedSong = await request(`/api/items?roomId=${roomA.room.id}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...liFirst, background: liBackground.background, aiProfile: liBackground.aiProfile, tags: [...(liFirst.tags || []), ...(liBackground.tags || [])] })
}, userA.token);
const addedAlbum = await request(`/api/items?roomId=${roomA.room.id}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...blonde, background: blonde.context })
}, userA.token);

const roomItemsForB = await request(`/api/items?roomId=${roomA.room.id}`, {}, userB.token);
if (!roomItemsForB.items?.some((item) => item.id === addedSong.item.id) || !roomItemsForB.items?.some((item) => item.id === addedAlbum.item.id)) throw new Error('User B cannot see room A items.');
if (!roomItemsForB.items?.find((item) => item.id === addedSong.item.id)?.aiProfile?.lyricPerspective) throw new Error('AI profile was not persisted with the song.');

const comment = await request(`/api/comments?roomId=${roomA.room.id}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: '这首歌适合放在房间里一起慢慢听。', mood: '9.0', albumId: addedSong.item.id, albumTitle: addedSong.item.title, author: 'Fake' })
}, userB.token);
if (comment.comment.author !== 'Ben') throw new Error('Comment author spoofing was not blocked.');

const aiComment = await request(`/api/ai/comment?roomId=${roomA.room.id}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ item: addedSong.item, comment: comment.comment })
}, userB.token);
if (!aiComment.comment?.isAi || !aiComment.comment?.text || aiComment.comment.text.length < 20) throw new Error('AI comment reply was not created.');

const loadedComments = await request(`/api/comments?roomId=${roomA.room.id}`, {}, userA.token);
if (!loadedComments.comments?.some((item) => item.author === 'Ben')) throw new Error('User A cannot see User B comment.');
if (!loadedComments.comments?.some((item) => item.isAi || item.author === 'Album Circle AI')) throw new Error('User A cannot see AI comment reply.');

const ownComment = loadedComments.comments.find((item) => item.author === 'Ben');
await request(`/api/comments?roomId=${roomA.room.id}&commentId=${ownComment.id}`, { method: 'DELETE' }, userB.token);
const afterCommentDelete = await request(`/api/comments?roomId=${roomA.room.id}`, {}, userA.token);
if (afterCommentDelete.comments?.some((item) => item.id === ownComment.id)) throw new Error('User could not delete own comment.');

await request(`/api/items?roomId=${roomA.room.id}&itemId=${addedSong.item.id}`, { method: 'DELETE' }, userA.token);
const afterItemDelete = await request(`/api/items?roomId=${roomA.room.id}`, {}, userA.token);
if (afterItemDelete.items?.some((item) => item.id === addedSong.item.id)) throw new Error('User could not delete own item.');

if (adminUser) {
  const adminDashboard = await request('/api/admin', {}, adminUser.token);
  if (!adminDashboard.rooms?.some((item) => item.id === roomA.room.id) || !adminDashboard.users?.length) throw new Error('Admin dashboard did not include rooms and users.');
  const adminConfig = await request('/api/admin?action=config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customPrompt: '后台测试：保持具体、谨慎、像推荐导览。',
      personaPrompt: '后台测试：音乐画像要自然、有趣、避免僵硬字段。',
      maxTokens: 1800,
      personaMaxTokens: 3600,
      personaChatMaxTokens: 2200,
      temperature: 0.45,
      personaTemperature: 0.78
    })
  }, adminUser.token);
  if (!adminConfig.config?.customPrompt?.includes('后台测试') || !adminConfig.config?.personaPrompt?.includes('音乐画像')) throw new Error('Admin AI config was not saved.');
  await request('/api/admin?action=config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customPrompt: previousAdminConfig.config?.customPrompt || '',
      personaPrompt: previousAdminConfig.config?.personaPrompt || '',
      maxTokens: previousAdminConfig.config?.maxTokens || 2100,
      personaMaxTokens: previousAdminConfig.config?.personaMaxTokens || 3600,
      personaChatMaxTokens: previousAdminConfig.config?.personaChatMaxTokens || 2200,
      temperature: previousAdminConfig.config?.temperature ?? 0.5,
      personaTemperature: previousAdminConfig.config?.personaTemperature ?? 0.72
    })
  }, adminUser.token);
}

const isolated = await request(`/api/items?roomId=${roomC.room.id}`, {}, userC.token);
if (isolated.items?.length) throw new Error('Room isolation failed: other room has unexpected items.');

const ai = await request('/api/ai/recommend', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ album: addedSong.item, comments: loadedComments.comments })
}, userA.token);
if (!ai.text || ai.text.length < 12) throw new Error('AI returned no useful text.');
if (process.env.EXPECT_TAVILY === '1' && !ai.research?.sources?.length) {
  throw new Error(`Tavily research sources missing from recommend response: ${JSON.stringify(ai.research)}`);
}

console.log(JSON.stringify({
  baseUrl,
  roomId: roomA.room.id,
  userA: userA.user.name,
  userB: userB.user.name,
  liFirst,
  albumFirst: blonde,
  addedSongId: addedSong.item.id,
  addedAlbumId: addedAlbum.item.id,
  admin: adminUser?.user?.name || 'skipped',
  aiProfileKeys: Object.keys(addedSong.item.aiProfile || {}),
  aiProfileLengths: Object.fromEntries(richFields.map((field) => [field, String(addedSong.item.aiProfile?.[field] || '').length])),
  backgroundGenerated: liBackground.generated,
  backgroundModel: liBackground.model,
  visibleItemsForB: roomItemsForB.items.length,
  commentsForA: loadedComments.comments.length,
  aiComment: aiComment.comment.text.slice(0, 140),
  isolatedRoomItems: isolated.items.length,
  backgroundResearchSources: liBackground.research?.sources?.length || 0,
  recommendResearchSources: ai.research?.sources?.length || 0,
  aiText: ai.text.slice(0, 160)
}, null, 2));
