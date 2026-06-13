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
  const essay = [
    `这是一份临时生成的音乐画像。${name} 的听歌轨迹目前最清楚的线索来自 ${artists}，以及 ${albums} 这些被加入房间的作品。它们说明你的推荐并不只是在分享“好听”，而是在给朋友留下一个可以进入的场景：一首歌的标题、封面、所属专辑、评论和导览一起组成了你的音乐身份。你更像是把音乐当成记忆和关系的整理工具，先用熟悉的声音确认情绪，再慢慢向新的风格移动。`,
    `从“专辑式聆听”的角度看，你的偏好不像随机收藏，更像在给自己搭一间有灯光的唱片室。你会在意作品是不是有可回到的上下文：一首单曲要能指向所属专辑，一张专辑要能展开曲序、封面、发行时期和朋友评论。这样的听法通常会把音乐当成一种可复读的文本，而不是一次性背景声。你可能会先被旋律和人声抓住，再回头看编曲层次、歌词视角和发行语境；如果朋友也参与评论，你又会把他们的句子当成新的入口，重新理解同一首歌。`,
    `你的社交播放方式偏向“给入口”，不太像直接把歌单丢给别人。更适合你的推荐方式，是先选一首最能代表情绪的歌，再补一句为什么从这里进：主歌负责铺垫什么，副歌把情绪推到哪里，人声距离让叙述更像告白、回忆还是旁观。深夜播放时，你可能会更在意留白、重复、轻微的和声变化，以及一句旋律在脑内停留的时间；白天分享时，则更容易把它整理成给朋友看的路线。`,
    `你对“喜欢”的判断也会比较重视证据。比起只说某个风格适合自己，你更需要知道它为什么成立：是鼓点给了身体记忆，是副歌把一句话变得更直白，是和声让亲密感变厚，还是封面和发行时期把整张作品放进了某种时代状态。这样的听法很适合 Album Circle 这种房间结构，因为每一次添加、评论和 AI 导览都会留下线索；时间久了，你看到的不只是一排封面，而是一份可以追溯的聆听档案。`,
    `未来的探索路线可以从三个方向展开。第一是继续补完整张专辑，把已经喜欢的歌放回曲序里，观察它在开场、转折或收束处承担什么功能。第二是沿着相似质感去找新的艺人和乐队：如果你喜欢细腻人声，可以扩展到另类 R&B、梦幻流行和制作更克制的华语专辑；如果你喜欢强烈的专辑概念，可以继续找封面、曲序和文本互相呼应的作品。第三是让朋友的评论反过来修正你的偏好：别人听见的节奏、歌词和音色，可能会让你意识到自己真正迷恋的不是某个标签，而是一种叙述方式。这个画像仍需要更多资料和聆听历史来变得准确，所以它只能作为娱乐性的音乐导览，不是心理测评、命运判断、职业建议或人生诊断。`
  ].join('\n\n');
  return {
    essay,
    musicPersonality: {
      name: tone === 'mystic' ? '夜航唱片占星师' : '房间策展型听众',
      coreConflict: '一边想保留私人情绪，一边又希望朋友真的听懂这些歌为什么重要。',
      listeningMotive: '用歌曲替代解释，把难以直接说出的感受交给旋律和编曲。',
      socialPlaybackStyle: '会先挑一首入口明确的歌，再补充专辑背景和自己听到的细节。',
      lateNightPlaybackStyle: '深夜更在意人声距离、留白和一句歌词反复出现时带来的回声。'
    },
    listeningAge: '象征性音乐听龄：约 8 年，代表你已经形成稳定偏好，但仍在向外扩张。',
    recommendations: {
      artists: ['王菲', 'Frank Ocean', '李荣浩'],
      bands: ['Radiohead', 'The xx', '落日飞车'],
      albums: ['唱遊', 'Blonde', '耳朵']
    },
    oraclePredictions: {
      thirtyDays: '未来 30 天你可能更倾向补完已经喜欢艺人的完整专辑，而不是只听单曲。',
      ninetyDays: '未来 90 天你可能会把朋友评论当成线索，重新整理自己的私藏歌单。',
      oneYear: '未来一年你可能会在中文流行、另类 R&B 和细腻独立音乐之间建立更清晰的个人坐标。'
    },
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
  for (const room of rooms) {
    const query = mode === 'room'
      ? db().collection('albumCircleRooms').doc(room.id).collection('items').limit(50)
      : db().collection('albumCircleRooms').doc(room.id).collection('items').where('addedById', '==', user.id).limit(50);
    const itemsSnapshot = await query.get().catch(() => ({ docs: [] }));
    for (const doc of itemsSnapshot.docs) {
      const item = doc.data();
      allItems.push({ id: doc.id, roomId: room.id, roomName: room.name, ...item });
    }
  }

  const selectedKeys = new Set(cleanList(selected, 40, 180).map((item) => item.toLowerCase()));
  const items = mode === 'selected' && selectedKeys.size
    ? allItems.filter((item) => selectedKeys.has(item.id) || selectedKeys.has(`${item.title} ${item.artist}`.toLowerCase()))
    : allItems;

  return {
    rooms: rooms.map((room) => ({ id: room.id, name: room.name, visibility: room.visibility || 'unlisted' })).slice(0, 12),
    items: items.slice(0, 140).map((item) => ({
      id: item.id,
      roomId: item.roomId,
      type: item.type,
      title: item.title,
      artist: item.artist,
      albumTitle: item.albumTitle,
      year: item.year,
      tags: cleanList(item.tags, 8, 60),
      context: cleanText(item.aiProfile?.overview || item.background || item.context, 260)
    })),
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
  return {
    essay: essay.length >= 900 ? essay : fallback.essay,
    musicPersonality: {
      name: cleanText(parsed.musicPersonality?.name, 80) || fallback.musicPersonality.name,
      coreConflict: cleanText(parsed.musicPersonality?.coreConflict, 240) || fallback.musicPersonality.coreConflict,
      listeningMotive: cleanText(parsed.musicPersonality?.listeningMotive, 240) || fallback.musicPersonality.listeningMotive,
      socialPlaybackStyle: cleanText(parsed.musicPersonality?.socialPlaybackStyle, 240) || fallback.musicPersonality.socialPlaybackStyle,
      lateNightPlaybackStyle: cleanText(parsed.musicPersonality?.lateNightPlaybackStyle, 240) || fallback.musicPersonality.lateNightPlaybackStyle
    },
    listeningAge: cleanText(parsed.listeningAge, 180) || fallback.listeningAge,
    recommendations: {
      artists: cleanList(parsed.recommendations?.artists, 8, 80),
      bands: cleanList(parsed.recommendations?.bands, 8, 80),
      albums: cleanList(parsed.recommendations?.albums, 10, 120)
    },
    oraclePredictions: {
      thirtyDays: cleanText(parsed.oraclePredictions?.thirtyDays, 260) || fallback.oraclePredictions.thirtyDays,
      ninetyDays: cleanText(parsed.oraclePredictions?.ninetyDays, 260) || fallback.oraclePredictions.ninetyDays,
      oneYear: cleanText(parsed.oraclePredictions?.oneYear, 260) || fallback.oraclePredictions.oneYear
    },
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

export async function musicPersonaHandler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const body = req.body || {};
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
      const profile = user.profile || {};
      const prompt = [
        '你是 Album Circle 的音乐人格画像编辑。请基于用户主动填写资料、自己加入房间的音乐历史、以及联网来源，生成中文长文音乐画像。',
        '必须只输出严格 JSON。字段：essay, musicPersonality, listeningAge, recommendations, oraclePredictions, tags, sourceNotes, riskNotice。',
        'essay 必须 900-1500 中文字，是完整长文章：包含音乐偏好坐标、听歌动机、专辑/歌曲选择模式、社交播放方式、未来探索路线。必须引用用户资料或历史证据，不要泛泛而谈。',
        'musicPersonality 包含 name, coreConflict, listeningMotive, socialPlaybackStyle, lateNightPlaybackStyle。',
        'recommendations 包含 artists 5-8 个、bands 4-8 个、albums 6-10 个。oraclePredictions 包含 thirtyDays, ninetyDays, oneYear，必须使用“可能/倾向”。tags 给 12-20 个短标签。',
        '安全边界：这是娱乐性音乐画像，不是心理测评、命运判断、职业建议或人生诊断。禁止写“命中注定”“你一定”“人格缺陷”“心理问题”“职业适配”“情感关系断言”，不要基于性别、年龄、MBTI 做刻板结论。',
        'DeepSeek V4 可使用长上下文，请充分利用输入；但不要泄露用户邮箱、token、密码或私密身份字段。性别、出生年份、MBTI、专业只能作为用户自愿填写的弱线索，不做现实身份推断。',
        `语气：${tone}`,
        `用户昵称：${cleanText(user.name, 80)}`,
        `公开简介：${cleanText(profile.bio, 420)}`,
        `公开标签：${cleanList(user.publicTags, 24, 40).join('、')}`,
        `用户主动填写偏好：${JSON.stringify({
          location: profile.location || '',
          favoriteGenres: cleanList(profile.favoriteGenres, 16, 60),
          favoriteArtists: cleanList(profile.favoriteArtists, 18, 80),
          favoriteBands: cleanList(profile.favoriteBands, 18, 80),
          favoriteAlbums: cleanList(profile.favoriteAlbums, 18, 120),
          gender: profile.gender || '',
          birthYear: profile.birthYear || '',
          mbti: profile.mbti || '',
          major: profile.major || ''
        })}`,
        `历史模式：${historyMode}`,
        `房间与添加历史：${JSON.stringify(stats).slice(0, 52000)}`,
        '联网来源：',
        sourcesForPrompt(research)
      ].join('\n\n');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 36000);
      try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'Return one valid JSON object. Write grounded, safe Chinese music personality essays. Never make clinical, fate, career, or relationship claims.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.72,
            max_tokens: Number(process.env.DEEPSEEK_PERSONA_MAX_TOKENS || 3600)
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error?.message || `DeepSeek failed: ${response.status}`);
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
