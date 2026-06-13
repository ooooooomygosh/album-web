import { json, requireUser } from '../_firebase.js';
import { formatResearchForPrompt, publicResearchSources, searchMusicResearch } from './_research.js';
import { musicPersonaHandler } from '../../lib/music-persona.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (String(req.query.action || req.body?.action || '') === 'persona') {
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
    return json(res, 200, {
      text: message?.content || 'AI 返回为空。请稍后重试。',
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
