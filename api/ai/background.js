import { db, json, requireUser } from '../_firebase.js';
import { formatResearchForPrompt, publicResearchSources, searchMusicResearch } from './_research.js';

function cleanText(value, max = 1200) {
  return String(value || '').trim().slice(0, max);
}

function cleanList(value, fallback = [], limit = 8, max = 120) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[，,、\n]/);
  const cleaned = list.map((item) => cleanText(item, max)).filter(Boolean).slice(0, limit);
  return cleaned.length
    ? cleaned
    : fallback;
}

function fallbackBackground(item) {
  const album = item.albumTitle && item.albumTitle !== item.title ? `，收录在《${item.albumTitle}》` : '';
  return `《${item.title}》由 ${item.artist} 演唱${album}。可以从旋律动机、歌词视角、编曲层次和发行时期的创作状态进入讨论。`;
}

function fallbackProfile(item) {
  const title = cleanText(item.title || '这首作品', 80);
  const artist = cleanText(item.artist || '相关艺人', 80);
  const album = cleanText(item.albumTitle || item.title || '相关专辑', 80);
  const tracks = cleanList(item.tracks, [title]).slice(0, 6);
  const typeName = item.type === 'album' ? '专辑' : '歌曲';
  const year = cleanText(item.year || '未知年份', 20);
  const label = cleanText(item.label || item.tags?.[1] || '流行音乐', 60);
  const platforms = (item.platforms || ['Apple Music / iTunes']).join('、');
  const trackLine = tracks.slice(0, 4).join('、');
  const albumSentence = item.type === 'album'
    ? `这是一张需要按顺序进入的专辑，前几首会决定听众如何理解整张作品的声场、叙述速度和情绪密度。`
    : `它收录在《${album}》，适合先当作进入这张专辑的一扇门，而不是孤立地只听副歌。`;
  return {
    overview: `《${title}》由 ${artist} 带入房间，当前元数据把它放在《${album}》和 ${year} 这个坐标里。推荐它的理由不是一句“好听”，而是它能给朋友一个清晰入口：标题先把情感关系摆出来，人声与旋律负责把距离拉近，编曲的密度和留白决定这首作品是适合独处细听，还是适合在房间里慢慢展开讨论。${albumSentence} 这份导览不编造幕后资料，而是把平台、封面、曲目和声音线索整理成一条可听路线。`,
    genre: cleanList(item.tags, [cleanText(item.label || '流行', 40), '房间推荐'], 5).slice(0, 5),
    albumContext: `把《${title}》放回《${album}》里听，会比只看单曲标题更容易理解它的功能。它在展柜里的价值，是把朋友从一个熟悉的名字带进整张作品的关系网：先听它和 ${trackLine || title} 的顺序关系，再看情绪是被推高、放缓，还是被收束。推荐给朋友时，这张卡片要说明它不是孤零零的一首，而是《${album}》里值得点开的节点。`,
    creativeBackground: `${artist} 的《${title}》当前可确认的信息包括标题、艺人、${year}、平台来源 ${platforms}，以及 ${label} 这类风格线索。制作人、录音地点和具体创作动机没有资料支撑时应保持待考证。真正有用的导览，是把“事实”和“听感”分开：事实告诉读者这是哪个版本，听感则从封面气质、标题姿态、人声距离和同专辑曲目的关系出发，说明它为什么值得被朋友加入展柜。`,
    melodyMotif: `《${title}》的旋律导览要从“记忆点”进入：先抓主歌里反复靠近的短句，再听副歌用音高、节奏拉伸或重音变化把情绪打开。值得推荐的瞬间，通常不是整首歌最响的地方，而是某一句让你想回放、某次重复让标题变得更明确的地方。把这点写出来，朋友就知道该带着耳朵去找 ${artist} 的情绪标记。`,
    lyricPerspective: `歌词视角从标题《${title}》就已经开始：它把听众放进一种明确的关系姿态里，像直接告白，也像回头整理一段难以说完的情绪。歌词资料暂时不足时，人声距离就是进入文本的线索：靠近的声音会把它推向自白，克制的声音会让它更像回忆。推荐给朋友时，先说明“它把你放在谁的位置上听”，对方会更快进入情绪，而不是只记得旋律好听。`,
    arrangement: `《${title}》的编曲应当分层听：第一层抓鼓点、节奏和主旋律如何把身体带进去；第二层听贝斯、键盘、吉他或和声怎样在副歌前后改变空间；第三层专门听留白、混响和人声距离。真正值得写进推荐理由的，不是“编曲丰富”，而是哪一层声音让情绪变近、哪一次停顿让歌词更重、哪一个细节让它适合在朋友面前播放。`,
    releaseState: `当前元数据显示《${title}》的年份为 ${year}，来源为 ${platforms}，封面和基础目录信息已经可追踪；这让它具备进入展柜的最低可信度。制作名单、录音地点、幕后故事没有被元数据确认时，应标记为待补充。读者进入页面时先获得可靠坐标，再通过朋友评论、后续乐评和资料补全语境；这样的推荐既有情绪，也不会把未经验证的传闻写成事实。`,
    listeningGuide: tracks.map((track, index) => `${index + 1}. ${track}：先听它在《${album}》顺序中的功能，再记录旋律、歌词或音色里最能代表这一段的一个细节。`),
    discussionPrompts: ['你最先记住的是旋律、歌词还是音色？', '这首歌适合在什么场景被推荐给朋友？', '如果继续听同专辑，下一首应该接哪一首？']
  };
}

