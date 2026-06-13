import { FieldValue } from 'firebase-admin/firestore';
import { db, json, requireUser } from '../api/_firebase.js';

function cleanText(value, max = 600) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanList(value, limit = 12, max = 80) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[，,、\n]/);
  return [...new Set(list.map((item) => cleanText(item, max)).filter(Boolean))].slice(0, limit);
}

function strengthenProfileLanguage(value, max = 600) {
  return cleanText(value, max)
    .replace(/弱线索/g, '同权线索')
    .replace(/弱证据/g, '同权证据')
    .replace(/辅助语境/g, '核心语境')
    .replace(/辅助线索/g, '核心线索')
    .replace(/调味料，不是主食材/g, '和音乐选择同样重要的主证据')
    .replace(/真正权重仍然是你选了哪些歌/g, '需要和音乐选择、评论同等级交叉判断')
    .replace(/不会盖过真实音乐选择/g, '会和真实音乐选择互相校准');
}

function safeTone(value) {
  return ['warm', 'mystic', 'critic', 'playful'].includes(value) ? value : 'warm';
}

function safeHistoryMode(value) {
  return ['none', 'mine', 'room', 'selected'].includes(value) ? value : 'mine';
}

function profileSignals(user = {}) {
  const profile = user.profile || {};
  return {
    genres: cleanList(profile.favoriteGenres, 16, 60),
    artists: cleanList(profile.favoriteArtists, 18, 80),
    bands: cleanList(profile.favoriteBands, 18, 80),
    albums: cleanList(profile.favoriteAlbums, 18, 120),
    songs: cleanList(profile.favoriteSongs, 24, 120),
    publicTags: cleanList(user.publicTags, 24, 40),
    bio: cleanText(profile.bio, 360),
    gender: cleanText(profile.gender, 40),
    birthYear: profile.birthYear || '',
    mbti: cleanText(profile.mbti, 16),
    major: cleanText(profile.major, 100)
  };
}

function identitySignalsFallback(user = {}) {
  const signals = profileSignals(user);
  const fields = [
    signals.gender && {
      label: '性别',
      value: signals.gender,
      reading: '它会和音乐选择同级参与分析：帮助理解叙述位置、表达边界和亲密感如何进入审美，但不能被单独拿来下结论。'
    },
    signals.birthYear && {
      label: '出生年份',
      value: String(signals.birthYear),
      reading: '它会参与判断成长年代、平台记忆和流行文化曝光顺序，再和你具体喜欢的歌手、专辑、评论一起交叉验证。'
    },
    signals.mbti && {
      label: 'MBTI',
      value: signals.mbti,
      reading: '它作为心理标签参与“你如何解释自己”的层面，和评论语气、音乐情绪入口一起构成画像，但不能当作诊断。'
    },
    signals.major && {
      label: '专业',
      value: signals.major,
      reading: '它作为社会身份和训练背景参与分析：可能影响你整理证据、拆解作品和描述感受的方式，并与音乐偏好同级互证。'
    }
  ].filter(Boolean);
  return {
    summary: fields.length
      ? `已读取到这些背景线索：${fields.map((field) => `${field.label}=${field.value}`).join('，')}。它们会和音乐选择、评论文字同等级参与分析。`
      : '你还没有填写性别、出生年份、MBTI 或专业；画像会主要依据音乐偏好、评论和添加历史。',
    fields,
    caveat: '同等级参与不等于单独定性：这些资料必须和音乐选择、评论证据交叉解释，不做性格缺陷、命运、职业或情感判断。'
  };
}

