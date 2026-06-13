import { json, requireUser } from '../_firebase.js';
import { formatResearchForPrompt, publicResearchSources, searchMusicResearch } from './_research.js';
import { musicPersonaHandler } from '../../lib/music-persona.js';

function fallbackRecommendation(album = {}, comments = []) {
  const title = String(album.title || album.albumTitle || '这条音乐').slice(0, 80);
  const artist = String(album.artist || '这位艺人').slice(0, 80);
  const tags = Array.isArray(album.tags) ? album.tags.filter(Boolean).slice(0, 3).join('、') : '';
  const commentHint = comments.length
    ? `朋友评论里已经出现了“${String(comments[0] || '').slice(0, 42)}”这样的入口，可以继续沿着真实听感聊下去。`
    : '评论还不多，可以先从旋律、人声距离和适合推荐给谁这三个角度聊起。';
  const tagHint = tags ? `它目前的标签偏向 ${tags}，下一批推荐可以从相近质感但不同语境的作品展开。` : '下一批推荐可以从同艺人、同专辑曲序和相近情绪的作品展开。';
  return `《${title}》可以先作为 ${artist} 的一个听感入口：先抓住你被哪段旋律、歌词或音色打中，再把它放回专辑和朋友评论里理解。${commentHint}${tagHint}你更想继续找相似歌曲，还是想先把这首歌所在专辑补完整？`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (['persona', 'persona-chat'].includes(String(req.query.action || req.body?.action || ''))) {
    return musicPersonaHandler(req, res);
  }

  try {
    await requireUser(req);
    const body = req.body || {};
    const album = body.album || {};
    const tracks = (album.tracks || []).slice(0, 12).map((track) => String(track).slice(0, 80));
    const comments = (body.comments || [])
      .slice(0, 16)
      .map((item) => String(item.text || '').trim().slice(0, 280))
      .filter(Boolean);
    const key = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

    if (!key) {
      return json(res, 200, {
        fallback: true,
        text:
          '可以从制作纹理、朋友共同高亮曲目、评论里反复出现的情绪词三个方向生成下一批推荐。'
      });
    }

    const research = await searchMusicResearch(album, { intent: 'recommend', maxResults: 4 });
    const prompt = [
      '你是一个克制、有音乐品味的专辑推荐助手。请基于用户和朋友的评论生成简短建议。',
      '只输出给用户看的最终建议，不要展示分析过程，不要使用“我们需要/先提炼/下一步”等过程措辞。',
      '输出中文，最多 180 字，包含：喜欢原因、下一批推荐方向、一个追问。',
      '具体事实只能来自条目元数据、用户评论或联网检索来源。若来源不足，不要编造制作背景、获奖、采访或录音细节。',
      `专辑：${String(album.title || '未知专辑').slice(0, 120)} - ${String(album.artist || '未知艺人').slice(0, 120)}`,
      `曲目：${tracks.join(', ')}`,
      `评论：${comments.join(' / ')}`,
      '联网检索资料：',
      formatResearchForPrompt(research)
    ].join('\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a precise music discovery assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 260
      })
    });
    clearTimeout(timeout);

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `DeepSeek failed: ${response.status}`);

    const message = data.choices?.[0]?.message;
    const text = String(message?.content || '').trim();
    return json(res, 200, {
      fallback: text.length < 12,
      text: text.length >= 12 ? text : fallbackRecommendation(album, comments),
      research: {
        query: research.query,
        enabled: research.enabled,
        error: research.error || '',
        sources: publicResearchSources(research)
      },
      usage: data.usage
    });
  } catch (error) {
    const message = error.name === 'AbortError' ? 'DeepSeek request timed out' : error.message;
    return json(res, 502, { error: message });
  }
}