function richText(value, fallback, max = 1100, min = 170) {
  const text = cleanText(value, max);
  return text.length >= min ? text : fallback;
}

function numericConfig(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function concreteScore(text, item) {
  const value = String(text || '');
  const needles = [
    item.title,
    item.artist,
    item.albumTitle,
    item.year,
    '主歌',
    '副歌',
    '旋律',
    '歌词',
    '人声',
    '编曲',
    '节奏',
    '和声',
    '留白',
    '封面',
    '发行',
    '推荐'
  ].filter(Boolean);
  return needles.reduce((score, needle) => score + (value.includes(String(needle).slice(0, 12)) ? 1 : 0), 0);
}

function sanitizeGuideText(value) {
  return String(value || '')
    .replace(/据公开资料显示[，,]?/g, '当前元数据只能确认')
    .replace(/据资料显示[，,]?/g, '当前元数据只能确认')
    .replace(/据采访[，,]?/g, '待考证资料中')
    .replace(/李荣浩一贯包办词曲编曲制作/g, '关于具体制作分工仍需资料确认')
    .replace(/Frank Ocean.*?录制/g, '关于具体录制背景仍需资料确认');
}

function isRichProfile(profile, item) {
  const fields = ['albumContext', 'creativeBackground', 'melodyMotif', 'lyricPerspective', 'arrangement', 'releaseState'];
  return fields.every((field) => profile[field]?.length >= 170 && concreteScore(profile[field], item) >= 1) && profile.overview?.length >= 210;
}

function parseProfile(raw, item) {
  try {
    const text = String(raw || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    const jsonText = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonText);
    const fallback = fallbackProfile(item);
    const profile = {
      overview: sanitizeGuideText(richText(parsed.overview, fallback.overview, 900, 160)),
      genre: cleanList(parsed.genre, fallback.genre, 6, 80).slice(0, 6),
      albumContext: sanitizeGuideText(richText(parsed.albumContext, fallback.albumContext)),
      creativeBackground: sanitizeGuideText(richText(parsed.creativeBackground, fallback.creativeBackground)),
      melodyMotif: sanitizeGuideText(richText(parsed.melodyMotif, fallback.melodyMotif)),
      lyricPerspective: sanitizeGuideText(richText(parsed.lyricPerspective, fallback.lyricPerspective)),
      arrangement: sanitizeGuideText(richText(parsed.arrangement, fallback.arrangement)),
      releaseState: sanitizeGuideText(richText(parsed.releaseState, fallback.releaseState)),
      listeningGuide: cleanList(parsed.listeningGuide, fallback.listeningGuide, 10, 240).map(sanitizeGuideText).slice(0, 10),
      discussionPrompts: cleanList(parsed.discussionPrompts, fallback.discussionPrompts, 5, 120).slice(0, 5)
    };
    return isRichProfile(profile, item)
      ? profile
      : { ...fallback, genre: profile.genre, listeningGuide: profile.listeningGuide, discussionPrompts: profile.discussionPrompts, qualityFallback: true };
  } catch {
    return { ...fallbackProfile(item), parseFallback: true };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    await requireUser(req);
    const item = req.body?.item || {};
    const key = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_BACKGROUND_MODEL || process.env.DEEPSEEK_PERSONA_MODEL || 'deepseek-v4-pro';

    if (!key) {
      const profile = fallbackProfile(item);
      return json(res, 200, {
        fallback: true,
        generated: false,
        background: profile.overview,
        aiProfile: profile,
        tags: profile.genre,
        model
      });
    }

    const configDoc = await db().collection('albumCircleConfig').doc('ai').get().catch(() => null);
    const aiConfig = configDoc?.exists ? configDoc.data() : {};
    const research = await searchMusicResearch(item, {
      intent: 'background',
      maxResults: numericConfig(process.env.BACKGROUND_TAVILY_MAX_RESULTS, 7, 4, 10),
      searchDepth: process.env.BACKGROUND_TAVILY_SEARCH_DEPTH || 'advanced',
      timeoutMs: numericConfig(process.env.BACKGROUND_TAVILY_TIMEOUT_MS, 14000, 7000, 24000)
    });
    const researchContext = formatResearchForPrompt(research);

    const prompt = [
      '你是 Album Circle 的资深音乐编辑。请为这条音乐写成“可直接展示”的中文推荐导览，不要像字段说明。',
      '只输出严格 JSON。字段：overview, genre, albumContext, creativeBackground, melodyMotif, lyricPerspective, arrangement, releaseState, listeningGuide, discussionPrompts。',
      '写作方法：先在心里把它当成一篇完整乐评推荐，再拆成这些卡片。每张卡都要有判断、有导览、有推荐理由。',
      '每个长字段必须是完整段落，写 3-5 句：overview 220-360 字；albumContext/creativeBackground/melodyMotif/lyricPerspective/arrangement/releaseState 各 180-320 字。',
      '每段第一句直接说明“为什么值得听/它在作品中的功能”，后面说明“先听哪里/听完能理解什么”。必须点名标题、艺人或专辑，并包含具体线索：主歌、副歌、人声、节奏、和声、留白、发行、封面、平台来源、曲序位置或朋友评论入口。',
      '禁止使用连续问句或模板句式，例如“是否...”“可以从...理解”“建议不要急着...”。要用肯定判断写作，像一个认真推荐音乐的朋友。',
      '不要编造制作人、录音地点、幕后故事、公开资料、歌词原句、具体秒数或封面画面；除非这些信息在下面元数据或联网来源里明确出现。不确定就写“待考证”或“当前资料只能确认”。',
      '如果使用联网来源中的事实，请自然写入正文并用 [S1]、[S2] 这样的短引用标记；不要堆链接，不要在没有来源支持时写确定事实。',
      '如果是歌曲：解释它和所属专辑的关系、情绪入口、旋律记忆点、歌词视角、编曲如何推进。若是专辑：解释曲目路线、入口曲、情绪变化、适合推荐给谁。',
      'listeningGuide 给 5-7 条，每条 55-95 字；discussionPrompts 给 4 个问题；genre 给 4-8 个短标签。',
      `类型：${String(item.type || '').slice(0, 30)}`,
      `标题：${String(item.title || '').slice(0, 120)}`,
      `艺人：${String(item.artist || '').slice(0, 120)}`,
      `专辑：${String(item.albumTitle || '').slice(0, 120)}`,
      `年份：${String(item.year || '').slice(0, 20)}`,
      `平台与风格线索：${[...(item.platforms || []), ...(item.tags || []), item.label].filter(Boolean).slice(0, 12).join(', ')}`,
      `曲目：${(item.tracks || []).slice(0, 20).join(' / ')}`,
      `封面 URL：${String(item.cover || '').slice(0, 220)}`,
      `试听时长毫秒：${String(item.trackTimeMillis || '')}`,
      `试听链接是否存在：${item.previewUrl ? '是' : '否'}`,
      '联网检索资料：',
      researchContext
    ].filter(Boolean).join('\n');
    const finalPrompt = aiConfig.customPrompt ? `${aiConfig.customPrompt}\n\n当前条目元数据如下，请仍然输出同一 JSON 字段：\n${prompt}` : prompt;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), numericConfig(process.env.BACKGROUND_DEEPSEEK_TIMEOUT_MS, 48000, 30000, 55000));
    let response;
    try {
      response = await fetch('https://api.deepseek.com/chat/completions', {
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
            { role: 'system', content: 'You write concrete Chinese music recommendation essays grounded in metadata. Return only valid JSON object. Never invent unverified facts.' },
            { role: 'user', content: finalPrompt }
          ],
          temperature: Number.isFinite(aiConfig.temperature) ? aiConfig.temperature : 0.5,
          max_tokens: numericConfig(process.env.BACKGROUND_DEEPSEEK_MAX_TOKENS || aiConfig.backgroundMaxTokens || aiConfig.maxTokens, 5200, 3200, 7600)
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `DeepSeek failed: ${response.status}`);
    const finishReason = data.choices?.[0]?.finish_reason || '';
    if (finishReason === 'length') {
      throw new Error('DeepSeek background response was cut off before completion');
    }
    const text = data.choices?.[0]?.message?.content || '';
    const profile = parseProfile(text, item);

    return json(res, 200, {
      background: profile.overview,
      aiProfile: profile,
      tags: profile.genre,
      research: {
        query: research.query,
        enabled: research.enabled,
        error: research.error || '',
        sources: publicResearchSources(research)
      },
      generated: !profile.parseFallback && !profile.qualityFallback,
      model,
      usage: data.usage
    });
  } catch (error) {
    const message = error.name === 'AbortError' ? 'DeepSeek background request timed out' : error.message;
    const profile = fallbackProfile(req.body?.item || {});
    return json(res, 200, {
      fallback: true,
      generated: false,
      error: message,
      background: profile.overview,
      aiProfile: profile,
      tags: profile.genre,
      model: process.env.DEEPSEEK_BACKGROUND_MODEL || process.env.DEEPSEEK_PERSONA_MODEL || 'deepseek-v4-pro',
      research: {
        enabled: false,
        sources: [],
        error: message
      }
    });
  }
}