function humanSpiritMapFallback(user = {}, stats = {}) {
  const signals = profileSignals(user);
  const identity = identitySignalsFallback(user);
  const artists = cleanList([
    ...signals.artists,
    ...signals.bands,
    ...(stats.topArtists || []).map((item) => item.name)
  ], 8, 80);
  const works = cleanList([
    ...signals.albums,
    ...signals.songs,
    ...(stats.items || []).slice(0, 8).map((item) => [item.title, item.artist].filter(Boolean).join(' - '))
  ], 10, 120);
  const genres = cleanList([...signals.genres, ...(stats.tags || []).map((item) => item.name)], 8, 80);
  const comments = (stats.comments || []).slice(0, 4).map((item) => item.text).filter(Boolean);
  const identityText = identity.fields.length ? identity.fields.map((field) => `${field.label}=${field.value}`).join('，') : '身份资料还不完整';
  const musicText = [artists.join('、'), works.join('、'), genres.join('、')].filter(Boolean).join(' / ') || '音乐样本还不多';
  return {
    title: identity.fields.length ? '身份与声音的精神图谱' : '待补完的精神图谱',
    thesis: `这份画像把 ${identityText} 和 ${musicText} 放在同一层级阅读：身份资料解释“你从哪里听”，音乐选择解释“你被什么击中”，评论解释“你如何把击中说出口”。`,
    text: [
      `如果只看音乐，你像是在寻找有气质、有留白、能被反复解释的声音；如果把 ${identityText} 一起放进来，画像会更立体：这些资料不是附注，而是你理解音乐、组织感受和选择推荐入口的同权证据。`,
      `这张精神图谱的戏剧性在于：理性身份会要求作品站得住，感性品味又会被人声、旋律和氛围里的暗流带走。你可能一边需要清晰结构，一边又偏爱那些不把情绪讲满的歌。评论样本${comments.length ? `里出现了“${comments[0]}”这样的表达` : '还不多'}，说明后续只要文字更多，画像会更能抓住你是用概念、场景、身体感还是记忆来理解音乐。`
    ].join('\n\n'),
    tensions: [
      { axis: '人口统计 x 年代声景', evidence: identity.fields.filter((field) => ['性别', '出生年份'].includes(field.label)).map((field) => `${field.label}=${field.value}`), reading: '用来理解成长年代、平台记忆和表达位置，再与具体作品互相校准。' },
      { axis: 'MBTI x 评论语气', evidence: cleanList([signals.mbti, ...comments], 5, 140), reading: '用来观察你倾向如何解释自己的感受：是抽象归纳、场景化叙述，还是直接描述声音触感。' },
      { axis: '专业 x 听歌方法', evidence: cleanList([signals.major, ...works], 6, 140), reading: '用来判断你是否更在意结构、证据、制作逻辑或作品之间的系统性关联。' },
      { axis: '身份底色 x 音乐欲望', evidence: cleanList([...identity.fields.map((field) => field.value), ...artists, ...genres], 8, 120), reading: '把“我是谁”和“我反复选择什么声音”放在一起看，寻找审美里的反差和自我投射。' }
    ].filter((item) => item.evidence.length),
    caveat: '这是娱乐性的音乐人格画像；可以大胆描绘反差和倾向，但所有判断都必须由身份资料、音乐选择与评论共同支撑。'
  };
}

function recommendationList(value, fallback = [], limit = 8, kind = 'music') {
  const source = Array.isArray(value) ? value : cleanList(value, limit, 120);
  const normalized = source.map((item) => {
    if (typeof item === 'string') {
      const text = cleanText(item, 140);
      if (!text) return null;
      return kind === 'artist' || kind === 'band'
        ? { name: text, reason: '', entry: '' }
        : { title: text, artist: '', reason: '', entry: '' };
    }
    const title = cleanText(item?.title || item?.name || item?.song || item?.album || item?.artist || item?.band, 140);
    const artist = cleanText(item?.artist || item?.by || item?.creator, 100);
    const reason = cleanText(item?.reason || item?.why, 360);
    const entry = cleanText(item?.entry || item?.startWith || item?.starter, 140);
    if (!title) return null;
    return kind === 'artist' || kind === 'band'
      ? { name: title, reason, entry }
      : { title, artist, reason, entry };
  }).filter(Boolean);
  if (normalized.length) return normalized.slice(0, limit);
  return fallback.slice(0, limit);
}

