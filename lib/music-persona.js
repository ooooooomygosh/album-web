import { FieldValue } from 'firebase-admin/firestore';
import { db, json, requireUser } from '../api/_firebase.js';

function cleanText(value, max = 600) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanList(value, limit = 12, max = 80) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[，,、\n]/);
  return [...new Set(list.map((item) => cleanText(item, max)).filter(Boolean))].slice(0, limit);
}

function safeTone(value) {
  return ['warm', 'mystic', 'critic', 'playful'].includes(value) ? value : 'warm';
}

function safeHistoryMode(value) {
  return ['none', 'mine', 'room', 'selected'].includes(value) ? value : 'mine';
}

function fallbackPersona(user, stats = {}, tone = 'warm') {
  const name = user.name || '你';
  const artists = stats.topArtists?.slice(0, 5).map((item) => item.name).join('、') || '你反复带进房间的艺人';
  const albums = stats.topAlbums?.slice(0, 4).map((item) => item.name).join('、') || '那些被你认真收藏的专辑';
  const comments = stats.comments?.slice(0, 3).map((item) => item.text).join(' / ') || '你还没有留下足够多的评论';
  const musicAge = {
    label: '音乐年龄：26 岁左右',
    symbolicAge: 26,
    realAge: user.profile?.birthYear ? Math.max(0, new Date().getFullYear() - Number(user.profile.birthYear)) : '',
    note: '这是根据听歌资料生成的象征性音乐年龄，只表示审美成熟度和探索阶段，不等于现实年龄判断。'
  };
  const essay = [
    `${name} 当前能被看见的线索主要来自两类：一类是你主动填写或反复出现的偏好，比如 ${artists}、${albums}；另一类是你评论里暴露的表达方式，比如“${comments}”。这些信息合在一起，不是在证明你是什么固定人格，而是在说明你的审美按钮在哪里：你容易被带有夜色、留白、人声距离和一点点自我克制的作品击中。`,
    `如果你填写了专业、MBTI 或出生年份，它们只适合当弱线索：专业可能影响你整理信息的方式，MBTI 可能影响你怎么描述感受，但真正有用的证据仍然是你选择了哪些歌、哪些专辑，以及你怎样评论它们。你的歌单不像纯粹追热榜，更像在寻找“情绪有质感、制作不廉价、封面和声音能互相撑住”的作品。`,
    `所以推荐不应该只沿着同类歌手横向复制，而要分成两条路：一条是稳妥路线，继续给你人声、旋律和专辑气质上的熟悉感；另一条是稍微冒险的路线，把你从熟悉的夜晚质感里推出去一点，去听更强节奏、更陌生语言或更极端制作。这样推荐才不是“猜你喜欢”，而是“你可能会被新的自己冒犯一下，然后偷偷喜欢”。`
  ].join('\n\n');
  return {
    archetype: {
      title: tone === 'mystic' ? '夜航唱片巫师' : '玻璃唱片策展人',
      summary: `${name} 的听歌方式像把情绪放进展柜：表面在推荐，实际在给朋友递一张进入自己的门票。`
    },
    personality_dissection: {
      rational_vs_emotional: '你会用相对理性的方式整理音乐资料、专辑顺序和推荐理由，但真正让你按下收藏的，通常还是一句人声靠近时带来的情绪闪回。',
      comment_vibe: `从评论语气看，${comments} 这些片段更像在替情绪找一个不会太尴尬的出口：不直接摊牌，但会认真布置氛围。`
    },
    the_roast: '你的审美像一个给情绪写脚注的人：明明已经被副歌击中，还要假装是在研究专辑结构。',
    ui_theme_hint: {
      style: tone === 'mystic' ? 'Nocturne Liquid Glass' : 'Adaptive Glassmorphism 2.0',
      primary_color: tone === 'playful' ? '#ff7da8' : '#8fd8ff',
      bg_animation: '低频声波脉冲叠加缓慢流体高光'
    },
    profileName: tone === 'mystic' ? '夜航唱片占卜师' : '房间策展型听众',
    headline: `你的偏好线索主要指向 ${artists}，但评论里的语气说明你喜欢的不只是风格，而是“克制到有回声”的情绪质感。`,
    summary: `基于你填写的资料、选中的歌曲/专辑和评论片段，系统会优先分析这些线索之间的关联，再给出新的歌手、歌曲和专辑推荐。`,
    essay,
    musicAge,
    ageReflection: musicAge.realAge
      ? `现实年龄约 ${musicAge.realAge} 岁；这里的音乐年龄只表示你当前审美资料呈现出的成熟度和探索习惯，不作为主判断。`
      : '未填写出生年份，因此不做现实年龄对比。',
    tasteMap: [
      { title: '入口方式', text: '先被人声、旋律或一句标题抓住，再回到专辑顺序里理解它的位置。' },
      { title: '资料关联', text: '喜欢的歌手、风格和评论语气共同指向克制、留白、细腻人声和偏夜晚的制作质感。' },
      { title: '推荐方向', text: '稳妥推荐沿着相似人声和旋律走，冒险推荐应加入更强节奏或更陌生的制作语言。' }
    ],
    tasteDNA: [
      { axis: '人声距离', value: 84, label: '贴耳但不撒娇', evidence: artists ? artists.split('、').slice(0, 2) : [] },
      { axis: '专辑洁癖', value: 78, label: '没上下文会难受', evidence: albums ? albums.split('、').slice(0, 2) : [] },
      { axis: '深夜回放', value: 72, label: '越安静越上头', evidence: ['留白', '评论语气'] }
    ],
    evidenceCards: [
      { claim: '你把音乐当作情绪入口，而不是背景声。', basedOn: [artists, albums].filter(Boolean), confidence: 0.82 },
      { claim: '你推荐音乐时会先搭场景，再让朋友进入声音。', basedOn: comments ? [comments] : ['评论样本不足'], confidence: 0.72 }
    ],
    musicPersonality: {
      name: tone === 'mystic' ? '夜航唱片占卜师' : '房间策展型听众',
      socialPlaybackStyle: '会先挑一首入口明确的歌，再补充专辑背景和自己听到的细节。',
      lateNightPlaybackStyle: '深夜更在意人声距离、留白和一句歌词反复出现时带来的回声。'
    },
    listeningAge: musicAge.label,
    recommendations: {
      artists: ['王菲', 'Frank Ocean', '李荣浩'],
      bands: ['Radiohead', 'The xx', '落日飞车'],
      albums: ['唱遊', 'Blonde', '耳朵'],
      songs: ['暗涌', 'White Ferrari', '年少有为'],
      hidden_gem_music: {
        title: 'Beach House - Space Song',
        reason: '它不靠戏剧化爆发取胜，而是用循环、雾面合成器和延迟的情绪回弹，击中你这种“先装作冷静，后劲自己来”的听法。'
      },
      cross_domain: {
        book_or_movie: '电影《花样年华》：它和你的听歌方式一样，真正重要的东西总在没说出口的地方发光。',
        night_routine: '凌晨把一张专辑按曲序听完，只允许自己在每首歌后写一句不超过 12 个字的弹幕式遗言。'
      }
    },
    prescription: {
      nextAlbum: { title: '唱遊', artist: '王菲', reason: '稳妥地延续你对人声、留白和专辑气质的偏好。' },
      wildCard: { title: 'Heaven or Las Vegas', artist: 'Cocteau Twins', reason: '更冒险，但能把你对梦幻质感和不可直译情绪的偏好推远一点。' },
      doNotOverplay: '别连续三晚拿同一种孤独感腌自己，偶尔让节奏把身体叫醒。'
    },
    oraclePredictions: {
      thirtyDays: '',
      ninetyDays: '',
      oneYear: ''
    },
    conversationStarters: ['为什么我会反复喜欢同一种人声距离？', '根据这些记录，我下一张应该补哪张专辑？', '把我的口味说得更像朋友会怎么说？'],
    tags: ['房间策展人', '旋律记忆派', '专辑补完者', '深夜人声控', '评论型听众', '封面敏感', '慢热推荐', '情绪整理', '华语流行', '另类 R&B', '朋友共听', '温柔考据'],
    sourceNotes: [],
    riskNotice: '这是娱乐性音乐画像，不是心理测评、命运判断、职业建议或人生诊断。'
  };
}

