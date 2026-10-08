import { FieldValue } from 'firebase-admin/firestore';
import { db, json, requireUser } from '../api/_firebase.js';
import { clampTokens, deepseekChat, resolveModel } from '../api/_ai/_model.js';

function cleanText(value, max = 600) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanList(value, limit = 12, max = 80) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[，,、\n]/);
  return [...new Set(list.map((item) => cleanText(item, max)).filter(Boolean))].slice(0, limit);
}

function strengthenProfileLanguage(value, max = 600) {
  return cleanText(value, max)
    .replace(/同等级?证据|同级证据|同权证据|同权线索|同一层级|解释维度|证据维度|精神图谱|坐标|互相校准|互相照亮|人口统计|资料解释|从哪里听|你被什么击中|被什么击中/g, '偏好线索')
    .replace(/未来探索路线|未来的探索路线|核心矛盾|社交播放方式|深夜播放方式|30\s*天|90\s*天|1\s*年探索预测/g, '下一批听歌彩蛋')
    .replace(/画像会更立体/g, '这张牌会更有戏')
    .replace(/不只是音乐和背景两层/g, '不是普通资料拼盘')
    .replace(/我(?:会|把|需要|正在|已经)?(?:如何|怎么)?分析/g, '画像判断')
    .replace(/这份画像把/g, '你的听歌习惯像把')
    // —— 反 AI 味加码：删掉"万金油谓语"和"作文式过渡"——
    .replace(/在(?:这个)?快节奏的?(?:现代)?社会里?[，,]?/g, '')
    .replace(/值得注意的是[，,]?|需要指出的是[，,]?|不难发现[，,]?|综上所述[，,]?|总而言之[，,]?|总的来说[，,]?/g, '')
    .replace(/首先[，,]其次[，,]最后[，,]?/g, '')
    .replace(/让我们一起|让我们来|接下来我们/g, '')
    .replace(/深入(?:地)?(?:探讨|挖掘|剖析)|全方位|多维度地?|立体化地?/g, '')
    .replace(/独一无二的?(?:存在|个体)/g, '一个很难复制的听众')
    .replace(/(?:这)?不仅仅?是[^，。]{0,12}[，,]更是[^。]{0,24}。/g, '')
    .replace(/无论是[^，。]{0,20}还是[^，。]{0,20}[，,]都[^。]{0,24}。/g, '')
    .replace(/(?:每个人|每一个人)都(?:有|是)[^。]{0,20}。/g, '')
    .replace(/希望(?:这|你)[^。]{0,24}。/g, '')
    .replace(/相信(?:你|这)[^。]{0,20}(?:会|能)[^。]{0,20}。/g, '')
    .replace(/不能只拆成[^。]*。?/g, '')
    .replace(/如果只看音乐[^。]*。?/g, '')
    .replace(/这些不是附属资料[^。]*。?/g, '')
    .replace(/不是心理测评[^。]*。?/g, '')
    .replace(/所有判断都必须[^。]*。?/g, '')
    .replace(/必须由[^。]*支撑/g, '更像一种娱乐性的猜测')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function hasDownrankLanguage(value) {
  return /弱线索|弱证据|辅助语境|辅助线索|调味料，不是主食材|真正权重仍然是你选了哪些歌|不会盖过真实音乐选择|背景线索只用来|同等级?证据|同级证据|同权证据|同权线索|精神图谱|解释维度|证据维度|人口统计|资料解释|从哪里听|你被什么击中|被什么击中|未来探索路线|未来的探索路线|未来路线|核心矛盾|社交播放方式|深夜播放方式|30\s*天|90\s*天|画像会更立体|不是音乐之外的附属品|不只是音乐和背景两层|human spirit map|%\s*可信度/.test(JSON.stringify(value || ''));
}

// —— AI 味检测：命中越多说明越像模板作文 ——
const AI_SMELL_PATTERNS = [
  /值得注意的是/, /综上所述/, /总而言之/, /总的来说/, /不难发现/,
  /在这个快节奏/, /深入探讨/, /多维度/, /全方位/, /立体化/,
  /独一无二的存在/, /不仅仅是.{0,12}更是/, /无论是.{0,16}还是.{0,16}都/,
  /每个人都/, /希望这份/, /相信你会/, /让我们一起/,
  /丰富多彩/, /五彩斑斓/, /淋漓尽致/, /熠熠生辉/, /娓娓道来/,
  /情感共鸣/, /心灵深处/, /灵魂深处/, /内心世界/, /治愈心灵/,
  /音乐的力量/, /音乐是一种/, /旋律优美/, /扣人心弦/, /沁人心脾/
];

function aiSmellHits(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '');
  return AI_SMELL_PATTERNS.filter((pattern) => pattern.test(text)).length;
}

/**
 * 锐度评分：具体锚点越多、套话越少，分数越高（0-100）。
 * 用来决定要不要触发一次"再写一遍，说人话"的重试。
 */