function fallbackRecommendationSet(signals, stats = {}) {
  const anchorArtists = signals.artists.length ? signals.artists : (stats.topArtists || []).map((item) => item.name);
  const anchorAlbums = signals.albums.length ? signals.albums : (stats.topAlbums || []).map((item) => item.name);
  const hasFaye = [...anchorArtists, ...anchorAlbums].some((item) => /王菲|faye/i.test(item));
  const hasRnb = [...signals.genres, ...anchorArtists].some((item) => /r&b|soul|frank|ocean|sza|the weeknd/i.test(item));
  const hasIndie = [...signals.genres, ...anchorArtists, ...signals.bands].some((item) => /indie|dream|shoegaze|radiohead|the xx|独立|梦幻/i.test(item));
  const artists = hasFaye
    ? ['林忆莲', '陈珊妮', '窦靖童', '椎名林檎', 'Mitski', 'Kelela']
    : hasRnb
      ? ['Kelela', 'SZA', 'Blood Orange', 'James Blake', 'Daniel Caesar', '王嘉尔']
      : ['陈珊妮', '林忆莲', 'Mitski', 'Sufjan Stevens', 'Blood Orange', 'Kelela'];
  const bands = hasIndie
    ? ['Beach House', 'Cocteau Twins', 'The xx', 'Portishead', 'Massive Attack']
    : ['The xx', 'Portishead', '落日飞车', 'Cocteau Twins', 'Beach House'];
  return {
    artists: artists.map((name) => ({ name, reason: '和你当前偏好在人声质地、情绪密度或制作留白上有可迁移的连接。', entry: '' })),
    bands: bands.map((name) => ({ name, reason: '适合作为从现有口味往外走一步的乐队入口。', entry: '' })),
    albums: [
      { title: hasFaye ? '盖亚' : 'Heaven or Las Vegas', artist: hasFaye ? '林忆莲' : 'Cocteau Twins', reason: '保留旋律与氛围，但把声音纹理推得更陌生一点。' },
      { title: hasRnb ? 'Take Me Apart' : 'Dummy', artist: hasRnb ? 'Kelela' : 'Portishead', reason: '把亲密人声和电子制作之间的张力讲得更锋利。' },
      { title: 'Depression Cherry', artist: 'Beach House', reason: '适合喜欢慢热、雾面和反复回放的人。' },
      { title: 'Fetch the Bolt Cutters', artist: 'Fiona Apple', reason: '如果你想听更像人格直接撞上编曲的专辑，它很合适。' },
      { title: '0', artist: '林忆莲', reason: '华语语境里的成熟制作、身体感和精神性可以一起出现。' },
      { title: 'Cupid Deluxe', artist: 'Blood Orange', reason: '把流行、R&B、独立气质和城市夜色揉在一起。' }
    ],
    songs: [
      { title: 'Cellophane', artist: 'FKA twigs', reason: '人声脆弱但编曲克制，适合测试你对“近距离情绪”的耐受度。' },
      { title: 'On Hold', artist: 'The xx', reason: '旋律入口直接，后劲来自采样和空白。' },
      { title: 'Sweet', artist: 'Cigarettes After Sex', reason: '把低速、回声和亲密感做成一条干净的线。' },
      { title: 'Good Days', artist: 'SZA', reason: '把自我整理写得轻盈，但不廉价。' },
      { title: '旅行的意义', artist: '陈绮贞', reason: '如果你的华语偏好重视叙述视角，这首是很好用的参照。' },
      { title: 'Everything Is Embarrassing', artist: 'Sky Ferreira', reason: '流行外壳下有很强的冷感与迷惘。' }
    ]
  };
}

