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
    .replace(/同等级?证据|同级证据|同权证据|同权线索|同一层级|解释维度|证据维度|精神图谱|坐标|互相校准|互相照亮|人口统计|资料解释|从哪里听|你被什么击中|被什么击中/g, '偏好线索')
    .replace(/未来探索路线|未来的探索路线|核心矛盾|社交播放方式|深夜播放方式|30\s*天|90\s*天|1\s*年探索预测/g, '下一批听歌彩蛋')
    .replace(/画像会更立体/g, '这张牌会更有戏')
    .replace(/不只是音乐和背景两层/g, '不是普通资料拼盘')
    .replace(/我(?:会|把|需要|正在|已经)?(?:如何|怎么)?分析/g, '画像判断')
    .replace(/这份画像把/g, '你的听歌习惯像把')
    .replace(/不能只拆成[^。]*。?/g, '')
    .replace(/如果只看音乐[^。]*。?/g, '')
    .replace(/这些不是附属资料[^。]*。?/g, '')
    .replace(/不是心理测评[^。]*。?/g, '')
    .replace(/所有判断都必须[^。]*。?/g, '')
    .replace(/必须由[^。]*支撑/g, '更像一种娱乐性的猜测');
}

function hasDownrankLanguage(value) {
  return /弱线索|弱证据|辅助语境|辅助线索|调味料，不是主食材|真正权重仍然是你选了哪些歌|不会盖过真实音乐选择|背景线索只用来|同等级?证据|同级证据|同权证据|同权线索|精神图谱|解释维度|证据维度|人口统计|资料解释|从哪里听|你被什么击中|被什么击中|未来探索路线|未来的探索路线|未来路线|核心矛盾|社交播放方式|深夜播放方式|30\s*天|90\s*天|画像会更立体|不是音乐之外的附属品|不只是音乐和背景两层|human spirit map|%\s*可信度/.test(JSON.stringify(value || ''));
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
      text: `我猜你不是那种外放到处安利的人，更像先在心里把一首歌盘到发光，再挑一个刚好的时机递给朋友。日常里可能有点慢热，回消息看状态，做事需要氛围感；但真被戳中时会突然很认真，甚至开始研究歌词、封面、版本和现场。`,
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
    text: strengthenProfileLanguage(lifeReading.text || lifeReading.analysis, 900) || fallback.lifeReading.text,
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
    preferenceReading: cleanPreferenceReading.length >= 2 ? cleanPreferenceReading : fallback.preferenceReading,
    the_roast: cleanText(parsed.the_roast, 280) || fallback.the_roast,
    ui_theme_hint: {
      style: cleanText(uiHint.style, 80) || fallback.ui_theme_hint.style,
      primary_color: /^#[0-9a-f]{6}$/i.test(color) ? color : fallback.ui_theme_hint.primary_color,
      bg_animation: cleanText(uiHint.bg_animation, 120) || fallback.ui_theme_hint.bg_animation
    },
    essay: essay.length >= 320 ? strengthenProfileLanguage(essay, 5200) : fallback.essay,
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
    const incomingReport = body.report || user.latestPersona || {};
    const historyMode = safeHistoryMode(body.history?.mode || incomingReport.historyMode || 'mine');
    const selectedItems = body.history?.selected || incomingReport.selectedItems || [];
    const stats = await collectStats(user, historyMode, selectedItems);
    const report = normalizeStoredPersona(incomingReport, user, stats) || {};
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
        'Role：你是 Album Circle 的“音乐塔罗师 + 流行文化嘴替 + 资深歌单朋友”。用户要的是娱乐性质的人物侧写，不是研究报告。请根据资料、MBTI、专业、评论、喜欢的歌手/专辑/歌曲，直接给出好玩、标签化、有情绪、有画面感的判断。',
        '重要：不要解释“我是如何分析的”，不要说“同等级证据/精神图谱/坐标/解释维度/互相照亮/从哪里听/被什么击中”。用户只想看分析之后的结果。可以大胆推测日常相处方式、做事习惯、情感表达、审美洁癖、社交模式、深夜状态，但必须保持娱乐口吻，使用“可能/大概/我猜你”。',
        '拒绝 AI 味：不要写“这些资料不是附属资料”“不只是音乐和背景两层”“未来探索路线”“核心矛盾”“社交播放方式”“30 天/90 天预测”。不要过度事实核查，推荐可以风格化，只要不要编造具体历史事实。',
        '语言风格：像一个懂音乐、嘴有点损但很会共情的朋友。允许轻微毒舌、网络感、塔罗/八字/占卜式比喻、金句、彩蛋。不要羞辱用户，不要攻击身份、性别、年龄、专业或心理健康。',
        '只输出严格 JSON。字段：archetype, profileName, headline, summary, personalitySketch, lifeReading, dailyVibes, oracleCards, musicAge, preferenceReading, the_roast, ui_theme_hint, essay, tasteMap, tasteDNA, evidenceCards, recommendations, playlistRoutes, conversationStarters, tags, easterEggs, identitySignals, humanSpiritMap, sourceNotes, riskNotice。',
        'archetype: {title, summary}。title 不超过 15 个中文字符，要有戏剧张力和反差感。',
        'personalitySketch: {text, softGuess}。text 直接说“你像什么人”：生活习惯、相处方式、审美弱点、听歌仪式感；softGuess 写一句短短的“我猜你”。不要写分析方法。',
        'lifeReading: {title,vibe,text,socialStyle,workStyle,loveStyle}。这是核心模块。用 450-900 中文字直接侧写用户：日常状态、社交方式、做事细节、喜欢什么氛围、和朋友相处会怎样、浪漫/亲密关系里可能吃哪套。可以娱乐化、塔罗化、标签化。',
        'dailyVibes 给 3-6 个 {title,text}，例如“回消息人格”“朋友局模式”“深夜状态”“做事习惯”。oracleCards 给 3-5 张 {card,title,text}，像塔罗牌但不要神神叨叨到看不懂。musicAge: {realAgeHint,listeningAge,reason}，听歌年龄必须是象征性的有趣说法。',
        'preferenceReading 给 4-6 个对象，每个 {signal,evidence,reading}。signal 用好玩的标题，例如“审美洁癖”“浪漫脑内剧场”“专辑封面雷达”。evidence 用真实歌手/专辑/评论片段。reading 直接输出结论，不要讲方法论。',
        'ui_theme_hint: {style, primary_color, bg_animation}。primary_color 必须是十六进制颜色。它会真实驱动前端视觉主题，所以要根据人格底色选择。',
        'essay 写 900-1500 中文字。像一篇好玩的占卜长文：先下结论，再讲性格、生活、相处、审美、听歌弱点和推荐方向。不要出现“资料解释”“证据维度”“画像会更立体”这类 AI 套话。',
        'tasteMap 给 4-6 个对象，每个 {title,text}，标题要像标签：例如“最容易上头的点”“审美雷区”“朋友眼中的你”“深夜歌单人格”。',
        'tasteDNA 给 4-6 个对象，每个 {axis,value,label,evidence}，value 是 0-100，label 要像一句锐评。evidenceCards 给 3-5 个 {claim,basedOn,confidence}，claim 要像占卜结果，不要写可信度解释。',
        'recommendations 包含 artists 5-8 个、bands 3-8 个、albums 6-10 个、songs 6-10 首。artists/bands 的元素为 {name,reason,entry}；albums/songs 的元素为 {title,artist,reason,entry}。reason 必须说明为什么推荐给这个用户，entry 是入门曲/入门专辑/听法。',
        '推荐必须参考个人资料和喜好，例如 INFP、浪漫、安静、氛围、人声、华语流行、R&B、专辑感等。不要只推同类，要有“安全入口/稍微冒险/隐藏宝藏”。',
        'playlistRoutes 给 2-4 条路线，每条 {title,description,items}，例如“安全但不无聊”“深夜氛围”“稍微冒犯一下”。items 是具体作品。conversationStarters 给 3-6 个继续追问。tags 给 12-20 个可公开展示短标签。easterEggs 给 2-5 条小彩蛋。',
        'identitySignals 和 humanSpiritMap 只是兼容旧前端：可以填，但语气必须轻松，禁止出现“同级证据/精神图谱/坐标/解释维度/互相照亮/人口统计”。',
        '安全边界：这是娱乐性音乐画像。可以推测性格和生活习惯，但不要临床心理诊断、命运断言、职业硬建议、情感关系硬判断。',
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