function countBy(values, limit = 12) {
  const map = new Map();
  for (const value of values.map((item) => cleanText(item, 100)).filter(Boolean)) {
    map.set(value, (map.get(value) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

async function collectStats(user, mode, selected = []) {
  const roomsSnapshot = await db().collection('albumCircleRooms').where(`members.${user.id}`, '==', true).limit(30).get();
  const rooms = roomsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (mode === 'none') return { rooms: rooms.map((room) => ({ id: room.id, name: room.name })).slice(0, 12), items: [], topArtists: [], topAlbums: [], tags: [] };

  const allItems = [];
  const allComments = [];
  for (const room of rooms) {
    const query = mode === 'room'
      ? db().collection('albumCircleRooms').doc(room.id).collection('items').limit(50)
      : db().collection('albumCircleRooms').doc(room.id).collection('items').where('addedById', '==', user.id).limit(50);
    const [itemsSnapshot, commentsSnapshot] = await Promise.all([
      query.get().catch(() => ({ docs: [] })),
      db().collection('albumCircleRooms').doc(room.id).collection('comments').where('userId', '==', user.id).limit(30).get().catch(() => ({ docs: [] }))
    ]);
    for (const doc of itemsSnapshot.docs) {
      const item = doc.data();
      allItems.push({ ...item, docId: doc.id, id: item.id || doc.id, roomId: room.id, roomName: room.name });
    }
    for (const doc of commentsSnapshot.docs) {
      const comment = doc.data();
      allComments.push({
        id: doc.id,
        roomId: room.id,
        roomName: room.name,
        albumTitle: comment.albumTitle || '',
        text: cleanText(comment.text, 360),
        mood: comment.mood || '',
        createdAt: comment.createdAt?.toMillis?.() || comment.createdAt || 0
      });
    }
  }

  const selectedKeys = new Set(cleanList(selected, 40, 180).map((item) => item.toLowerCase()));
  const items = mode === 'selected' && selectedKeys.size
    ? allItems.filter((item) => selectedKeys.has(String(item.docId || '').toLowerCase()) || selectedKeys.has(String(item.id || '').toLowerCase()) || selectedKeys.has(String(item.externalId || '').toLowerCase()) || selectedKeys.has(`${item.title} ${item.artist}`.toLowerCase()))
    : allItems;

  return {
    rooms: rooms.map((room) => ({ id: room.id, name: room.name, visibility: room.visibility || 'unlisted' })).slice(0, 12),
    items: items.slice(0, 140).map((item) => ({
      id: item.id,
      docId: item.docId,
      roomId: item.roomId,
      type: item.type,
      title: item.title,
      artist: item.artist,
      albumTitle: item.albumTitle,
      year: item.year,
      tags: cleanList(item.tags, 8, 60),
      context: cleanText(item.aiProfile?.overview || item.background || item.context, 260)
    })),
    comments: allComments.sort((a, b) => b.createdAt - a.createdAt).slice(0, 80),
    topArtists: countBy(items.map((item) => item.artist), 12),
    topAlbums: countBy(items.map((item) => item.albumTitle || (item.type === 'album' ? item.title : '')), 12),
    tags: countBy(items.flatMap((item) => item.tags || []), 18)
  };
}

function personaQueries(user, stats) {
  const profile = user.profile || {};
  const artistNames = stats.topArtists?.slice(0, 4).map((item) => item.name) || [];
  const albumNames = stats.topAlbums?.slice(0, 4).map((item) => item.name) || [];
  const genres = cleanList(profile.favoriteGenres, 5, 60);
  const favorites = cleanList([...cleanList(profile.favoriteArtists, 5), ...cleanList(profile.favoriteBands, 5)], 6);
  return [
    [...artistNames, 'music style influences album reviews'].join(' '),
    [...albumNames, 'album review production context'].join(' '),
    [...genres, ...favorites, 'similar artists albums recommendation'].join(' '),
    [...artistNames.slice(0, 2), ...albumNames.slice(0, 2), 'listening guide music criticism'].join(' '),
    [...genres, 'music discovery recommendations artists bands albums'].join(' ')
  ].map((query) => cleanText(query, 180)).filter((query) => query.length > 10).slice(0, 8);
}

function sourceFromResult(result, query, index) {
  return {
    id: `S${index + 1}`,
    query,
    title: cleanText(result.title || result.url, 180),
    url: cleanText(result.url || '', 500),
    content: cleanText(result.content || result.raw_content || '', 850),
    score: Number(result.score || 0)
  };
}

async function tavilyMultiSearch(queries) {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !queries.length) return { enabled: Boolean(key), sources: [], error: key ? '' : 'TAVILY_API_KEY is not configured.' };
  const dedup = new Map();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const batches = await Promise.allSettled(queries.map(async (query) => {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          topic: 'general',
          search_depth: 'advanced',
          max_results: 3,
          include_answer: false,
          include_raw_content: false,
          include_images: false
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || `Tavily failed: ${response.status}`);
      return (data.results || []).map((result, index) => sourceFromResult(result, query, index));
    }));
    for (const batch of batches) {
      if (batch.status !== 'fulfilled') continue;
      for (const source of batch.value) {
        if (source.url && source.content && !dedup.has(source.url)) dedup.set(source.url, source);
      }
    }
    return { enabled: true, sources: [...dedup.values()].slice(0, 18) };
  } catch (error) {
    return { enabled: true, sources: [...dedup.values()].slice(0, 18), error: error.name === 'AbortError' ? 'Tavily request timed out.' : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

function sourcesForPrompt(research) {
  if (!research.enabled) return '联网检索未配置；不要编造具体音乐事实。';
  if (!research.sources.length) return `已尝试联网检索但来源不足：${research.error || 'no sources'}。不要编造具体音乐事实。`;
  return research.sources.map((source, index) => [
    `[S${index + 1}] ${source.title}`,
    `URL: ${source.url}`,
    `Query: ${source.query}`,
    `摘要: ${source.content}`
  ].join('\n')).join('\n\n');
}

function parseJson(raw) {
  const text = String(raw || '').replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const jsonText = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(jsonText);
}

function sanitizePersona(raw, user, stats, tone) {
  const fallback = fallbackPersona(user, stats, tone);
  const parsed = raw && typeof raw === 'object' ? raw : {};
  const essay = cleanText(parsed.essay, 5200);
  const archetype = parsed.archetype && typeof parsed.archetype === 'object' ? parsed.archetype : {};
  const dissection = parsed.personality_dissection && typeof parsed.personality_dissection === 'object' ? parsed.personality_dissection : {};
  const uiHint = parsed.ui_theme_hint && typeof parsed.ui_theme_hint === 'object' ? parsed.ui_theme_hint : {};
  const tasteDNA = Array.isArray(parsed.tasteDNA) ? parsed.tasteDNA : [];
  const evidenceCards = Array.isArray(parsed.evidenceCards) ? parsed.evidenceCards : [];
  const color = String(uiHint.primary_color || fallback.ui_theme_hint.primary_color || '').trim();
  const profileName = cleanText(parsed.profileName || parsed.musicPersonality?.name, 90) || fallback.profileName;
  const musicAge = parsed.musicAge && typeof parsed.musicAge === 'object' ? parsed.musicAge : {};
  const cleanMusicAge = {
    label: cleanText(musicAge.label || parsed.listeningAge, 120) || fallback.musicAge.label,
    symbolicAge: Number(musicAge.symbolicAge || 0) || fallback.musicAge.symbolicAge,
    realAge: Number(musicAge.realAge || 0) || fallback.musicAge.realAge || '',
    note: cleanText(musicAge.note, 260) || fallback.musicAge.note
  };
  const tasteMap = Array.isArray(parsed.tasteMap) ? parsed.tasteMap : [];
  return {
    archetype: {
      title: cleanText(archetype.title || profileName, 60) || fallback.archetype.title,
      summary: cleanText(archetype.summary || parsed.headline, 240) || fallback.archetype.summary
    },
    personality_dissection: {
      rational_vs_emotional: cleanText(dissection.rational_vs_emotional, 420) || fallback.personality_dissection.rational_vs_emotional,
      comment_vibe: cleanText(dissection.comment_vibe, 420) || fallback.personality_dissection.comment_vibe
    },
    the_roast: cleanText(parsed.the_roast, 260) || fallback.the_roast,
    ui_theme_hint: {
      style: cleanText(uiHint.style, 80) || fallback.ui_theme_hint.style,
      primary_color: /^#[0-9a-f]{6}$/i.test(color) ? color : fallback.ui_theme_hint.primary_color,
      bg_animation: cleanText(uiHint.bg_animation, 120) || fallback.ui_theme_hint.bg_animation
    },
    profileName,
    headline: cleanText(parsed.headline || archetype.summary, 180) || fallback.headline,
    summary: cleanText(parsed.summary || archetype.summary, 360) || fallback.summary,
    essay: essay.length >= 320 ? essay : fallback.essay,
    musicAge: cleanMusicAge,
    ageReflection: cleanText(parsed.ageReflection, 360) || fallback.ageReflection,
    tasteMap: tasteMap.map((item) => ({
      title: cleanText(item?.title, 50),
      text: cleanText(item?.text, 260)
    })).filter((item) => item.title && item.text).slice(0, 6).length >= 3
      ? tasteMap.map((item) => ({
        title: cleanText(item?.title, 50),
        text: cleanText(item?.text, 260)
      })).filter((item) => item.title && item.text).slice(0, 6)
      : fallback.tasteMap,
    tasteDNA: tasteDNA.map((item) => ({
      axis: cleanText(item?.axis, 60),
      value: Math.max(0, Math.min(100, Number(item?.value || 0))),
      label: cleanText(item?.label, 100),
      evidence: cleanList(item?.evidence, 4, 80)
    })).filter((item) => item.axis && item.label).slice(0, 6).length >= 3
      ? tasteDNA.map((item) => ({
        axis: cleanText(item?.axis, 60),
        value: Math.max(0, Math.min(100, Number(item?.value || 0))),
        label: cleanText(item?.label, 100),
        evidence: cleanList(item?.evidence, 4, 80)
      })).filter((item) => item.axis && item.label).slice(0, 6)
      : fallback.tasteDNA,
    evidenceCards: evidenceCards.map((item) => ({
      claim: cleanText(item?.claim, 180),
      basedOn: cleanList(item?.basedOn, 5, 120),
      confidence: Math.max(0, Math.min(1, Number(item?.confidence || 0.6)))
    })).filter((item) => item.claim).slice(0, 5).length >= 2
      ? evidenceCards.map((item) => ({
        claim: cleanText(item?.claim, 180),
        basedOn: cleanList(item?.basedOn, 5, 120),
        confidence: Math.max(0, Math.min(1, Number(item?.confidence || 0.6)))
      })).filter((item) => item.claim).slice(0, 5)
      : fallback.evidenceCards,
    musicPersonality: {
      name: profileName,
      socialPlaybackStyle: cleanText(parsed.musicPersonality?.socialPlaybackStyle, 240) || fallback.musicPersonality.socialPlaybackStyle,
      lateNightPlaybackStyle: cleanText(parsed.musicPersonality?.lateNightPlaybackStyle, 240) || fallback.musicPersonality.lateNightPlaybackStyle
    },
    listeningAge: cleanMusicAge.label,
    recommendations: {
      artists: cleanList(parsed.recommendations?.artists, 8, 80).length ? cleanList(parsed.recommendations?.artists, 8, 80) : fallback.recommendations.artists,
      bands: cleanList(parsed.recommendations?.bands, 8, 80).length ? cleanList(parsed.recommendations?.bands, 8, 80) : fallback.recommendations.bands,
      albums: cleanList(parsed.recommendations?.albums, 10, 120).length ? cleanList(parsed.recommendations?.albums, 10, 120) : fallback.recommendations.albums,
      songs: cleanList(parsed.recommendations?.songs, 10, 120).length ? cleanList(parsed.recommendations?.songs, 10, 120) : fallback.recommendations.songs,
      hidden_gem_music: {
        title: cleanText(parsed.recommendations?.hidden_gem_music?.title, 120) || fallback.recommendations.hidden_gem_music.title,
        reason: cleanText(parsed.recommendations?.hidden_gem_music?.reason, 420) || fallback.recommendations.hidden_gem_music.reason
      },
      cross_domain: {
        book_or_movie: cleanText(parsed.recommendations?.cross_domain?.book_or_movie, 360) || fallback.recommendations.cross_domain.book_or_movie,
        night_routine: cleanText(parsed.recommendations?.cross_domain?.night_routine, 360) || fallback.recommendations.cross_domain.night_routine
      }
    },
    prescription: {
      nextAlbum: {
        title: cleanText(parsed.prescription?.nextAlbum?.title, 120) || fallback.prescription.nextAlbum.title,
        artist: cleanText(parsed.prescription?.nextAlbum?.artist, 120) || fallback.prescription.nextAlbum.artist,
        reason: cleanText(parsed.prescription?.nextAlbum?.reason, 320) || fallback.prescription.nextAlbum.reason
      },
      wildCard: {
        title: cleanText(parsed.prescription?.wildCard?.title, 120) || fallback.prescription.wildCard.title,
        artist: cleanText(parsed.prescription?.wildCard?.artist, 120) || fallback.prescription.wildCard.artist,
        reason: cleanText(parsed.prescription?.wildCard?.reason, 320) || fallback.prescription.wildCard.reason
      },
      doNotOverplay: cleanText(parsed.prescription?.doNotOverplay, 240) || fallback.prescription.doNotOverplay
    },
    oraclePredictions: {
      thirtyDays: cleanText(parsed.oraclePredictions?.thirtyDays, 260) || fallback.oraclePredictions.thirtyDays,
      ninetyDays: cleanText(parsed.oraclePredictions?.ninetyDays, 260) || fallback.oraclePredictions.ninetyDays,
      oneYear: cleanText(parsed.oraclePredictions?.oneYear, 260) || fallback.oraclePredictions.oneYear
    },
    conversationStarters: cleanList(parsed.conversationStarters, 6, 120).length >= 3 ? cleanList(parsed.conversationStarters, 6, 120) : fallback.conversationStarters,
    tags: cleanList(parsed.tags, 20, 40).slice(0, 20).length >= 12 ? cleanList(parsed.tags, 20, 40).slice(0, 20) : fallback.tags,
    sourceNotes: cleanList(parsed.sourceNotes, 10, 220),
    riskNotice: '这是娱乐性音乐画像，不是心理测评、命运判断、职业建议或人生诊断。'
  };
}

function safetyCheck(report) {
  const text = JSON.stringify({ ...report, riskNotice: '' });
  const banned = ['命中注定', '你一定', '人格缺陷', '心理问题', '职业适配', '情感关系注定'];
  return banned.filter((word) => text.includes(word));
}

async function readPersonaConfig() {
  const doc = await db().collection('albumCircleConfig').doc('ai').get().catch(() => null);
  return doc?.exists ? doc.data() : {};
}

function profilePromptBlock(user) {
  const profile = user.profile || {};
  return JSON.stringify({
    nickname: cleanText(user.name, 80),
    bio: cleanText(profile.bio, 420),
    publicTags: cleanList(user.publicTags, 24, 40),
    location: profile.location || '',
    favoriteGenres: cleanList(profile.favoriteGenres, 16, 60),
    favoriteArtists: cleanList(profile.favoriteArtists, 18, 80),
    favoriteBands: cleanList(profile.favoriteBands, 18, 80),
    favoriteAlbums: cleanList(profile.favoriteAlbums, 18, 120),
    gender: profile.gender || '',
    birthYear: profile.birthYear || '',
    mbti: profile.mbti || '',
    major: profile.major || ''
  });
}

async function callDeepSeekPersona({ key, model, messages, maxTokens = 3600, temperature = 0.72, signal }) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      response_format: messages.some((message) => /JSON/i.test(message.content || '')) ? { type: 'json_object' } : undefined,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `DeepSeek failed: ${response.status}`);
  return data;
}

async function personaChatHandler(req, res) {
  try {
    const user = await requireUser(req);
    const body = req.body || {};
    const question = cleanText(body.question, 700);
    if (!question) return json(res, 400, { error: 'Missing question.' });
    const report = body.report || user.latestPersona || {};
    const historyMode = safeHistoryMode(body.history?.mode || report.historyMode || 'mine');
    const stats = await collectStats(user, historyMode, body.history?.selected || report.selectedItems || []);
    const research = await tavilyMultiSearch(personaQueries(user, stats).slice(0, 4));
    const key = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_PERSONA_MODEL || 'deepseek-v4-pro';
    if (!key) {
      return json(res, 200, {
        fallback: true,
        answer: 'AI 暂时不可用。可以先从你最近添加的歌手、专辑和公开 tags 里选 3 个关键词，我再帮你把问题拆成更具体的听歌路线。',
        research: { enabled: research.enabled, sources: [] }
      });
    }

    const config = await readPersonaConfig();
    const prompt = [
      config.personaPrompt ? `管理员补充要求：${cleanText(config.personaPrompt, 5000)}` : '',
      '你是 Album Circle 的音乐画像对话助手。像懂音乐的朋友一样回答，不要机械列字段。',
      '回答中文，350-650 字。要直接回应用户问题，并结合他的资料、音乐画像、添加历史和联网资料给出具体推荐。',
      '可以提到“可能/倾向/更像”，不要做心理诊断、命运断言、职业或情感硬判断。',
      `用户资料：${profilePromptBlock(user)}`,
      `最近画像：${JSON.stringify(report).slice(0, 14000)}`,
      `历史统计：${JSON.stringify(stats).slice(0, 28000)}`,
      '联网资料：',
      sourcesForPrompt(research),
      `用户问题：${question}`
    ].filter(Boolean).join('\n\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 36000);
    try {
      const data = await callDeepSeekPersona({
        key,
        model,
        signal: controller.signal,
        temperature: Number.isFinite(config.personaTemperature) ? config.personaTemperature : 0.7,
        maxTokens: Math.max(1200, Math.min(3200, Number(config.personaChatMaxTokens || 2200))),
        messages: [
          { role: 'system', content: 'You answer as a warm music taste analyst. No clinical, fate, career, or relationship claims.' },
          { role: 'user', content: prompt }
        ]
      });
      const answer = cleanText(data.choices?.[0]?.message?.content, 3600);
      return json(res, 200, {
        fallback: false,
        answer,
        truncated: data.choices?.[0]?.finish_reason === 'length',
        usage: data.usage || null,
        research: { enabled: research.enabled, error: research.error || '', sources: research.sources.slice(0, 8).map((source, index) => ({ id: `S${index + 1}`, title: source.title, url: source.url })) }
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return json(res, error.status || 502, { error: error.message || 'Persona chat failed.' });
  }
}

export async function musicPersonaHandler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const body = req.body || {};
    if (String(body.action || req.query.action || '') === 'persona-chat') return personaChatHandler(req, res);
    const tone = safeTone(body.tone);
    const historyMode = safeHistoryMode(body.history?.mode || body.historyMode);
    const stats = await collectStats(user, historyMode, body.history?.selected || []);
    const research = await tavilyMultiSearch(personaQueries(user, stats));
    const key = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_PERSONA_MODEL || 'deepseek-v4-pro';
    let report = fallbackPersona(user, stats, tone);
    let fallback = true;
    let usage = null;
    let finishReason = '';
    let debugError = '';

    if (key) {
      const config = await readPersonaConfig();
      const prompt = [
        config.personaPrompt ? `管理员补充要求：${cleanText(config.personaPrompt, 5000)}` : '',
        'Role：你是一位融合数据心理学、现代流行文化评论家、资深音乐鉴赏家的“AI 音乐精神侧写师”。你要根据用户资料、评论文字和音乐历史，做一场既刻薄又温柔、充满洞察力的灵魂解剖，并给出跨界推荐。',
        '拒绝平庸：不要写“内向但温柔”“感性又理性”这种正确废话。寻找用户资料、评论语气和音乐口味里的反差感、矛盾点、时代气味和审美洁癖。',
        '语言风格：轻微毒舌、讽刺文学、高密度金句、网络语感和深度共情混合。可以俏皮，但不要羞辱用户；吐槽只能打审美矛盾，不能攻击身份、性别、年龄、专业或心理健康。',
        '只输出严格 JSON。字段：archetype, personality_dissection, the_roast, ui_theme_hint, profileName, headline, summary, essay, musicAge, ageReflection, tasteMap, tasteDNA, evidenceCards, recommendations, prescription, conversationStarters, tags, sourceNotes, riskNotice。',
        'archetype: {title, summary}。title 不超过 15 个中文字符，要有戏剧张力和反差感。personality_dissection: {rational_vs_emotional, comment_vibe}。',
        'ui_theme_hint: {style, primary_color, bg_animation}。primary_color 必须是十六进制颜色。它会真实驱动前端视觉主题，所以要根据人格底色选择。',
        'essay 写 450-800 中文字即可，不要长篇报告。核心是分析用户填写资料、评论片段、所选歌曲/专辑之间的关联：为什么这些偏好会一起出现，它们暗示怎样的审美和可能的性格爱好。',
        'musicAge 可给但不是重点。不要把它写成未来规划或人生判断。',
        'tasteMap 给 3-5 个对象，每个 {title,text}，只写“资料关联/声音偏好/推荐理由/口味盲区”等，不要写社交播放方式、未来探索路线、核心矛盾、听歌动机。',
        'tasteDNA 给 4-6 个对象，每个 {axis,value,label,evidence}，value 是 0-100，evidence 来自用户资料、评论或音乐历史。evidenceCards 给 2-5 个 {claim,basedOn,confidence}。',
        'recommendations 包含 artists 5-8 个、bands 3-8 个、albums 6-10 个、songs 6-10 首、hidden_gem_music {title, reason}、cross_domain {book_or_movie, night_routine}。推荐要有一点意外，不要只推最显然的同类。',
        'recommendations 四个数组必须非空。即使资料不足，也要根据用户填写偏好和已选音乐给出合理推荐，不要留空。',
        'prescription 给 nextAlbum、wildCard、doNotOverplay。nextAlbum/wildCard 各含 title, artist, reason。',
        '不要输出 30 天、90 天、一年预测。不要写“未来的探索路线”。如果需要更多展开，放进 conversationStarters。',
        'conversationStarters 给 3-6 个用户可以继续追问的问题，例如“为什么我会喜欢这些人声？”“给我更冒险的专辑”。tags 给 12-20 个可公开展示的短标签。',
        '安全边界：不要心理测评化，不要命运断言，不要职业/情感硬建议，不要基于性别、年龄、MBTI 做刻板结论。可以说“如果你愿意，可以继续探索”。',
        `语气：${tone}`,
        `用户主动填写资料：${profilePromptBlock(user)}`,
        `历史模式：${historyMode}`,
        `房间与添加历史：${JSON.stringify(stats).slice(0, 52000)}`,
        '联网来源：',
        sourcesForPrompt(research)
      ].filter(Boolean).join('\n\n');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 36000);
      try {
        const data = await callDeepSeekPersona({
          key,
          model,
          signal: controller.signal,
          temperature: Number.isFinite(config.personaTemperature) ? config.personaTemperature : 0.72,
          maxTokens: Number(config.personaMaxTokens || process.env.DEEPSEEK_PERSONA_MAX_TOKENS || 3600),
          messages: [
            { role: 'system', content: 'Return one valid JSON object. Write grounded, warm Chinese music identity essays. Never use clinical, fate, career, or relationship claims.' },
            { role: 'user', content: prompt }
          ]
        });
        usage = data.usage || null;
        finishReason = data.choices?.[0]?.finish_reason || '';
        report = sanitizePersona(parseJson(data.choices?.[0]?.message?.content || '{}'), user, stats, tone);
        const banned = safetyCheck(report);
        if (finishReason === 'length' || banned.length) throw new Error(finishReason === 'length' ? 'Persona output was truncated.' : `Persona safety check failed: ${banned.join(', ')}`);
        fallback = false;
      } catch (error) {
        debugError = error.message || 'DeepSeek persona request failed.';
        report = fallbackPersona(user, stats, tone);
      } finally {
        clearTimeout(timeout);
      }
    }

    const latestPersona = {
      ...report,
      model: fallback ? 'fallback' : model,
      tone,
      historyMode,
      generatedAt: Date.now(),
      sources: research.sources.slice(0, 12).map((source, index) => ({ id: `S${index + 1}`, title: source.title, url: source.url }))
    };
    await db().collection('albumCircleUsers').doc(user.id).set({
      latestPersona,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return json(res, 200, {
      fallback,
      report: latestPersona,
      stats,
      research: {
        enabled: research.enabled,
        error: research.error || '',
        sources: latestPersona.sources
      },
      usage,
      finishReason,
      debugError
    });
  } catch (error) {
    return json(res, error.status || 502, { error: error.message || 'Music persona failed.' });
  }
}