function fallbackPersona(user, stats = {}, tone = 'warm') {
  const name = user.name || '你';
  const signals = profileSignals(user);
  const identitySignals = identitySignalsFallback(user);
  const humanSpiritMap = humanSpiritMapFallback(user, stats);
  const artists = (signals.artists.length ? signals.artists : stats.topArtists?.slice(0, 5).map((item) => item.name) || []).join('、') || '尚未稳定出现的歌手偏好';
  const albums = (signals.albums.length ? signals.albums : stats.topAlbums?.slice(0, 4).map((item) => item.name) || []).join('、') || '尚未稳定出现的专辑偏好';
  const songs = (signals.songs.length ? signals.songs : stats.items?.filter((item) => item.type !== 'album').slice(0, 5).map((item) => `${item.title} - ${item.artist}`) || []).join('、') || '还没有足够多的代表歌曲';
  const genres = signals.genres.join('、') || (stats.tags || []).slice(0, 5).map((item) => item.name).join('、') || '未填写风格';
  const comments = stats.comments?.slice(0, 4).map((item) => item.text).filter(Boolean).join(' / ') || '评论样本还不多';
  const recs = fallbackRecommendationSet(signals, stats);
  const essay = [
    `${name} 的资料不能只拆成“音乐”和“背景”两层，它们应该像一张精神图谱一样互相照亮：${identitySignals.fields.length ? identitySignals.fields.map((field) => `${field.label}=${field.value}`).join('，') : '身份资料还不完整'} 是你进入世界的坐标，风格 ${genres}、歌手 ${artists}、专辑 ${albums}、歌曲 ${songs} 则暴露你愿意被什么声音说服。前者解释你可能如何组织经验，后者解释你反复把自己交给什么氛围。`,
    `评论片段里能看到另一层偏好：“${comments}”。如果把专业、MBTI、出生年份和性别这些线索放进同一张表，它们不是音乐之外的附属品，而是理解“为什么你会这样听、这样写、这样选择”的同级证据。现在的你更像是在用音乐确认一种审美秩序：封面、曲序、音色、歌词视角都要互相撑住，单首歌好听还不够，它最好能通向一整张作品或一种气质。`,
    `因此推荐不该只是把同类艺人横向复制给你，而要拆成两类：一类保留你已经喜欢的人声距离、旋律阴影和专辑感；另一类故意把你推向更陌生的制作、更强的节奏或更锋利的表达。前者让你安心，后者让你的歌单有新的边界。`
  ].join('\n\n');
  return {
    archetype: {
      title: tone === 'mystic' ? '夜航审美师' : '展柜型听众',
      summary: `${name} 的口味像在给情绪布展：不只收藏“好听”，更在意一首歌能不能撑起气质、场景和自我叙述。`
    },
    profileName: tone === 'mystic' ? '夜航审美师' : '展柜型听众',
    headline: `你的偏好线索指向 ${artists}，但真正的按钮是 ${genres} 里那种“旋律抓人、气质不塌”的声音。`,
    summary: `这份画像优先读取你填写的歌手、乐队、专辑、歌曲和评论，再用添加历史与联网资料补足推荐，不再硬套固定人格模板。`,
    personalitySketch: {
      text: `你像那种会被一首歌击中，却还要回头确认封面、曲序和制作逻辑的人。不是矫情，是你对“喜欢”有门槛：它必须既能当即时情绪入口，又经得起反复解释。`,
      softGuess: identitySignals.fields.length
        ? `${identitySignals.fields.map((field) => `${field.label}=${field.value}`).join('，')} 会和音乐选择同等参与画像：它们解释表达位置、年代记忆、信息整理方式和审美反差。`
        : '由于你还没有填写太多身份资料，系统主要依据音乐选择和评论语气来判断。'
    },
    identitySignals,
    humanSpiritMap,
    preferenceReading: [
      ...(identitySignals.fields.length ? [{ signal: '身份 / 年代 / 心理标签 / 专业', evidence: identitySignals.fields.map((field) => `${field.label}=${field.value}`), reading: '这些不是附属资料，而是和音乐选择同等级的解释维度：它们帮助判断你如何组织感受、如何描述作品、哪些声音会变成自我投射。' }] : []),
      { signal: '歌手 / 乐队', evidence: cleanList([...signals.artists, ...signals.bands, ...stats.topArtists?.map((item) => item.name) || []], 8, 80), reading: '偏好集中在声音人格强、制作气质明确、不是纯背景声的创作者。' },
      { signal: '专辑 / 歌曲', evidence: cleanList([...signals.albums, ...signals.songs, ...stats.items?.slice(0, 8).map((item) => item.title) || []], 10, 120), reading: '你更容易被能进入曲序、封面和叙事场景的作品留下。' },
      { signal: '评论语气', evidence: stats.comments?.slice(0, 4).map((item) => item.text) || [], reading: '评论越多，AI 会越能识别你是偏旋律、歌词、氛围、制作还是记忆触发。' }
    ],
    the_roast: '你不是在听歌，你是在给每一次心动写策展说明：副歌都快把你拿下了，还要先检查它有没有专辑上下文。',
    ui_theme_hint: {
      style: tone === 'mystic' ? 'Nocturne Liquid Glass' : 'Adaptive Glassmorphism 2.0',
      primary_color: tone === 'playful' ? '#ff7da8' : '#8fd8ff',
      bg_animation: '低频声波脉冲叠加缓慢流体高光'
    },
    essay,
    tasteMap: [
      { title: '精神图谱', text: humanSpiritMap.thesis },
      { title: '资料关联', text: `风格 ${genres} 和歌手 ${artists} 共同说明你在找“情绪质感”，不是只按流派归类。` },
      { title: '声音偏好', text: '人声、旋律线、空间感和编曲层次比热度更重要。' },
      { title: '推荐逻辑', text: '一半推荐保留熟悉质感，一半推荐故意带一点异物感。' }
    ],
    tasteDNA: [
      { axis: '人声敏感度', value: 84, label: '会被音色里的距离感击中', evidence: artists ? artists.split('、').slice(0, 2) : [] },
      { axis: '专辑上下文', value: 78, label: '单曲好听之外，还想知道它属于哪里', evidence: albums ? albums.split('、').slice(0, 2) : [] },
      { axis: '冒险半径', value: 64, label: '愿意试新东西，但需要一个熟悉入口', evidence: cleanList([genres], 2, 80) }
    ],
    evidenceCards: [
      { claim: '你更在意声音气质是否完整，而不是单纯流行度。', basedOn: [artists, albums, genres].filter(Boolean), confidence: 0.82 },
      { claim: '你的推荐方式偏向“给入口”，但这不是社交模板，而是你在意朋友能不能真的听进去。', basedOn: comments ? [comments] : ['评论样本不足'], confidence: 0.68 }
    ],
    recommendations: {
      ...recs,
      hidden_gem_music: {
        title: 'Beach House - Space Song',
        reason: '它不靠戏剧化爆发取胜，而是用循环、雾面合成器和延迟的情绪回弹，击中你这种“先装作冷静，后劲自己来”的听法。'
      },
      cross_domain: {
        book_or_movie: '电影《花样年华》：它和你的听歌方式一样，真正重要的东西总在没说出口的地方发光。',
        night_routine: '凌晨把一张专辑按曲序听完，只允许自己在每首歌后写一句不超过 12 个字的弹幕式遗言。'
      }
    },
    playlistRoutes: [
      { title: '安全但不无聊', description: '保留你已经喜欢的人声距离和专辑感。', items: ['Kelela - Take Me Apart', 'Beach House - Depression Cherry', '林忆莲 - 0'] },
      { title: '稍微冒犯一下', description: '加入更强制作、更陌生语言或更锋利的表达。', items: ['FKA twigs - Magdalene', 'Portishead - Dummy', 'Fiona Apple - Fetch the Bolt Cutters'] }
    ],
    conversationStarters: ['把推荐分成华语/欧美两组', '给我更冒险的 10 首歌', '为什么我会喜欢这些人声和编曲？', '根据我的评论重新分析一次'],
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
  const songNames = cleanList(profile.favoriteSongs, 4, 120);
  const genres = cleanList(profile.favoriteGenres, 5, 60);
  const favorites = cleanList([...cleanList(profile.favoriteArtists, 5), ...cleanList(profile.favoriteBands, 5)], 6);
  return [
    [...favorites, ...artistNames, ...genres, 'similar artists albums songs recommendation music criticism'].join(' '),
    [...albumNames, ...songNames, 'album review production style similar music'].join(' '),
    [...genres, ...favorites, 'underrated artists bands albums songs recommendations'].join(' '),
    [...artistNames.slice(0, 2), ...albumNames.slice(0, 2), ...songNames.slice(0, 2), 'music taste profile recommendation'].join(' '),
    [...genres, 'music discovery recommendations artists bands albums songs'].join(' ')
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

function normalizeIdentitySignals(value, user) {
  const fallback = identitySignalsFallback(user);
  const raw = value && typeof value === 'object' ? value : {};
  const rawFields = Array.isArray(raw.fields) ? raw.fields : [];
  const fields = rawFields.map((item) => ({
    label: cleanText(item?.label || item?.name, 40),
    value: cleanText(item?.value, 120),
    reading: strengthenProfileLanguage(item?.reading || item?.text || item?.note, 320)
  })).filter((item) => item.label && item.value).slice(0, 8);

  for (const required of fallback.fields) {
    const hasRequired = fields.some((field) => (
      field.label === required.label ||
      field.value === required.value ||
      `${field.label}=${field.value}`.includes(`${required.label}=${required.value}`)
    ));
    if (!hasRequired) fields.push(required);
  }

  return {
    summary: strengthenProfileLanguage(raw.summary, 520) || fallback.summary,
    fields,
    caveat: strengthenProfileLanguage(raw.caveat || raw.note, 360) || fallback.caveat
  };
}

function normalizeHumanSpiritMap(value, user, stats) {
  const fallback = humanSpiritMapFallback(user, stats);
  const raw = value && typeof value === 'object' ? value : {};
  const rawTensions = Array.isArray(raw.tensions) ? raw.tensions : [];
  const tensions = rawTensions.map((item) => ({
    axis: cleanText(item?.axis || item?.title, 80),
    evidence: cleanList(item?.evidence || item?.basedOn, 8, 140),
    reading: strengthenProfileLanguage(item?.reading || item?.text || item?.note, 460)
  })).filter((item) => item.axis && item.reading).slice(0, 6);
  return {
    title: cleanText(raw.title, 80) || fallback.title,
    thesis: strengthenProfileLanguage(raw.thesis || raw.summary, 560) || fallback.thesis,
    text: strengthenProfileLanguage(raw.text || raw.essay || raw.analysis, 1800) || fallback.text,
    tensions: tensions.length >= 3 ? tensions : fallback.tensions,
    caveat: strengthenProfileLanguage(raw.caveat || raw.note, 360) || fallback.caveat
  };
}

function sanitizePersona(raw, user, stats, tone) {
  const fallback = fallbackPersona(user, stats, tone);
  const parsed = raw && typeof raw === 'object' ? raw : {};
  const essay = cleanText(parsed.essay, 5200);
  const archetype = parsed.archetype && typeof parsed.archetype === 'object' ? parsed.archetype : {};
  const sketch = parsed.personalitySketch && typeof parsed.personalitySketch === 'object' ? parsed.personalitySketch : {};
  const uiHint = parsed.ui_theme_hint && typeof parsed.ui_theme_hint === 'object' ? parsed.ui_theme_hint : {};
  const recFallback = fallback.recommendations || fallbackRecommendationSet(profileSignals(user), stats);
  const tasteDNA = Array.isArray(parsed.tasteDNA) ? parsed.tasteDNA : [];
  const evidenceCards = Array.isArray(parsed.evidenceCards) ? parsed.evidenceCards : [];
  const preferenceReading = Array.isArray(parsed.preferenceReading) ? parsed.preferenceReading : [];
  const playlistRoutes = Array.isArray(parsed.playlistRoutes) ? parsed.playlistRoutes : [];
  const color = String(uiHint.primary_color || fallback.ui_theme_hint.primary_color || '').trim();
  const profileName = cleanText(parsed.profileName || parsed.musicPersonality?.name, 90) || fallback.profileName;
  const tasteMap = Array.isArray(parsed.tasteMap) ? parsed.tasteMap : [];
  const cleanTasteMap = tasteMap.map((item) => ({
    title: cleanText(item?.title, 50),
    text: cleanText(item?.text, 320)
  })).filter((item) => item.title && item.text).slice(0, 6);
  const cleanTasteDNA = tasteDNA.map((item) => ({
    axis: cleanText(item?.axis, 60),
    value: Math.max(0, Math.min(100, Number(item?.value || 0))),
    label: cleanText(item?.label, 120),
    evidence: cleanList(item?.evidence, 4, 100)
  })).filter((item) => item.axis && item.label).slice(0, 6);
  const cleanEvidence = evidenceCards.map((item) => ({
    claim: cleanText(item?.claim, 220),
    basedOn: cleanList(item?.basedOn, 6, 140),
    confidence: Math.max(0, Math.min(1, Number(item?.confidence || 0.65)))
  })).filter((item) => item.claim).slice(0, 5);
  const cleanPreferenceReading = preferenceReading.map((item) => ({
    signal: cleanText(item?.signal || item?.title, 80),
    evidence: cleanList(item?.evidence, 8, 140),
    reading: cleanText(item?.reading || item?.text, 420)
  })).filter((item) => item.signal && item.reading).slice(0, 6);
  const cleanPlaylistRoutes = playlistRoutes.map((item) => ({
    title: cleanText(item?.title, 80),
    description: cleanText(item?.description || item?.reason, 280),
    items: cleanList(item?.items, 8, 140)
  })).filter((item) => item.title && item.items.length).slice(0, 4);
  return {
    archetype: {
      title: cleanText(archetype.title || profileName, 60) || fallback.archetype.title,
      summary: cleanText(archetype.summary || parsed.headline, 240) || fallback.archetype.summary
    },
    profileName,
    headline: cleanText(parsed.headline || archetype.summary, 220) || fallback.headline,
    summary: cleanText(parsed.summary || archetype.summary, 420) || fallback.summary,
    personalitySketch: {
      text: cleanText(sketch.text || parsed.personalitySketch || parsed.personality, 620) || fallback.personalitySketch.text,
      softGuess: strengthenProfileLanguage(sketch.softGuess || sketch.note, 360) || fallback.personalitySketch.softGuess
    },
    identitySignals: normalizeIdentitySignals(parsed.identitySignals, user),
    humanSpiritMap: normalizeHumanSpiritMap(parsed.humanSpiritMap, user, stats),
    preferenceReading: cleanPreferenceReading.length >= 2 ? cleanPreferenceReading : fallback.preferenceReading,
    the_roast: cleanText(parsed.the_roast, 280) || fallback.the_roast,
    ui_theme_hint: {
      style: cleanText(uiHint.style, 80) || fallback.ui_theme_hint.style,
      primary_color: /^#[0-9a-f]{6}$/i.test(color) ? color : fallback.ui_theme_hint.primary_color,
      bg_animation: cleanText(uiHint.bg_animation, 120) || fallback.ui_theme_hint.bg_animation
    },
    essay: essay.length >= 320 ? essay : fallback.essay,
    tasteMap: cleanTasteMap.length >= 3 ? cleanTasteMap : fallback.tasteMap,
    tasteDNA: cleanTasteDNA.length >= 3 ? cleanTasteDNA : fallback.tasteDNA,
    evidenceCards: cleanEvidence.length >= 2 ? cleanEvidence : fallback.evidenceCards,
    recommendations: {
      artists: recommendationList(parsed.recommendations?.artists, recFallback.artists, 8, 'artist'),
      bands: recommendationList(parsed.recommendations?.bands, recFallback.bands, 8, 'band'),
      albums: recommendationList(parsed.recommendations?.albums, recFallback.albums, 10, 'album'),
      songs: recommendationList(parsed.recommendations?.songs, recFallback.songs, 10, 'song'),
      hidden_gem_music: {
        title: cleanText(parsed.recommendations?.hidden_gem_music?.title, 120) || fallback.recommendations.hidden_gem_music.title,
        reason: cleanText(parsed.recommendations?.hidden_gem_music?.reason, 420) || fallback.recommendations.hidden_gem_music.reason
      },
      cross_domain: {
        book_or_movie: cleanText(parsed.recommendations?.cross_domain?.book_or_movie, 360) || fallback.recommendations.cross_domain.book_or_movie,
        night_routine: cleanText(parsed.recommendations?.cross_domain?.night_routine, 360) || fallback.recommendations.cross_domain.night_routine
      }
    },
    playlistRoutes: cleanPlaylistRoutes.length >= 2 ? cleanPlaylistRoutes : fallback.playlistRoutes,
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
    favoriteSongs: cleanList(profile.favoriteSongs, 24, 120),
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
      '你是 Album Circle 的音乐画像对话助手。像一个懂音乐、会开玩笑但不油腻的朋友一样回答，不要机械列字段。',
      '回答中文，350-750 字。必须直接回应用户问题，并优先引用他的主动填写资料、公开 tags、评论片段、添加过的歌曲/专辑，再用联网资料补充具体推荐。',
      '如果用户问画像、偏好或性格分析，必须把性别、出生年份、MBTI、专业与音乐选择、评论放在同等级证据里交叉解释；可以写戏剧冲突、人格倾向、表达方式和审美反差，但不要做诊断或命运断言。',
      '如果用户问推荐，必须给出具体艺人/乐队/专辑/歌曲名和理由，不要只讲方法论。',
      '可以提到“可能/倾向/我猜”，不要做心理诊断、命运断言、职业或情感硬判断。',
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
        'Role：你是一位融合流行文化评论、资深音乐鉴赏和轻量数据洞察的 AI 音乐画像师。任务不是心理测评，而是根据用户主动填写的偏好、评论和添加历史，写出有品味、有具体证据、有人味的音乐口味画像，并推荐新的艺人、乐队、专辑和歌曲。',
        '最高优先级：用户主动填写资料 = 用户勾选/添加过的歌曲与专辑 = 用户评论文字；这三类是同等级主证据。房间统计和联网来源只用于补充。必须把人口统计数据（性别、年龄/出生年份）、心理标签（MBTI）、社会身份（专业）与感性的艺术品味（音乐、评论）结合，拼出立体、具体、甚至有戏剧冲突的人类精神图谱。',
        '拒绝平庸：不要写“内向但温柔”“感性又理性”“未来探索路线”“社交播放方式”“核心矛盾”“30 天/90 天预测”。不要空谈“专辑式聆听”。必须解释具体偏好线索之间的关联，特别是身份资料如何与音乐选择互相照亮、互相矛盾或互相补偿。',
        '语言风格：轻微毒舌、讽刺文学、网络语感和深度共情混合。可以俏皮，但不要羞辱用户；吐槽只能打审美矛盾，不能攻击身份、性别、年龄、专业或心理健康。',
        '只输出严格 JSON。字段：archetype, profileName, headline, summary, personalitySketch, identitySignals, humanSpiritMap, preferenceReading, the_roast, ui_theme_hint, essay, tasteMap, tasteDNA, evidenceCards, recommendations, playlistRoutes, conversationStarters, tags, sourceNotes, riskNotice。',
        'archetype: {title, summary}。title 不超过 15 个中文字符，要有戏剧张力和反差感。',
        'personalitySketch: {text, softGuess}。text 写性格化但非诊断的人格/审美画像；必须让性别、出生年份、MBTI、专业、音乐选择和评论共同塑造人物，不要把身份资料降格成“弱线索”。softGuess 用来说明这些资料如何与音乐偏好互相校准。',
        'identitySignals: {summary, fields, caveat}。fields 是数组，每项 {label,value,reading}。如果用户填写了性别、出生年份、MBTI、专业，必须逐项输出原值，比如“MBTI=INFJ”“专业=计算机”。reading 必须说明该字段如何与音乐选择或评论发生关系，例如年代声景、表达位置、信息组织、情绪处理、审美反差；禁止从单一字段推断人格缺陷、能力、职业、情感或命运。',
        'humanSpiritMap: {title, thesis, text, tensions, caveat}。这是核心模块。title 要像一份人格档案的标题；thesis 一句话概括“人口统计/MBTI/专业/音乐/评论”拼出的精神图谱；text 写 400-800 中文字，必须具体分析身份资料与音乐偏好的交叉、冲突、补偿和戏剧性；tensions 给 3-6 个 {axis,evidence,reading}，axis 例如“专业训练 x 情绪审美”“出生年代 x 声音记忆”“MBTI 自述 x 评论语气”“性别/表达位置 x 亲密人声”。',
        'preferenceReading 给 4-6 个对象，每个 {signal,evidence,reading}。必须覆盖：人口统计/MBTI/专业、用户填写的风格/歌手/乐队、喜欢的专辑/歌曲、评论或添加历史。evidence 必须是真实输入里的名称或评论片段。',
        'ui_theme_hint: {style, primary_color, bg_animation}。primary_color 必须是十六进制颜色。它会真实驱动前端视觉主题，所以要根据人格底色选择。',
        'essay 写 700-1100 中文字。重点分析：人口统计、MBTI、专业、歌手/乐队/风格/专辑/歌曲和评论为什么会一起出现；它们可能说明什么人格倾向、审美癖好、情绪入口、声音偏好、表达方式和生活姿态；最后自然过渡到推荐方向。',
        'tasteMap 给 4-6 个对象，每个 {title,text}，必须包含“精神图谱/身份与声音/心理标签与评论/专业训练与听歌方法/推荐逻辑”等维度。',
        'tasteDNA 给 4-6 个对象，每个 {axis,value,label,evidence}，value 是 0-100，evidence 必须混合使用用户资料、评论和音乐历史。evidenceCards 给 3-5 个 {claim,basedOn,confidence}，至少一张卡必须同时引用身份资料和音乐选择。',
        'recommendations 包含 artists 5-8 个、bands 3-8 个、albums 6-10 个、songs 6-10 首。artists/bands 的元素为 {name,reason,entry}；albums/songs 的元素为 {title,artist,reason,entry}。reason 必须说明为什么推荐给这个用户，entry 是入门曲/入门专辑/听法。',
        'recommendations 还包含 hidden_gem_music {title, reason}、cross_domain {book_or_movie, night_routine}。推荐要有一点意外，不要只推最显然的同类。四个数组必须非空。',
        'playlistRoutes 给 2-4 条路线，每条 {title,description,items}，例如“安全但不无聊”“稍微冒险”“华语侧线”。items 是具体作品，不是泛泛方向。',
        '不要输出 musicAge、oraclePredictions、prescription、personality_dissection、musicPersonality、30 天、90 天、一年预测、未来路线、社交播放方式、核心矛盾。',
        'conversationStarters 给 3-6 个用户可以继续追问的问题，例如“为什么我会喜欢这些人声？”“给我更冒险的专辑”。tags 给 12-20 个可公开展示的短标签。',
        '安全边界：可以做有趣、风格化、戏剧化的人格画像，但不要临床心理测评化，不要命运断言，不要职业/情感硬建议，不要基于性别、年龄、MBTI 或专业做单因素刻板结论。所有性格刻画必须由身份资料 + 音乐选择 + 评论共同支撑。',
        `语气：${tone}`,
        `用户主动填写资料：${profilePromptBlock(user)}`,
        `必须显式读取的背景线索：${JSON.stringify(identitySignalsFallback(user))}`,
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