function sharpnessScore(report, user = {}, stats = {}) {
  const text = JSON.stringify(report || '');
  if (!text || text.length < 200) return 0;
  const anchors = musicEvidenceValues(user, stats);
  const anchorHits = anchors.filter((item) => item && text.includes(item)).length;
  const anchorRatio = anchors.length ? anchorHits / anchors.length : 0.5;
  const smell = aiSmellHits(text);
  // 具体名词密度：中英文专名、书名号、引号里的短语
  const concrete = (text.match(/《[^》]{1,40}》|"[^"]{2,40}"|[A-Z][a-zA-Z]{2,}(?:\s[A-Z][a-zA-Z]+)*/g) || []).length;
  const concreteScore = Math.min(40, concrete * 1.4);
  return Math.round(Math.max(0, Math.min(100, anchorRatio * 45 + concreteScore + 15 - smell * 7)));
}

function requiredIdentityValues(user = {}) {
  return identitySignalsFallback(user).fields.map((field) => String(field.value || '')).filter(Boolean);
}

function includesAllIdentityValues(value, user = {}) {
  const text = JSON.stringify(value || '');
  return requiredIdentityValues(user).every((item) => text.includes(item));
}

function musicEvidenceValues(user = {}, stats = {}) {
  const signals = profileSignals(user);
  return cleanList([
    ...signals.artists,
    ...signals.bands,
    ...signals.albums,
    ...signals.songs,
    ...signals.genres,
    ...(stats.items || []).slice(0, 8).flatMap((item) => [item.title, item.artist, item.albumTitle]),
    ...(stats.comments || []).slice(0, 3).map((item) => item.text)
  ], 18, 140);
}

function includesMusicEvidence(value, user = {}, stats = {}) {
  const evidence = musicEvidenceValues(user, stats);
  if (!evidence.length) return true;
  const text = JSON.stringify(value || '');
  return evidence.some((item) => text.includes(item));
}

function fallbackPersonaChatAnswer(user = {}, stats = {}, question = '') {
  const identity = identitySignalsFallback(user);
  const fields = identity.fields.map((field) => `${field.label}是 ${field.value}`);
  const signals = profileSignals(user);
  const recentItem = (stats.items || [])[0] || {};
  const recentComment = (stats.comments || [])[0] || {};
  const songLine = recentItem.title
    ? `你最近把《${recentItem.title}》和 ${recentItem.artist || '这位艺人'} 放进房间，这条线索会把推荐推向“情绪克制但有专辑感”的方向。`
    : '你最近的添加历史还不算多，所以我会先从你主动填写的资料和公开标签出发。';
  const commentLine = recentComment.text
    ? `你评论里提到“${cleanText(recentComment.text, 90)}”，这说明你在意的不是单纯爆点，而是情绪怎么被收住、怎么留下余味。`
    : '等你多写几条评论后，我能更准确地区分你喜欢的是旋律入口、歌词姿态还是编曲空间。';
  const tasteLine = [
    signals.artists.length ? `喜欢 ${signals.artists.slice(0, 3).join('、')}` : '',
    signals.albums.length ? `常提《${signals.albums.slice(0, 2).join('》《')}》` : '',
    signals.genres.length ? `风格偏向 ${signals.genres.slice(0, 3).join('、')}` : ''
  ].filter(Boolean).join('；');
  const identityLine = fields.length
    ? `我读到了：${fields.join('，')}。这些不会被我当成硬标签，只会影响推荐的口味：${signals.mbti || '你的性格标签'} 让我更倾向给你留白、人声距离和情绪后劲强的作品；${signals.major || '你的专业背景'} 会让我多看作品结构、制作完成度和专辑叙事；${signals.birthYear || '你的年代线索'} 会让推荐在互联网流行和老派专辑感之间找平衡；${signals.gender || '你的表达位置'} 只影响叙述语气，不做身份判断。`
    : '你还没有填太多身份资料，所以我会主要靠歌单、评论和公开标签判断。';
  return strengthenProfileLanguage([
    `你问的是“这些资料怎么影响推荐”，我的答案是：会影响入口，不会把你钉死。${identityLine}`,
    tasteLine ? `音乐口味上，${tasteLine}。${songLine}` : songLine,
    commentLine,
    `所以我会优先给你三类东西：第一类是人声近、情绪干净、适合夜里听的歌；第二类是专辑上下文强、需要按顺序进入的作品；第三类是和你现有口味相邻但稍微偏一点的艺人，让推荐不只是重复 ${signals.artists[0] || recentItem.artist || '你已经喜欢的名字'}。`
  ].join(' '), 1600);
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
      reading: '只拿来调味：你的表达位置可能更在意“说出口的方式”，不做严肃判断。'
    },
    signals.birthYear && {
      label: '出生年份',
      value: String(signals.birthYear),
      reading: '负责年代滤镜：你大概会同时被互联网流行和老派专辑感拉扯。'
    },
    signals.mbti && {
      label: 'MBTI',
      value: signals.mbti,
      reading: `${signals.mbti} 只当娱乐标签用：用来猜你的情绪入口和听歌仪式感。`
    },
    signals.major && {
      label: '专业',
      value: signals.major,
      reading: '像一个后台插件：嘴上说随便听听，心里还是会在意结构、逻辑和作品完成度。'
    }
  ].filter(Boolean);
  return {
    summary: fields.length
      ? `人格小料已备齐：${fields.map((field) => `${field.label}=${field.value}`).join('，')}。下面不是严肃诊断，是音乐占卜式锐评。`
      : '你还没有填太多个人资料，所以这次主要靠歌单、评论和添加历史来算命。',
    fields,
    caveat: '娱乐画像，别拿它当体检报告；准了就截图，不准就当 AI 在装懂。'
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
    title: identity.fields.length ? '人格牌面' : '待补完牌面',
    thesis: `牌面显示：${identityText} 加上 ${musicText}，很像一个“表面随和，实际对声音气质很挑”的听众。`,
    text: [
      `你不像那种只听热歌榜的人，更像“这首歌好听，但我还要看看它有没有气质”的类型。${musicText} 暴露出一个很明显的偏好：你容易被有人格的人声、留白感、叙事感和专辑气质打动。你可能嘴上说随便听，其实一首歌如果太塑料、太吵、太像短视频 BGM，你心里会默默扣分。`,
      `${identityText} 这类资料在这里只当娱乐滤镜用：如果你偏 INFP/艺术气质，那就是“浪漫但不想被看穿”；如果专业偏理工，那就是“感动归感动，作品最好也要站得住”。评论样本${comments.length ? `里那句“${comments[0]}”` : '还不多'}说明你听歌不是只听副歌爽不爽，而是会把声音带进场景、记忆和自我解释里。我的粗暴结论：你适合被温柔、精致、稍微带点阴影的音乐投喂，但也需要偶尔来一点更锋利的节奏把审美摇醒。`
    ].join('\n\n'),
    tensions: [
      { axis: '浪漫脑内剧场', evidence: cleanList([signals.mbti, ...comments], 5, 140), reading: '容易把一首歌听成一段关系、一条街、一次没说出口的情绪。' },
      { axis: '审美洁癖', evidence: cleanList([...artists, ...works], 6, 140), reading: '喜欢可以简单，但作品不能廉价；你会对声音气质和完成度有暗中评分。' },
      { axis: '慢热但会沉迷', evidence: cleanList([...genres, ...works], 8, 120), reading: '第一遍可能只是点头，第三遍开始替它写人生小作文。' },
      { axis: '需要熟人入口', evidence: cleanList([...identity.fields.map((field) => field.value), ...artists], 8, 120), reading: '新音乐不是不能试，但最好有一个你已经信任的音色、风格或故事把你牵进去。' }
    ].filter((item) => item.evidence.length),
    caveat: '本牌面只负责好玩，不负责给人生盖章。'
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
    const reason = strengthenProfileLanguage(item?.reason || item?.why, 360);
    const entry = strengthenProfileLanguage(item?.entry || item?.startWith || item?.starter, 140);
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

// —— 情绪光谱：把"听歌时最常被点亮的情绪"做成可视化用的数据 ——
const EMOTION_PALETTE = [
  { emotion: '夜色钝痛', color: '#6f7bff' },
  { emotion: '克制的浪漫', color: '#ff7da8' },
  { emotion: '清醒的疏离', color: '#8fd8ff' },
  { emotion: '突然想跳舞', color: '#ffd66e' },
  { emotion: '旧事回声', color: '#c08bff' },
  { emotion: '锋利的爽', color: '#ff8f5e' }
];

function fallbackEmotionSpectrum(user = {}, stats = {}) {
  const signals = profileSignals(user);
  const anchors = cleanList([
    ...signals.songs,
    ...signals.albums,
    ...signals.artists,
    ...(stats.items || []).slice(0, 6).map((item) => [item.title, item.artist].filter(Boolean).join(' - '))
  ], 6, 90);
  const moments = [
    '凌晨一点关灯之后，副歌刚好压上来的那三秒。',
    '想给某个人发消息，最后只是把这首歌单曲循环。',
    '在地铁上突然不想跟任何人说话的那一站。',
    '洗完澡站在房间中间，莫名其妙开始晃。',
    '翻到很久以前的聊天记录，背景音正好是它。',
    '被一段鼓点激起来，想把当天的破事全甩掉。'
  ];
  const base = [72, 66, 58, 51, 47, 41];
  return EMOTION_PALETTE.map((item, index) => ({
    emotion: item.emotion,
    value: base[index],
    color: item.color,
    moment: moments[index],
    anchor: anchors[index] || anchors[0] || ''
  }));
}

function fallbackSoulCard(user = {}, stats = {}, tone = 'warm') {
  const signals = profileSignals(user);
  const anchor = cleanList([...signals.songs, ...signals.albums, ...signals.artists], 1, 90)[0]
    || (stats.items || [])[0]?.title
    || '还没被记下的那首歌';
  return {
    title: tone === 'mystic' ? '夜航审美师' : tone === 'playful' ? '副歌埋伏者' : '展柜型听众',
    subtitle: '表面随和，内心有一套很凶的审美标准',
    glyph: '☾',
    element: '夜',
    oneLiner: `被「${anchor}」这类声音一击即中，然后假装只是路过。`,
    palette: ['#8fd8ff', '#c08bff', '#ff7da8'],
    starSign: '慢热座 · 上升深夜',
    rarity: '常见但难复制'
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
    `${name} 的听歌人格，我先直接下结论：你不是“随便听听”的人，你是那种会被一句旋律拎住衣领，然后假装只是路过的人。${identitySignals.fields.length ? identitySignals.fields.map((field) => `${field.label}=${field.value}`).join('，') : '个人资料还没填满'} 这些小料放进来以后，味道更明显：你大概率有一点慢热、一点审美洁癖、一点浪漫脑内剧场。喜欢 ${genres}，反复靠近 ${artists}、${albums}、${songs}，说明你吃的不是单纯高音或爆点，而是“这个声音有没有气质、有没有阴影、有没有让我替它补完故事”。`,
    `你的日常状态可能是这样：社交时看起来好说话，其实心里有一个很安静的雷达，谁讲话太吵、审美太糙、推荐太敷衍，你不一定当场反驳，但会默默把对方放进“先观察”文件夹。做事也像听歌，入口可以感性，最后还是想要作品完整。评论里出现“${comments}”这种表达时，能看出来你不是只说“好听”，你会在意声音怎么把人带进某种场景：内省、夜色、城市、遗憾、克制、突然很温柔的一刀。`,
    `所以给你的推荐不能只做同款复制。第一类要稳：保留人声质感、情绪留白和专辑完整度，让你可以放心沉下去。第二类要稍微冒犯：给一点更冷的电子、更锋利的节奏、更陌生的语言或更不讲道理的编曲，把你从“熟悉的浪漫”里拽出来。你真正适合的歌单不是“疗愈”，而是“漂亮地失控”：表面体面，内里波涛，最好还带一点只有你听得懂的私人暗号。`
  ].join('\n\n');
  return {
    archetype: {
      title: tone === 'mystic' ? '夜航审美师' : '展柜型听众',
      summary: `${name} 的口味像在给情绪布展：不只收藏“好听”，更在意一首歌能不能撑起气质、场景和自我叙述。`
    },
    profileName: tone === 'mystic' ? '夜航审美师' : '展柜型听众',
    headline: `你的偏好线索指向 ${artists}，但真正的按钮是 ${genres} 里那种“旋律抓人、气质不塌”的声音。`,
    summary: `这不是正经报告，是一张听歌塔罗：根据你填过的资料、评论和展柜历史，直接猜你的审美脾气、日常状态和下一批会爱上的声音。`,
    personalitySketch: {
      text: `你像那种明明已经被一首歌拿下，却还要回头确认封面、曲序和制作逻辑的人。不是矫情，是你对“喜欢”有门槛：它必须既能当即时情绪入口，又经得起反复回味。`,
      softGuess: identitySignals.fields.length
        ? `${identitySignals.fields.map((field) => `${field.label}=${field.value}`).join('，')} 这些只当娱乐滤镜：用来猜你的听歌姿势、日常反应和审美小毛病。`
        : '资料还不多，这次主要靠歌单和评论语气来算。'
    },
    identitySignals,
    humanSpiritMap,
    emotionSpectrum: fallbackEmotionSpectrum(user, stats),
    soulCard: fallbackSoulCard(user, stats, tone),
    preferenceReading: [
      ...(identitySignals.fields.length ? [{ signal: '人格小料', evidence: identitySignals.fields.map((field) => `${field.label}=${field.value}`), reading: '不做严肃定性，只拿来推测你的听歌姿势：可能浪漫、慢热、在意氛围，也有一点审美洁癖。' }] : []),
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
      { title: '最容易上头的点', text: humanSpiritMap.thesis },
      { title: '审美雷区', text: `风格 ${genres} 和歌手 ${artists} 暗示你不太吃粗糙堆料；旋律可以直给，但气质不能塌。` },
      { title: '朋友眼中的你', text: '看起来温和，其实听歌时很会挑刺；一旦真喜欢，又会把它讲得像命案现场。' },
      { title: '深夜歌单人格', text: '人声、旋律线、空间感和编曲层次比热度更重要，越安静越容易把你拖进去。' }
    ],
    tasteDNA: [
      { axis: '人声敏感度', value: 84, label: '音色一有距离感，你就容易开始上头', evidence: artists ? artists.split('、').slice(0, 2) : [] },
      { axis: '专辑上下文', value: 78, label: '单曲好听之外，还想知道它属于哪里', evidence: albums ? albums.split('、').slice(0, 2) : [] },
      { axis: '冒险半径', value: 64, label: '愿意试新东西，但需要一个熟悉入口', evidence: cleanList([genres], 2, 80) }
    ],
    evidenceCards: [
      { claim: '你很可能是“歌单外表温柔，内心审核很严”的类型。', basedOn: [artists, albums, genres].filter(Boolean), confidence: 0.82 },
      { claim: '你推荐歌不是为了显摆，是想看看对方能不能接住你的隐藏情绪。', basedOn: comments ? [comments] : ['评论样本不足'], confidence: 0.68 }
    ],
    lifeReading: {
      title: '日常人格盲盒',
      vibe: '浪漫慢热型审美洁癖',
      text: `我猜你不是那种外放到处安利的人，更像先在心里把一首歌盘到发光，再挑一个刚好的时机递给朋友。日常里可能有点慢热，回消息看状态，做事需要氛围感；但真被一段旋律拿下时会突然很认真，甚至开始研究歌词、封面、版本和现场。你大概率有一种“表面没事，内心已经开小剧场”的能力：别人只听到副歌，你已经听到街灯、旧聊天记录和某个没说完的下午。你不一定喜欢太用力的表达，反而更吃克制、留白、质感、漂亮但不直白的情绪。和朋友相处时，你可能不会第一时间把自己摊开，但会用一首歌、一句评论或一个很准的推荐偷偷交出一小块真心。`,
      socialStyle: '熟人面前话会变密，陌生场合先观察空气湿度；推荐歌时不是“你快听”，而是“这首可能适合你现在的精神状态”。',
      workStyle: '看起来凭感觉，其实会偷偷搭结构。灵感来了很会冲，但讨厌粗糙交付。',
      loveStyle: '容易被细节、声音和某种“没说满”的情绪打中；比起热烈表白，更吃长期稳定的温柔信号。'
    },
    dailyVibes: [
      { title: '房间状态', text: '灯光最好别太亮，歌最好别太吵，人最好别一直问“这谁唱的”。' },
      { title: '社交习惯', text: '看起来随和，实际上会默默给对方的歌单审美打分。' },
      { title: '做事方式', text: '需要一点仪式感启动，一旦进入状态会把细节抠得很漂亮。' }
    ],
    oracleCards: [
      { card: '月亮', title: '情绪雷达', text: '你对声音里的暧昧、留白和没讲完的故事很敏感。' },
      { card: '隐者', title: '私人歌房', text: '很多歌你不是拿来社交的，是拿来把自己重新拼起来的。' },
      { card: '星星', title: '未来耳朵', text: '下一阶段可以试一点更电子、更冷、更夜色的作品。' }
    ],
    musicAge: {
      realAgeHint: signals.birthYear ? `${new Date().getFullYear() - Number(signals.birthYear)} 岁左右` : '未知',
      listeningAge: '27 岁半夜两点',
      reason: '现实年龄可能还年轻，但听歌年龄明显偏成熟：不是只找刺激，而是找能安放情绪的声音。'
    },
    easterEggs: ['今日人格 BGM：一首开头很轻、后劲很大的歌。', '隐藏弱点：别人一句“这首歌很像你”就能把你拿下。', '幸运动作：把一首老歌重新听到像新歌。'],
    recommendations: {
      ...recs,
      hidden_gem_music: {
        title: 'Beach House - Space Song',
        reason: '它不靠戏剧化爆发取胜，而是用循环、雾面合成器和延迟的情绪回弹，专治你这种“先装作冷静，后劲自己来”的听法。'
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
  const timeoutMs = Math.max(12000, Math.min(45000, Number(process.env.PERSONA_TAVILY_TIMEOUT_MS || 30000)));
  const maxResults = Math.max(3, Math.min(5, Number(process.env.PERSONA_TAVILY_MAX_RESULTS || 4)));
  const sourceLimit = Math.max(12, Math.min(28, Number(process.env.PERSONA_TAVILY_SOURCE_LIMIT || 24)));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
          max_results: maxResults,
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
    return { enabled: true, sources: [...dedup.values()].slice(0, sourceLimit) };
  } catch (error) {
    return { enabled: true, sources: [...dedup.values()].slice(0, sourceLimit), error: error.name === 'AbortError' ? 'Tavily request timed out.' : error.message };
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

function compactStatsForPrompt(stats = {}) {
  return JSON.stringify({
    rooms: (stats.rooms || []).slice(0, 4).map((room) => ({ name: room.name, visibility: room.visibility })),
    recentItems: (stats.items || []).slice(0, 8).map((item) => ({
      type: item.type,
      title: item.title,
      artist: item.artist,
      albumTitle: item.albumTitle,
      year: item.year,
      tags: (item.tags || []).slice(0, 5),
      context: cleanText(item.context, 160)
    })),
    recentComments: (stats.comments || []).slice(0, 8).map((comment) => ({
      albumTitle: comment.albumTitle,
      text: cleanText(comment.text, 180),
      mood: comment.mood
    })),
    topArtists: (stats.topArtists || []).slice(0, 8),
    topAlbums: (stats.topAlbums || []).slice(0, 8),
    tags: (stats.tags || []).slice(0, 10)
  });
}

function personaSchemaPrompt({ compact = false } = {}) {
  const length = compact
    ? '硬性长度：输出必须完整闭合 JSON，总输出控制在 3600-5200 个中文字符；每个对象字段都要短但不能空。'
    : '硬性长度：输出要丰富，但必须完整闭合 JSON。总输出控制在 6200-7800 个中文字符左右；宁可每段略短，也不要因为写太多导致 JSON 截断。不要在 JSON 外追加任何解释。';
  return [
    length,
    '只输出严格 JSON。字段：archetype, profileName, headline, summary, personalitySketch, lifeReading, dailyVibes, oracleCards, musicAge, preferenceReading, emotionSpectrum, soulCard, the_roast, ui_theme_hint, essay, tasteMap, tasteDNA, evidenceCards, recommendations, playlistRoutes, conversationStarters, tags, easterEggs, identitySignals, humanSpiritMap, sourceNotes, riskNotice。',
    'archetype: {title, summary}。title 不超过 15 个中文字符，要有戏剧张力和反差感。',
    'emotionSpectrum 给 5-6 个 {emotion,value,color,moment,anchor}。emotion 是自造的情绪名（例如"夜色钝痛""克制的浪漫""突然想跳舞"），不要用"快乐/悲伤/愤怒"这种词典词。value 是 0-100 的强度且互不相同。color 必须是十六进制颜色，要和情绪气质对得上。moment 用一句非常具体的生活场景描述这种情绪什么时候会被点亮，必须有画面（时间、地点、动作三选二）。anchor 引用一首真实歌曲或艺人名。',
    'soulCard: {title,subtitle,glyph,element,oneLiner,palette,starSign,rarity}。这是一张可以截图分享的"灵魂卡牌"。title 是 4-8 字的称号，要独特到用户想拿去当昵称；subtitle 一句 10-20 字反差描述；glyph 是单个 Unicode 符号（例如 ☾ ✧ ⟡ ❍ ✦ ☍）；element 是单字元素（夜/雾/焰/潮/尘/晶）；oneLiner 一句 20-40 字的金句，必须点名一首真实作品；palette 是 3 个十六进制颜色；starSign 是自造星座式说法（例如"慢热座 · 上升深夜"）；rarity 一句稀有度调侃。',
    'personalitySketch: {text, softGuess}。text 直接说“你像什么人”：生活习惯、相处方式、审美弱点、听歌仪式感；softGuess 写一句短短的“我猜你”。不要写分析方法。',
    `lifeReading: {title,vibe,text,socialStyle,workStyle,loveStyle}。这是核心模块。用 ${compact ? '260-520' : '450-900'} 中文字直接侧写用户：日常状态、社交方式、做事细节、喜欢什么氛围、和朋友相处会怎样、浪漫/亲密关系里可能吃哪套。可以娱乐化、塔罗化、标签化。`,
    'dailyVibes 给 3-6 个 {title,text}，例如“回消息人格”“朋友局模式”“深夜状态”“做事习惯”。oracleCards 给 3-5 张 {card,title,text}，像塔罗牌但不要神神叨叨到看不懂。musicAge: {realAgeHint,listeningAge,reason}，听歌年龄必须是象征性的有趣说法。',
    'preferenceReading 给 4-6 个对象，每个 {signal,evidence,reading}。signal 用好玩的标题，例如“审美洁癖”“浪漫脑内剧场”“专辑封面雷达”。evidence 用真实歌手/专辑/评论片段。reading 直接输出结论，不要讲方法论。',
    'ui_theme_hint: {style, primary_color, bg_animation}。primary_color 必须是十六进制颜色。它会真实驱动前端视觉主题，所以要根据人格底色选择。',
    `essay 写 ${compact ? '520-850' : '850-1300'} 中文字。像一篇好玩的占卜长文：先下结论，再讲性格、生活、相处、审美、听歌弱点和推荐方向。不要出现“资料解释”“证据维度”“画像会更立体”这类 AI 套话。`,
    'tasteMap 给 4-6 个对象，每个 {title,text}，标题要像标签：例如“最容易上头的点”“审美雷区”“朋友眼中的你”“深夜歌单人格”。',
    'tasteDNA 给 4-6 个对象，每个 {axis,value,label,evidence}，value 是 0-100，label 要像一句锐评。evidenceCards 给 3-5 个 {claim,basedOn,confidence}，claim 要像占卜结果，不要写可信度解释。',
    `recommendations 包含 artists 5-8 个、bands 3-8 个、albums ${compact ? '5-8' : '6-10'} 个、songs ${compact ? '5-8' : '6-10'} 首。artists/bands 的元素为 {name,reason,entry}；albums/songs 的元素为 {title,artist,reason,entry}。reason 必须说明为什么推荐给这个用户，entry 是入门曲/入门专辑/听法。`,
    '推荐必须参考个人资料和喜好，例如 INFP、浪漫、安静、氛围、人声、华语流行、R&B、专辑感等。不要只推同类，要有“安全入口/稍微冒险/隐藏宝藏”。',
    'playlistRoutes 给 2-4 条路线，每条 {title,description,items}，例如“安全但不无聊”“深夜氛围”“稍微冒犯一下”。items 是具体作品。conversationStarters 给 3-6 个继续追问。tags 给 12-20 个可公开展示短标签。easterEggs 给 2-5 条小彩蛋。',
    'identitySignals 和 humanSpiritMap 只是兼容旧前端：可以填，但语气必须轻松，禁止出现“同级证据/精神图谱/坐标/解释维度/互相照亮/人口统计”。',
    [
      '【去 AI 味硬约束，违反即视为失败】',
      '1. 每一段结论后面必须紧跟一个只属于这个用户的具体锚点：真实歌名、艺人名、专辑名、他写过的评论原句、或者他添加过的条目。没有锚点的判断一律删掉重写。',
      '2. 禁止出现这些词：值得注意的是、综上所述、总而言之、不难发现、深入探讨、多维度、全方位、独一无二的存在、情感共鸣、心灵深处、灵魂深处、内心世界、治愈心灵、音乐的力量、旋律优美、扣人心弦、沁人心脾、丰富多彩、淋漓尽致、娓娓道来。',
      '3. 禁止"不仅仅是A，更是B"、"无论是A还是B，都C"、"每个人都…"、"希望这份…"、"相信你会…"这种作文句式。',
      '4. 禁止在结尾写祝福、鼓励、总结陈词。最后一句要么是一个画面，要么是一句刺人的判断，要么是一个具体动作建议。',
      '5. 形容词必须带对象。不要写"温柔的音乐"，要写"人声离麦克风只有五厘米的那种温柔"。',
      '6. 允许并鼓励：不完整的句子、破折号、突然转折、自问自答、轻微毒舌、网络黑话、非常具体的时间地点（"凌晨一点""地铁末班车""洗完澡站在房间中间"）。',
      '7. 宁可写得偏、写得刻薄、写得只对一半，也不要写得四平八稳谁都适用。'
    ].join('\n'),
    '安全边界：这是娱乐性音乐画像。可以推测性格和生活习惯，但不要临床心理诊断、命运断言、职业硬建议、情感关系硬判断。'
  ].join('\n');
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
  const normalized = {
    title: cleanText(raw.title, 80) || fallback.title,
    thesis: strengthenProfileLanguage(raw.thesis || raw.summary, 560) || fallback.thesis,
    text: strengthenProfileLanguage(raw.text || raw.essay || raw.analysis, 1800) || fallback.text,
    tensions: tensions.length >= 3 ? tensions : fallback.tensions,
    caveat: strengthenProfileLanguage(raw.caveat || raw.note, 360) || fallback.caveat
  };
  if (
    hasDownrankLanguage(normalized) ||
    !includesAllIdentityValues(normalized, user) ||
    !includesMusicEvidence(normalized, user, stats) ||
    cleanText(normalized.text, 2000).length < 260
  ) {
    return fallback;
  }
  return normalized;
}

function normalizeHexColor(value, fallbackColor) {
  const color = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color.slice(1).split('').map((char) => char + char).join('')}`.toLowerCase();
  }
  return fallbackColor;
}

function normalizeEmotionSpectrum(value, user, stats) {
  const fallback = fallbackEmotionSpectrum(user, stats);
  const rows = Array.isArray(value) ? value : [];
  const seen = new Set();
  const cleaned = rows.map((item, index) => {
    const emotion = strengthenProfileLanguage(item?.emotion || item?.name || item?.axis, 24);
    if (!emotion || seen.has(emotion)) return null;
    seen.add(emotion);
    const raw = Number(item?.value ?? item?.intensity);
    return {
      emotion,
      value: Math.max(8, Math.min(100, Number.isFinite(raw) ? Math.round(raw) : fallback[index]?.value || 55)),
      color: normalizeHexColor(item?.color, EMOTION_PALETTE[index % EMOTION_PALETTE.length].color),
      moment: strengthenProfileLanguage(item?.moment || item?.scene || item?.text, 90),
      anchor: cleanText(item?.anchor || item?.evidence, 90)
    };
  }).filter((item) => item && item.moment).slice(0, 6);
  return cleaned.length >= 4 ? cleaned.sort((a, b) => b.value - a.value) : fallback;
}

function normalizeSoulCard(value, user, stats, tone) {
  const fallback = fallbackSoulCard(user, stats, tone);
  const raw = value && typeof value === 'object' ? value : {};
  const palette = Array.isArray(raw.palette) ? raw.palette : [];
  const glyph = String(raw.glyph || '').trim();
  const element = String(raw.element || '').trim();
  const card = {
    title: strengthenProfileLanguage(raw.title || raw.name, 20) || fallback.title,
    subtitle: strengthenProfileLanguage(raw.subtitle || raw.tagline, 40) || fallback.subtitle,
    glyph: glyph && [...glyph].length <= 2 ? [...glyph][0] : fallback.glyph,
    element: element ? [...element].slice(0, 2).join('') : fallback.element,
    oneLiner: strengthenProfileLanguage(raw.oneLiner || raw.quote || raw.line, 80) || fallback.oneLiner,
    palette: [0, 1, 2].map((index) => normalizeHexColor(palette[index], fallback.palette[index])),
    starSign: strengthenProfileLanguage(raw.starSign || raw.sign, 32) || fallback.starSign,
    rarity: strengthenProfileLanguage(raw.rarity, 40) || fallback.rarity
  };
  return card.title.length >= 2 ? card : fallback;
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
  const dailyVibes = Array.isArray(parsed.dailyVibes) ? parsed.dailyVibes : [];
  const oracleCards = Array.isArray(parsed.oracleCards) ? parsed.oracleCards : [];
  const color = String(uiHint.primary_color || fallback.ui_theme_hint.primary_color || '').trim();
  const profileName = cleanText(parsed.profileName || parsed.musicPersonality?.name, 90) || fallback.profileName;
  const tasteMap = Array.isArray(parsed.tasteMap) ? parsed.tasteMap : [];
  const cleanTasteMap = tasteMap.map((item) => ({
    title: strengthenProfileLanguage(item?.title, 50),
    text: strengthenProfileLanguage(item?.text, 320)
  })).filter((item) => item.title && item.text).slice(0, 6);
  const cleanTasteDNA = tasteDNA.map((item) => ({
    axis: strengthenProfileLanguage(item?.axis, 60),
    value: Math.max(0, Math.min(100, Number(item?.value || 0))),
    label: strengthenProfileLanguage(item?.label, 120),
    evidence: cleanList(item?.evidence, 4, 100)
  })).filter((item) => item.axis && item.label).slice(0, 6);
  const cleanEvidence = evidenceCards.map((item) => ({
    claim: strengthenProfileLanguage(item?.claim, 220),
    basedOn: cleanList(item?.basedOn, 6, 140),
    confidence: Math.max(0, Math.min(1, Number(item?.confidence || 0.65)))
  })).filter((item) => item.claim).slice(0, 5);
  const cleanPreferenceReading = preferenceReading.map((item) => ({
    signal: cleanText(item?.signal || item?.title, 80),
    evidence: cleanList(item?.evidence, 8, 140),
    reading: strengthenProfileLanguage(item?.reading || item?.text, 420)
  })).filter((item) => item.signal && item.reading).slice(0, 6);
  const cleanPlaylistRoutes = playlistRoutes.map((item) => ({
    title: strengthenProfileLanguage(item?.title, 80),
    description: strengthenProfileLanguage(item?.description || item?.reason, 280),
    items: cleanList(item?.items, 8, 140)
  })).filter((item) => item.title && item.items.length).slice(0, 4);
  const lifeReading = parsed.lifeReading && typeof parsed.lifeReading === 'object' ? parsed.lifeReading : {};
  const cleanLifeReading = {
    title: strengthenProfileLanguage(lifeReading.title, 80) || fallback.lifeReading.title,
    vibe: strengthenProfileLanguage(lifeReading.vibe, 80) || fallback.lifeReading.vibe,
    text: strengthenProfileLanguage(lifeReading.text || lifeReading.analysis, 1800) || fallback.lifeReading.text,
    socialStyle: strengthenProfileLanguage(lifeReading.socialStyle, 360) || fallback.lifeReading.socialStyle,
    workStyle: strengthenProfileLanguage(lifeReading.workStyle, 360) || fallback.lifeReading.workStyle,
    loveStyle: strengthenProfileLanguage(lifeReading.loveStyle, 360) || fallback.lifeReading.loveStyle
  };
  const cleanDailyVibes = dailyVibes.map((item) => ({
    title: strengthenProfileLanguage(item?.title, 60),
    text: strengthenProfileLanguage(item?.text || item?.reading, 240)
  })).filter((item) => item.title && item.text).slice(0, 6);
  const cleanOracleCards = oracleCards.map((item) => ({
    card: strengthenProfileLanguage(item?.card, 40),
    title: strengthenProfileLanguage(item?.title, 70),
    text: strengthenProfileLanguage(item?.text || item?.reading, 260)
  })).filter((item) => item.title && item.text).slice(0, 5);
  const rawMusicAge = parsed.musicAge && typeof parsed.musicAge === 'object' ? parsed.musicAge : {};
  const cleanMusicAge = {
    realAgeHint: cleanText(rawMusicAge.realAgeHint, 60) || fallback.musicAge.realAgeHint,
    listeningAge: cleanText(rawMusicAge.listeningAge, 80) || fallback.musicAge.listeningAge,
    reason: strengthenProfileLanguage(rawMusicAge.reason, 320) || fallback.musicAge.reason
  };
  return {
    archetype: {
      title: strengthenProfileLanguage(archetype.title || profileName, 60) || fallback.archetype.title,
      summary: strengthenProfileLanguage(archetype.summary || parsed.headline, 240) || fallback.archetype.summary
    },
    profileName,
    headline: strengthenProfileLanguage(parsed.headline || archetype.summary, 220) || fallback.headline,
    summary: strengthenProfileLanguage(parsed.summary || archetype.summary, 420) || fallback.summary,
    personalitySketch: {
      text: strengthenProfileLanguage(sketch.text || parsed.personalitySketch || parsed.personality, 620) || fallback.personalitySketch.text,
      softGuess: strengthenProfileLanguage(sketch.softGuess || sketch.note, 360) || fallback.personalitySketch.softGuess
    },
    identitySignals: normalizeIdentitySignals(parsed.identitySignals, user),
    humanSpiritMap: normalizeHumanSpiritMap(parsed.humanSpiritMap, user, stats),
    emotionSpectrum: normalizeEmotionSpectrum(parsed.emotionSpectrum, user, stats),
    soulCard: normalizeSoulCard(parsed.soulCard, user, stats, tone),
    preferenceReading: cleanPreferenceReading.length >= 2 ? cleanPreferenceReading : fallback.preferenceReading,
    the_roast: cleanText(parsed.the_roast, 280) || fallback.the_roast,
    ui_theme_hint: {
      style: cleanText(uiHint.style, 80) || fallback.ui_theme_hint.style,
      primary_color: /^#[0-9a-f]{6}$/i.test(color) ? color : fallback.ui_theme_hint.primary_color,
      bg_animation: cleanText(uiHint.bg_animation, 120) || fallback.ui_theme_hint.bg_animation
    },
    essay: essay.length >= 320 ? strengthenProfileLanguage(essay, 8500) : fallback.essay,
    tasteMap: cleanTasteMap.length >= 3 ? cleanTasteMap.map((item) => ({ ...item, text: strengthenProfileLanguage(item.text, 320) })) : fallback.tasteMap,
    tasteDNA: cleanTasteDNA.length >= 3 ? cleanTasteDNA : fallback.tasteDNA,
    evidenceCards: cleanEvidence.length >= 2 ? cleanEvidence : fallback.evidenceCards,
    lifeReading: cleanLifeReading,
    dailyVibes: cleanDailyVibes.length >= 3 ? cleanDailyVibes : fallback.dailyVibes,
    oracleCards: cleanOracleCards.length >= 3 ? cleanOracleCards : fallback.oracleCards,
    musicAge: cleanMusicAge,
    easterEggs: cleanList(parsed.easterEggs, 6, 120).length >= 2 ? cleanList(parsed.easterEggs, 6, 120) : fallback.easterEggs,
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

export function normalizeStoredPersona(report, user, stats = {}) {
  if (!report || typeof report !== 'object') return null;
  const tone = safeTone(report.tone);
  const normalized = sanitizePersona(report, user, stats, tone);
  return {
    ...normalized,
    model: cleanText(report.model, 80) || 'stored',
    tone,
    ritualCompleted: Boolean(report.ritualCompleted),
    sharpness: Number.isFinite(Number(report.sharpness)) ? Number(report.sharpness) : null,
    historyMode: safeHistoryMode(report.historyMode || report.history?.mode || 'mine'),
    selectedItems: Array.isArray(report.selectedItems) ? report.selectedItems.slice(0, 40) : [],
    generatedAt: Number(report.generatedAt || report.createdAt || 0) || Date.now(),
    sources: Array.isArray(report.sources)
      ? report.sources.slice(0, 12).map((source, index) => ({
        id: cleanText(source?.id, 20) || `S${index + 1}`,
        title: cleanText(source?.title, 160),
        url: cleanText(source?.url, 700)
      })).filter((source) => source.title || source.url)
      : []
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

async function callDeepSeekPersona({
  key,
  model,
  messages,
  maxTokens = 16000,
  temperature = 0.8,
  signal,
  thinking = 'high',
  reasoningEffort
}) {
  const response = await deepseekChat({
    key,
    model,
    signal,
    messages,
    temperature,
    maxTokens,
    thinking,
    reasoningEffort,
    responseFormat: messages.some((message) => /JSON/i.test(message.content || '')) ? { type: 'json_object' } : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `DeepSeek failed: ${response.status}`);
  return data;
}

function mergeUsage(...items) {
  const usage = {};
  items.filter(Boolean).forEach((item, index) => {
    usage[`call${index + 1}`] = item;
  });
  return Object.keys(usage).length ? usage : null;
}

async function callPersonaJsonSection({
  key,
  model,
  signal,
  config,
  name,
  prompt,
  maxTokens,
  retryMaxTokens,
  temperature,
  thinking = 'high',
  reasoningEffort = null
}) {
  const data = await callDeepSeekPersona({
    key,
    model,
    signal,
    temperature,
    maxTokens,
    thinking,
    reasoningEffort,
    messages: [
      { role: 'system', content: `Return one valid JSON object for the "${name}" section. No markdown. No clinical, fate, career, or relationship claims.` },
      { role: 'user', content: prompt }
    ]
  });
  const firstFinish = data.choices?.[0]?.finish_reason || '';
  const firstContent = data.choices?.[0]?.message?.content || '{}';
  try {
    return {
      name,
      value: parseJson(firstContent),
      usage: data.usage || null,
      finishReason: firstFinish,
      recovered: false,
      error: ''
    };
  } catch (error) {
    const retryPrompt = [
      `上一轮 ${name} JSON 被截断或无法解析。请直接重新生成这一段，不要续写残缺文本。`,
      '必须输出完整 JSON 对象，字段齐全但语言更克制。不要解释失败原因。',
      prompt,
      `上一轮失败信息：finish_reason=${firstFinish || 'unknown'}; error=${cleanText(error.message, 220)}`
    ].join('\n\n');
    const retryData = await callDeepSeekPersona({
      key,
      model,
      signal,
      temperature: Math.min(0.76, Number.isFinite(config.personaTemperature) ? config.personaTemperature : 0.76),
      maxTokens: retryMaxTokens,
      thinking,
      reasoningEffort,
      messages: [
        { role: 'system', content: `Return one compact, complete, valid JSON object for the "${name}" section. No markdown.` },
        { role: 'user', content: retryPrompt }
      ]
    });
    return {
      name,
      value: parseJson(retryData.choices?.[0]?.message?.content || '{}'),
      usage: mergeUsage(data.usage || null, retryData.usage || null),
      finishReason: `${firstFinish || 'unknown'}; retry:${retryData.choices?.[0]?.finish_reason || ''}`,
      recovered: true,
      error: cleanText(error.message, 220)
    };
  }
}

async function callPersonaNarrativeDraft({ key, model, signal, config, name = 'persona-narrative', prompt, maxTokens, temperature, systemStyle }) {
  const thinking = 'high';
  const data = await callDeepSeekPersona({
    key,
    model,
    signal,
    temperature,
    maxTokens,
    thinking,
    reasoningEffort: 'max',
    messages: [
      {
        role: 'system',
        content: systemStyle || 'Write a vivid Chinese music persona reading. Be specific, playful, literary, warm, and a little sharp. No clinical, fate, career, or relationship claims.'
      },
      { role: 'user', content: prompt }
    ]
  });
  const text = strengthenProfileLanguage(data.choices?.[0]?.message?.content, 9000);
  const finishReason = data.choices?.[0]?.finish_reason || '';
  if (text.length >= 1200) {
    return { name, value: text, usage: data.usage || null, finishReason, recovered: false, error: '' };
  }
  const retryPrompt = [
    prompt,
    '上一轮主稿太短。请重写一篇更完整、更像真人写的音乐人格侧写，1800-2600 中文字，必须有具体歌曲/艺人/评论细节、日常性格推演、审美弱点、推荐方向。'
  ].join('\n\n');
  const retryData = await callDeepSeekPersona({
    key,
    model,
    signal,
    temperature: Math.min(0.86, Number.isFinite(config.personaTemperature) ? config.personaTemperature + 0.04 : 0.86),
    maxTokens,
    thinking,
    reasoningEffort: 'max',
    messages: [
      {
        role: 'system',
        content: 'Write a vivid long-form Chinese music persona reading. No markdown table. No clinical, fate, career, or relationship claims.'
      },
      { role: 'user', content: retryPrompt }
    ]
  });
  return {
    name,
    value: strengthenProfileLanguage(retryData.choices?.[0]?.message?.content, 9000),
    usage: mergeUsage(data.usage || null, retryData.usage || null),
    finishReason: `${finishReason || 'unknown'}; retry:${retryData.choices?.[0]?.finish_reason || ''}`,
    recovered: true,
    error: text ? 'narrative draft was too short' : 'empty narrative draft'
  };
}

async function callPersonaEditorJson({ key, model, signal, config, commonContext, drafts, schemaPrompt, maxTokens, retryMaxTokens, temperature }) {
  const prompt = [
    commonContext,
    '你现在不是填表机器人，而是 Album Circle 的主编。下面有几位 v4pro 写手分别写的人格侧写草稿。',
    '请把它们熔成最终版 JSON。最重要的是 essay 字段：它必须是一篇完整、统一、自然、有文学气口的“音乐灵魂侧写正文”，不要报告腔。',
    '保留草稿里最好的比喻、毒舌、生活细节、音乐细节、评论线索和推荐方向。删除套话、解释方法、过度谨慎和 AI 味。',
    '输出必须是严格 JSON，不要 markdown，不要 JSON 外解释。',
    schemaPrompt,
    '额外硬性要求：essay 1800-3000 中文字；lifeReading.text 700-1200 中文字；recommendations 可留给另一个推荐模块，但本 JSON 内的画像字段必须饱满。必须自然包含用户资料、具体歌曲/艺人/评论和日常性格推演。',
    drafts.map((draft, index) => `草稿 ${index + 1}（${draft.name || 'writer'}）：\n${draft.value}`).join('\n\n')
  ].join('\n\n');
  return callPersonaJsonSection({
    key,
    model,
    signal,
    config,
    name: 'persona-editor-json',
    prompt,
    temperature,
    maxTokens,
    retryMaxTokens
  });
}

// ============================================================
// 灵魂仪式问卷（persona-quiz）
// 用已有资料现场生成 3-4 道全屏题，用来补齐 AI 猜不到的那部分。
// ============================================================

const QUIZ_GLYPHS = ['☾', '✧', '⟡', '❍', '✦', '☍', '❈', '◈'];

function quizAnchors(user = {}, stats = {}) {
  const signals = profileSignals(user);
  const songs = cleanList([
    ...signals.songs,
    ...(stats.items || []).filter((item) => item.type !== 'album').map((item) => [item.title, item.artist].filter(Boolean).join(' - '))
  ], 8, 90);
  const albums = cleanList([...signals.albums, ...(stats.topAlbums || []).map((item) => item.name)], 6, 90);
  const artists = cleanList([...signals.artists, ...signals.bands, ...(stats.topArtists || []).map((item) => item.name)], 8, 70);
  const comments = (stats.comments || []).slice(0, 4).map((item) => cleanText(item.text, 90)).filter(Boolean);
  return { songs, albums, artists, comments, genres: signals.genres };
}

function fallbackQuiz(user = {}, stats = {}) {
  const anchors = quizAnchors(user, stats);
  const songA = anchors.songs[0] || anchors.albums[0] || '你歌单里最上头的那首';
  const songB = anchors.songs[1] || anchors.albums[1] || anchors.artists[0] || '你最近循环最多的那首';
  const artist = anchors.artists[0] || '你最常回去的那位';
  return {
    intro: {
      title: '还差三张牌',
      line: `资料只能猜到一半。剩下这几题，答完再翻牌。`
    },
    questions: [
      {
        id: 'q1',
        kind: 'pair',
        probe: '情绪入口',
        prompt: '现在是凌晨一点，你只能保留一首。',
        hint: '别想太久，第一反应就是答案。',
        options: [
          { id: 'a', label: songA, sub: '因为它懂我此刻的沉', glyph: '☾' },
          { id: 'b', label: songB, sub: '因为它能把我拽起来', glyph: '✦' }
        ]
      },
      {
        id: 'q2',
        kind: 'choice',
        probe: '社交姿态',
        prompt: `如果有人在你面前说「${artist} 不过如此」。`,
        hint: '这题在测你把音乐放在自我的哪一层。',
        options: [
          { id: 'a', label: '当场开辩', sub: '审美这事不能让', glyph: '⟡' },
          { id: 'b', label: '笑一下不说话', sub: '心里已经把人归档', glyph: '❍' },
          { id: 'c', label: '问他听什么', sub: '先摸清对方的底', glyph: '✧' },
          { id: 'd', label: '默默换歌', sub: '不值得浪费一首好歌', glyph: '☍' }
        ]
      },
      {
        id: 'q3',
        kind: 'dial',
        probe: '冒险半径',
        prompt: '一首歌前 15 秒你没听懂。',
        hint: '拖动决定你的耐心边界。',
        leftLabel: '直接下一首',
        rightLabel: '听完再说',
        defaultValue: 55
      },
      {
        id: 'q4',
        kind: 'word',
        probe: '私人暗号',
        prompt: '用一个词形容你听歌时最想到达的状态。',
        hint: '不用文艺，越怪越好。',
        placeholder: '例如：失重、断电、退潮'
      }
    ],
    outro: '牌面正在重排。'
  };
}

function sanitizeQuiz(raw, user, stats) {
  const fallback = fallbackQuiz(user, stats);
  const parsed = raw && typeof raw === 'object' ? raw : {};
  const introRaw = parsed.intro && typeof parsed.intro === 'object' ? parsed.intro : {};
  const rows = Array.isArray(parsed.questions) ? parsed.questions : [];
  const seen = new Set();
  const questions = rows.map((item, index) => {
    const prompt = strengthenProfileLanguage(item?.prompt || item?.question || item?.title, 70);
    if (!prompt || seen.has(prompt)) return null;
    seen.add(prompt);
    const kind = ['choice', 'pair', 'dial', 'word'].includes(String(item?.kind)) ? String(item.kind) : 'choice';
    const base = {
      id: `q${index + 1}`,
      kind,
      probe: strengthenProfileLanguage(item?.probe || item?.dimension, 20) || '隐藏偏好',
      prompt,
      hint: strengthenProfileLanguage(item?.hint || item?.sub, 50)
    };
    if (kind === 'dial') {
      const value = Number(item?.defaultValue);
      return {
        ...base,
        leftLabel: strengthenProfileLanguage(item?.leftLabel || item?.left, 20) || '完全不是',
        rightLabel: strengthenProfileLanguage(item?.rightLabel || item?.right, 20) || '完全是我',
        defaultValue: Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 50
      };
    }
    if (kind === 'word') {
      return {
        ...base,
        placeholder: strengthenProfileLanguage(item?.placeholder, 40) || '写一个词'
      };
    }
    const options = (Array.isArray(item?.options) ? item.options : []).map((option, optionIndex) => ({
      id: String.fromCharCode(97 + optionIndex),
      label: strengthenProfileLanguage(option?.label || option?.text || option, 40),
      sub: strengthenProfileLanguage(option?.sub || option?.reason, 32),
      glyph: (() => {
        const glyph = String(option?.glyph || '').trim();
        return glyph && [...glyph].length <= 2 ? [...glyph][0] : QUIZ_GLYPHS[(index * 2 + optionIndex) % QUIZ_GLYPHS.length];
      })()
    })).filter((option) => option.label).slice(0, 4);
    if (options.length < 2) return null;
    return { ...base, kind: options.length === 2 ? kind : 'choice', options };
  }).filter(Boolean).slice(0, 4);

  if (questions.length < 3) return fallback;
  return {
    intro: {
      title: strengthenProfileLanguage(introRaw.title, 16) || fallback.intro.title,
      line: strengthenProfileLanguage(introRaw.line || introRaw.text, 50) || fallback.intro.line
    },
    questions,
    outro: strengthenProfileLanguage(parsed.outro, 40) || fallback.outro
  };
}

/** 把用户的答题结果压成 prompt 里的最高权重证据块。 */
function quizEvidenceBlock(quizAnswers) {
  const rows = Array.isArray(quizAnswers) ? quizAnswers : [];
  const cleaned = rows.map((item) => {
    const probe = cleanText(item?.probe, 24);
    const prompt = cleanText(item?.prompt, 80);
    const answer = cleanText(item?.answerLabel ?? item?.answer ?? item?.value, 80);
    if (!prompt || !answer) return null;
    return `- 【${probe || '补充'}】问：${prompt} → 他选了：${answer}${item?.answerSub ? `（${cleanText(item.answerSub, 40)}）` : ''}`;
  }).filter(Boolean).slice(0, 6);
  if (!cleaned.length) return '';
  return [
    '★★★ 用户刚刚亲手答的题（权重最高，高于一切统计数据）★★★',
    cleaned.join('\n'),
    '这些答案是用户自己按下去的，必须在 essay、lifeReading、emotionSpectrum、soulCard 里被明确用到，至少两处要直接呼应答案内容。不要复述题干，要把答案变成判断。'
  ].join('\n');
}

async function personaQuizHandler(req, res) {
  try {
    const user = await requireUser(req);
    const body = req.body || {};
    const historyMode = safeHistoryMode(body.history?.mode || body.historyMode);
    const stats = await collectStats(user, historyMode, body.history?.selected || []);
    const key = process.env.DEEPSEEK_API_KEY;
    const model = resolveModel('DEEPSEEK_PERSONA_MODEL');
    if (!key) {
      return json(res, 200, { fallback: true, quiz: fallbackQuiz(user, stats) });
    }

    const config = await readPersonaConfig();
    const anchors = quizAnchors(user, stats);
    const prompt = [
      'Role：你是 Album Circle 的"灵魂仪式主持人"。你要为这个具体的用户现场设计 4 道全屏抽牌题。',
      '目的：AI 已经能从他的歌单猜到"听什么"，但猜不到"为什么"。这 4 道题要精准戳向数据里看不见的那部分：情绪触发点、社交姿态、审美底线、隐藏的私人暗号。',
      '',
      '硬性要求：',
      '1. 每道题都必须长在这个用户的真实数据上。题干里要出现他真实听过的歌名、艺人名、或者他写过的评论里的词。绝对不能是通用心理测试题。',
      '2. 题干 ≤ 30 字，要有画面感和场景（时间/地点/动作）。不要问"你觉得…吗"这种问卷腔。',
      '3. 四道题的 kind 必须覆盖：至少 1 道 "pair"（用他自己的两首歌做二选一对撞）、至少 1 道 "choice"（3-4 个选项）、至少 1 道 "dial"（滑块，两端是有张力的极性）、至少 1 道 "word"（让他写一个词）。',
      '4. 选项文案 ≤ 12 字，要像人会说的话，可以毒舌、可以怪、可以不体面。四个选项之间必须真的不同人格，不能是同一答案的四种委婉说法。',
      '5. probe 用 4-6 字说明这道题在测什么（例如"情绪入口""社交姿态""审美底线""私人暗号"）。',
      '6. hint 是题干下面的小字，≤ 20 字，用来降低压力或者加一点挑衅。',
      '7. 禁止任何心理诊断、命运、职业、感情硬判断的题目。这是好玩的抽牌，不是量表。',
      '',
      '输出严格 JSON，不要 markdown，不要解释：',
      '{"intro":{"title":"≤8字","line":"≤25字"},"questions":[{"id":"q1","kind":"pair|choice|dial|word","probe":"...","prompt":"...","hint":"...","options":[{"id":"a","label":"...","sub":"...","glyph":"单个符号"}],"leftLabel":"...","rightLabel":"...","defaultValue":50,"placeholder":"..."}],"outro":"≤20字"}',
      'kind=pair/choice 时给 options（pair 恰好 2 个，choice 给 3-4 个）；kind=dial 时给 leftLabel/rightLabel/defaultValue 且不给 options；kind=word 时给 placeholder 且不给 options。glyph 从 ☾ ✧ ⟡ ❍ ✦ ☍ ❈ ◈ 里选。',
      '',
      `用户资料：${profilePromptBlock(user)}`,
      `可用锚点（必须用到）：${JSON.stringify(anchors)}`,
      `压缩历史：${compactStatsForPrompt(stats)}`,
      config.personaPrompt ? `管理员补充要求：${cleanText(config.personaPrompt, 1200)}` : ''
    ].filter(Boolean).join('\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(30000, Math.min(120000, Number(process.env.PERSONA_QUIZ_TIMEOUT_MS || 75000))));
    try {
      const data = await callDeepSeekPersona({
        key,
        model,
        signal: controller.signal,
        temperature: 0.92,
        maxTokens: clampTokens(process.env.DEEPSEEK_PERSONA_QUIZ_MAX_TOKENS, 3000, 1200, 4200),
        thinking: 'high',
        messages: [
          { role: 'system', content: 'You design short, sharp, personalized ritual questions in Chinese. Return one valid JSON object only. No markdown.' },
          { role: 'user', content: prompt }
        ]
      });
      const quiz = sanitizeQuiz(parseJson(data.choices?.[0]?.message?.content || '{}'), user, stats);
      return json(res, 200, { fallback: false, quiz, usage: data.usage || null });
    } catch (error) {
      return json(res, 200, { fallback: true, quiz: fallbackQuiz(user, stats), error: cleanText(error.message, 200) });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return json(res, error.status || 502, { error: error.message || 'Persona quiz failed.' });
  }
}

async function personaChatHandler(req, res) {
  try {
    const user = await requireUser(req);
    const body = req.body || {};
    const question = cleanText(body.question, 700);
    if (!question) return json(res, 400, { error: 'Missing question.' });
    const incomingReport = body.report || user.latestPersona || {};
    const historyMode = safeHistoryMode(body.history?.mode || incomingReport.historyMode || 'mine');
    const selectedItems = body.history?.selected || incomingReport.selectedItems || [];
    const stats = await collectStats(user, historyMode, selectedItems);
    const report = normalizeStoredPersona(incomingReport, user, stats) || {};
    const research = await tavilyMultiSearch(personaQueries(user, stats).slice(0, 6));
    const key = process.env.DEEPSEEK_API_KEY;
    const model = resolveModel('DEEPSEEK_PERSONA_MODEL');
    if (!key) {
      return json(res, 200, {
        fallback: true,
        answer: fallbackPersonaChatAnswer(user, stats, question),
        research: { enabled: research.enabled, sources: [] }
      });
    }

    const config = await readPersonaConfig();
    const prompt = [
      config.personaPrompt ? `管理员补充要求：${cleanText(config.personaPrompt, 5000)}` : '',
      '你是 Album Circle 的音乐画像对话助手。像一个懂音乐、会开玩笑但不油腻的朋友一样回答，不要机械列字段。',
      '回答中文，350-750 字。必须直接回应用户问题，并优先使用他的主动填写资料、公开 tags、评论片段、添加过的歌曲/专辑，再用联网资料补充具体推荐。',
      '如果用户问画像、偏好或性格分析，要像朋友式占卜聊天：直接说你猜你看见了什么人格气质、生活习惯、审美弱点、相处方式和推荐方向。可以引用性别、出生年份、MBTI、专业、音乐选择和评论，但不要解释分析方法，不要说“证据/维度/坐标/精神图谱”。',
      '如果用户问推荐，必须给出具体艺人/乐队/专辑/歌曲名和理由，不要只讲方法论。',
      '可以提到“可能/倾向/我猜”，语气有趣一点、风格化一点；不要做心理诊断、命运断言、职业或情感硬判断。',
      `用户资料：${profilePromptBlock(user)}`,
      `最近画像：${JSON.stringify(report).slice(0, 14000)}`,
      `历史统计：${JSON.stringify(stats).slice(0, 28000)}`,
      '联网资料：',
      sourcesForPrompt(research),
      `用户问题：${question}`
    ].filter(Boolean).join('\n\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(60000, Math.min(120000, Number(process.env.PERSONA_CHAT_DEEPSEEK_TIMEOUT_MS || 90000))));
    try {
      const data = await callDeepSeekPersona({
        key,
        model,
        signal: controller.signal,
        temperature: Number.isFinite(config.personaTemperature) ? config.personaTemperature : 0.82,
        maxTokens: Math.max(2200, Math.min(8000, Number(config.personaChatMaxTokens || process.env.DEEPSEEK_PERSONA_CHAT_MAX_TOKENS || 5200))),
        messages: [
          { role: 'system', content: 'You answer as a warm music taste analyst. No clinical, fate, career, or relationship claims.' },
          { role: 'user', content: prompt }
        ]
      });
      const answer = strengthenProfileLanguage(data.choices?.[0]?.message?.content, 3600);
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
    const action = String(body.action || req.query.action || '');
    if (action === 'persona-chat') return personaChatHandler(req, res);
    if (action === 'persona-quiz') return personaQuizHandler(req, res);
    const tone = safeTone(body.tone);
    const quizBlock = quizEvidenceBlock(body.quizAnswers);
    const historyMode = safeHistoryMode(body.history?.mode || body.historyMode);
    const stats = await collectStats(user, historyMode, body.history?.selected || []);
    const research = await tavilyMultiSearch(personaQueries(user, stats));
    const key = process.env.DEEPSEEK_API_KEY;
    const model = resolveModel('DEEPSEEK_PERSONA_MODEL');
    let report = fallbackPersona(user, stats, tone);
    let fallback = true;
    let usage = null;
    let finishReason = '';
    let debugError = '';

    if (key) {
      const config = await readPersonaConfig();
      const commonContext = [
        config.personaPrompt ? `管理员补充要求：${cleanText(config.personaPrompt, 5000)}` : '',
        'Role：你是 Album Circle 的“音乐塔罗师 + 流行文化嘴替 + 资深歌单朋友”。用户要的是娱乐性质的人物侧写，不是研究报告。请根据资料、MBTI、专业、评论、喜欢的歌手/专辑/歌曲，直接给出好玩、标签化、有情绪、有画面感的判断。',
        '重要：不要解释“我是如何分析的”，不要说“同等级证据/精神图谱/坐标/解释维度/互相照亮/从哪里听/被什么击中”。用户只想看分析之后的结果。可以大胆推测日常相处方式、做事习惯、情感表达、审美洁癖、社交模式、深夜状态，但必须保持娱乐口吻，使用“可能/大概/我猜你”。',
        '拒绝 AI 味：不要写“这些资料不是附属资料”“不只是音乐和背景两层”“未来探索路线”“核心矛盾”“社交播放方式”“30 天/90 天预测”。不要过度事实核查，推荐可以风格化，只要不要编造具体历史事实。',
        '语言风格：像一个懂音乐、嘴有点损但很会共情的朋友。允许轻微毒舌、网络感、塔罗/八字/占卜式比喻、金句、彩蛋。不要羞辱用户，不要攻击身份、性别、年龄、专业或心理健康。',
        `语气：${tone}`,
        `用户主动填写资料：${profilePromptBlock(user)}`,
        `必须显式读取的背景线索：${JSON.stringify(identitySignalsFallback(user))}`,
        quizBlock,
        `历史模式：${historyMode}`,
        `房间与添加历史：${JSON.stringify(stats).slice(0, 52000)}`,
        '联网来源：',
        sourcesForPrompt(research)
      ].filter(Boolean).join('\n\n');
      const personaCorePrompt = [
        commonContext,
        '本轮只生成“人物画像与生活侧写”段落，不要生成推荐列表和 UI 标签。',
        '输出严格 JSON，字段只能是：archetype, profileName, headline, summary, personalitySketch, lifeReading, dailyVibes, oracleCards, musicAge, preferenceReading, the_roast, essay, tasteMap, tasteDNA, evidenceCards, identitySignals, humanSpiritMap, riskNotice。',
        'essay 写 1300-2200 中文字；lifeReading.text 写 650-1100 中文字。重点是直接分析用户性格、日常相处、做事细节、审美弱点、深夜状态和听歌人格，不要讲分析方法。',
        'preferenceReading/tasteMap/evidenceCards 必须引用真实歌手、专辑、歌曲或评论片段，例如添加历史里的作品。identitySignals 必须包含用户填写的性别、出生年份、MBTI、专业等已知字段。'
      ].join('\n\n');
      const personaNarrativePrompt = [
        commonContext,
        '请写一篇完整、连续、有文学气口的“音乐灵魂侧写主稿”，不要 JSON，不要列表，不要 markdown。',
        '长度 1400-2200 中文字。要像朋友在深夜认真但有点毒舌地给用户看牌：先给一个非常有戏的判断，然后展开性格、日常相处方式、做事习惯、情绪表达、审美洁癖、社交状态、深夜状态、听歌仪式感、推荐方向。',
        '必须自然引用用户填写资料、喜欢的歌手/专辑/歌曲、添加历史、评论片段。引用不是为了证明方法，而是让读者感觉“它真的在说我”。',
        '语言要生动、有细节、有比喻、有一点网络感和金句，但不要油腻。可以娱乐化推测，不要装严肃专家。不要写“我如何分析/证据/维度/精神图谱/未来路线/30天90天”。',
        '推荐方向也要写进文中：提到一些可能喜欢的新歌手、专辑、歌曲或路线，但不用在主稿里列完整清单。'
      ].join('\n\n');
      const personaLifePrompt = [
        commonContext,
        '请只从“人”的角度写一篇侧写主稿，不要 JSON，不要列表，不要 markdown。',
        '长度 1300-2100 中文字。重点推演用户的日常性格、朋友局状态、做事细节、恋爱/亲密中的可能偏好、深夜状态、社交疲惫点、审美洁癖和可爱毛病。',
        '音乐只是入口，但结论要落在人身上。可以更像塔罗/八字/MBTI 娱乐解读，标签化、好玩、有画面。不要过度严谨，不要解释分析方法，不要职业/情感硬判断。',
        '必须把 MBTI、出生年份、专业、性别、评论片段、喜欢的歌手/歌/专辑自然揉进去。'
      ].join('\n\n');
      const personaCulturePrompt = [
        commonContext,
        '请只从“音乐文化评论家 + 歌单策展人”的角度写一篇侧写主稿，不要 JSON，不要列表，不要 markdown。',
        '长度 1300-2100 中文字。重点分析用户为什么会被这些歌手、专辑、歌曲和评论方式吸引：人声、旋律、编曲、歌词视角、专辑感、年代感、华语/欧美桥接、审美边界。',
        '要写出具体新推荐方向，在正文里自然提到新的艺人、乐队、专辑、歌曲，不要只说“可以探索”。要有懂音乐的人味，而不是搜索摘要。',
        '可以大胆、有趣、有一点毒舌，但不要事实瞎编具体历史。'
      ].join('\n\n');
      const personaRecommendationPrompt = [
        commonContext,
        '本轮只生成“推荐与探索路线”。要像真正懂这个用户的歌单朋友，不要只推同类，也不要空泛说方法。',
        '输出严格 JSON，字段只能是：recommendations, playlistRoutes, conversationStarters, sourceNotes。',
        'recommendations 包含 artists 6-10 个、bands 4-8 个、albums 8-12 个、songs 8-12 首。artists/bands 的元素为 {name,reason,entry}；albums/songs 的元素为 {title,artist,reason,entry}。',
        '每个 reason 都必须说明为什么适合这个用户，要连接他的 MBTI/专业/出生年份/评论语气/喜欢的歌手专辑歌曲中的至少一个线索。entry 写入门听法或入门作品。',
        'playlistRoutes 给 3-5 条路线，例如“安全但不无聊”“深夜氛围”“稍微冒犯一下”“华语侧门”“制作人路线”。items 必须是具体作品名。conversationStarters 给 4-8 个可继续追问的问题。sourceNotes 可简短引用联网来源标题。'
      ].join('\n\n');
      const personaVisualPrompt = [
        commonContext,
        '本轮只生成“视觉主题、公开标签和彩蛋”。要服务前端动态主题和抽牌界面。',
        '输出严格 JSON，字段只能是：ui_theme_hint, tags, easterEggs。',
        'ui_theme_hint: {style, primary_color, bg_animation}。primary_color 必须是十六进制颜色；style 要像一个明确的视觉流派，例如 Adaptive Liquid Glass / Nocturne Vinyl Cabinet / Soft Cyber Tarot。',
        'tags 给 12-20 个可公开展示短标签，必须像真人愿意挂在主页上的音乐人格标签，不要机械。easterEggs 给 3-6 条小彩蛋，要轻松、有梗、有画面感。'
      ].join('\n\n');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.max(120000, Math.min(290000, Number(process.env.PERSONA_DEEPSEEK_TIMEOUT_MS || 285000))));
      try {
        const baseTemperature = Number.isFinite(config.personaTemperature) ? config.personaTemperature : 0.82;
        const maxConfig = Number(config.personaMaxTokens || process.env.DEEPSEEK_PERSONA_MAX_TOKENS || 16000);
        if (process.env.PERSONA_LEGACY_PIPELINE !== '1') {
          const compactContext = [
            config.personaPrompt ? `管理员补充要求：${cleanText(config.personaPrompt, 1800)}` : '',
            'Role：你是 Album Circle 的“音乐塔罗师 + 流行文化嘴替 + 资深歌单朋友”。用户要的是娱乐性质的人物侧写，不是研究报告。',
            '语言风格：像一个懂音乐、嘴有点损但很会共情的朋友。不要解释分析方法，不要写“同等级证据/精神图谱/坐标/解释维度/未来路线/30天/90天”。',
            `语气：${tone}`,
            `用户主动填写资料：${profilePromptBlock(user)}`,
            `必须显式读取的背景线索：${JSON.stringify(identitySignalsFallback(user))}`,
            quizBlock,
            `历史模式：${historyMode}`,
            `压缩后的房间与听歌历史：${compactStatsForPrompt(stats)}`,
            '联网来源摘要：',
            sourcesForPrompt({ ...research, sources: research.sources.slice(0, 4) })
          ].filter(Boolean).join('\n\n');
          const compactPrompt = [
            compactContext,
            '请一次性生成 Album Circle 的音乐人格画像最终稿。不要分步骤，不要解释方法，不要 markdown。',
            '必须自然包含用户填写的性别、出生年份、MBTI、专业；必须引用真实歌手、专辑、歌曲或评论片段，例如添加历史里的作品。',
            personaSchemaPrompt({ compact: true })
          ].join('\n\n');
          let compactSection = await callPersonaJsonSection({
            key,
            model,
            signal: controller.signal,
            config,
            name: 'persona-compact-json',
            prompt: compactPrompt,
            temperature: Math.min(0.86, baseTemperature + 0.04),
            maxTokens: clampTokens(maxConfig, 7200, 3200, 9000),
            retryMaxTokens: clampTokens(process.env.DEEPSEEK_PERSONA_RETRY_MAX_TOKENS, 4800, 2600, 6400),
            thinking: 'high',
            reasoningEffort: 'high'
          });
          // —— 锐度门禁：太像模板作文就逼它重写一次 ——
          const minSharpness = Math.max(0, Math.min(90, Number(process.env.PERSONA_MIN_SHARPNESS || 46)));
          let score = sharpnessScore(compactSection.value, user, stats);
          if (score < minSharpness) {
            const rewritePrompt = [
              compactPrompt,
              [
                `【重写指令】上一版锐度评分只有 ${score}/100，AI 味太重、锚点太少，不合格。`,
                '重写规则：',
                `- 命中的套话有 ${aiSmellHits(compactSection.value)} 处，全部删掉。`,
                '- 每个判断后面必须紧跟一个具体作品名或用户原话，做不到就换一个判断。',
                '- 把所有"温柔的""美好的""独特的"这类空形容词换成带对象的描述。',
                '- 结尾不要总结、不要祝福，用一个画面或一句刺人的判断收。',
                '- 字数可以更短，但每一句都要只对这一个人成立。'
              ].join('\n')
            ].join('\n\n');
            const rewritten = await callPersonaJsonSection({
              key,
              model,
              signal: controller.signal,
              config,
              name: 'persona-compact-json-sharpen',
              prompt: rewritePrompt,
              temperature: Math.min(0.94, baseTemperature + 0.12),
              maxTokens: clampTokens(maxConfig, 7200, 3200, 9000),
              retryMaxTokens: clampTokens(process.env.DEEPSEEK_PERSONA_RETRY_MAX_TOKENS, 4800, 2600, 6400),
              thinking: 'high',
              reasoningEffort: 'high'
            }).catch(() => null);
            const rewrittenScore = rewritten ? sharpnessScore(rewritten.value, user, stats) : -1;
            if (rewritten && rewrittenScore > score) {
              compactSection = { ...rewritten, usage: mergeUsage(compactSection.usage, rewritten.usage) };
              score = rewrittenScore;
            }
          }
          report = sanitizePersona(compactSection.value, user, stats, tone);
          report.sharpness = score;
          const banned = safetyCheck(report);
          if (banned.length) throw new Error(`Persona safety check failed: ${banned.join(', ')}`);
          usage = compactSection.usage;
          finishReason = `persona-compact-json:${compactSection.finishReason || 'unknown'};sharpness:${score}`;
          debugError = compactSection.recovered ? `persona-compact-json recovered from ${compactSection.error}` : '';
          fallback = false;
        } else {
        const [musicDraft, lifeDraft, cultureDraft, recommendationSection, visualSection] = await Promise.all([
          callPersonaNarrativeDraft({
            key,
            model,
            signal: controller.signal,
            config,
            name: 'music-oracle-writer',
            prompt: personaNarrativePrompt,
            temperature: Math.min(0.9, baseTemperature + 0.08),
            maxTokens: Math.max(7000, Math.min(11000, maxConfig)),
            systemStyle: 'Write like a stylish Chinese music oracle: literary, playful, detailed, emotionally sharp, and warm. No markdown table. No clinical, fate, career, or relationship claims.'
          }),
          callPersonaNarrativeDraft({
            key,
            model,
            signal: controller.signal,
            config,
            name: 'life-profile-writer',
            prompt: personaLifePrompt,
            temperature: Math.min(0.92, baseTemperature + 0.1),
            maxTokens: Math.max(6500, Math.min(10500, maxConfig)),
            systemStyle: 'Write like a witty Chinese persona columnist: human, vivid, gently teasing, full of everyday observations. No markdown table. No clinical, fate, career, or relationship claims.'
          }),
          callPersonaNarrativeDraft({
            key,
            model,
            signal: controller.signal,
            config,
            name: 'music-culture-writer',
            prompt: personaCulturePrompt,
            temperature: Math.min(0.88, baseTemperature + 0.06),
            maxTokens: Math.max(6500, Math.min(10500, maxConfig)),
            systemStyle: 'Write like a senior music critic and playlist curator in Chinese: concrete, tasteful, sharp, recommendation-rich, not academic. No markdown table.'
          }),
          callPersonaJsonSection({
            key,
            model,
            signal: controller.signal,
            config,
            name: 'persona-recommendations',
            prompt: personaRecommendationPrompt,
            temperature: Math.min(0.86, baseTemperature + 0.04),
            maxTokens: Math.max(6000, Math.min(10000, maxConfig)),
            retryMaxTokens: Math.max(4600, Math.min(7600, Number(process.env.DEEPSEEK_PERSONA_RETRY_MAX_TOKENS || 6800)))
          }),
          callPersonaJsonSection({
            key,
            model,
            signal: controller.signal,
            config,
            name: 'persona-visual',
            prompt: personaVisualPrompt,
            temperature: Math.min(0.9, baseTemperature + 0.06),
            maxTokens: Math.max(2400, Math.min(4200, maxConfig)),
            retryMaxTokens: Math.max(1800, Math.min(3200, Number(process.env.DEEPSEEK_PERSONA_RETRY_MAX_TOKENS || 2600)))
          })
        ]);
        const coreSection = await callPersonaEditorJson({
          key,
          model,
          signal: controller.signal,
          config,
          commonContext,
          drafts: [musicDraft, lifeDraft, cultureDraft],
          temperature: Math.min(0.86, baseTemperature + 0.04),
          maxTokens: Math.max(11000, Math.min(16000, maxConfig)),
          retryMaxTokens: Math.max(7800, Math.min(11000, Number(process.env.DEEPSEEK_PERSONA_RETRY_MAX_TOKENS || 10000))),
          schemaPrompt: personaCorePrompt
        });
        const mergedRaw = {
          ...coreSection.value,
          recommendations: recommendationSection.value?.recommendations,
          playlistRoutes: recommendationSection.value?.playlistRoutes,
          conversationStarters: recommendationSection.value?.conversationStarters,
          sourceNotes: recommendationSection.value?.sourceNotes,
          ui_theme_hint: visualSection.value?.ui_theme_hint,
          tags: visualSection.value?.tags,
          easterEggs: visualSection.value?.easterEggs
        };
        report = sanitizePersona(mergedRaw, user, stats, tone);
        const banned = safetyCheck(report);
        if (banned.length) throw new Error(`Persona safety check failed: ${banned.join(', ')}`);
        usage = {
          drafts: {
            music: musicDraft.usage,
            life: lifeDraft.usage,
            culture: cultureDraft.usage
          },
          core: coreSection.usage,
          recommendations: recommendationSection.usage,
          visual: visualSection.usage
        };
        finishReason = [
          { name: 'music-oracle-writer', finishReason: musicDraft.finishReason, recovered: musicDraft.recovered, error: musicDraft.error },
          { name: 'life-profile-writer', finishReason: lifeDraft.finishReason, recovered: lifeDraft.recovered, error: lifeDraft.error },
          { name: 'music-culture-writer', finishReason: cultureDraft.finishReason, recovered: cultureDraft.recovered, error: cultureDraft.error },
          coreSection,
          recommendationSection,
          visualSection
        ].map((section) => `${section.name}:${section.finishReason || 'unknown'}`).join('; ');
        debugError = [
          { name: 'music-oracle-writer', recovered: musicDraft.recovered, error: musicDraft.error },
          { name: 'life-profile-writer', recovered: lifeDraft.recovered, error: lifeDraft.error },
          { name: 'music-culture-writer', recovered: cultureDraft.recovered, error: cultureDraft.error },
          coreSection,
          recommendationSection,
          visualSection
        ]
          .filter((section) => section.recovered)
          .map((section) => `${section.name} recovered from ${section.error}`)
          .join(' | ');
        fallback = false;
        }
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
      ritualCompleted: Boolean(quizBlock),
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
