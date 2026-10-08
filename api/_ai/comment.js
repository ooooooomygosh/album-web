import { FieldValue } from 'firebase-admin/firestore';
import { json, requireUser, roomRef } from '../_firebase.js';
import { deepseekChat, resolveModel } from './_model.js';

function fallbackReply(item, comment) {
  const title = item?.title || comment?.albumTitle || '这首作品';
  return `我听到你提到的重点了：可以继续从《${title}》的旋律记忆点、歌词视角和编曲留白聊下去。你最想让朋友先注意哪一个瞬间？`;
}

function cleanPrompt(value, max = 700) {
  return String(value || '').trim().slice(0, max);
}

function cleanOutput(value, max = 1200) {
  const text = String(value || '').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length <= max) return text;
  const sliced = text.slice(0, max);
  const boundary = Math.max(sliced.lastIndexOf('。'), sliced.lastIndexOf('？'), sliced.lastIndexOf('！'), sliced.lastIndexOf('\n'));
  return boundary > max * 0.68 ? sliced.slice(0, boundary + 1).trim() : sliced.trim();
}

async function callDeepSeek({ key, model, messages, maxTokens, signal }) {
  const response = await deepseekChat({
    key,
    model,
    messages,
    temperature: 0.62,
    maxTokens,
    thinking: 'high',
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `DeepSeek failed: ${response.status}`);
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const roomId = req.query.roomId || req.body?.roomId;
    const ref = roomRef(roomId);
    const roomDoc = await ref.get();
    if (!roomDoc.exists) return json(res, 404, { error: 'Room not found.' });
    if (!roomDoc.data().members?.[user.id]) return json(res, 403, { error: 'Join the room before asking AI to reply.' });

    const item = req.body?.item || {};
    const comment = req.body?.comment || {};
    const key = process.env.DEEPSEEK_API_KEY;
    const model = resolveModel();
    const maxTokens = Math.max(800, Math.min(1800, Number(process.env.DEEPSEEK_COMMENT_MAX_TOKENS || 1100)));
    let text = fallbackReply(item, comment);
    let fallback = false;
    let finishReason = '';
    let usage = null;

    if (key) {
      const prompt = [
        '你是一个克制、友善、有音乐品味的房间陪伴评论助手。',
        '用户刚对一首歌或专辑发表评论。请生成一条可以直接显示在评论区的中文回复。',
        '要求：不要装作你听过不存在的具体幕后资料；回复 350-650 字；先回应用户评论，再结合音乐导览补充一个具体听法，最后给一个温和追问。',
        '回复必须自然完整，不要半句结束，不要使用编号列表。',
        `条目：${cleanPrompt(item.title, 120)} - ${cleanPrompt(item.artist, 120)}`,
        `专辑：${cleanPrompt(item.albumTitle, 120)}`,
        `AI 导览：${cleanPrompt([item.aiProfile?.overview, item.aiProfile?.melodyMotif, item.aiProfile?.lyricPerspective, item.background, item.context].filter(Boolean).join('\n'), 1200)}`,
        `用户评论：${cleanPrompt(comment.text, 900)}`
      ].join('\n');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 22000);
      try {
        const messages = [
          { role: 'system', content: 'You write warm, concrete Chinese music discussion replies. Always finish the final sentence.' },
          { role: 'user', content: prompt }
        ];
        let data = await callDeepSeek({ key, model, messages, maxTokens, signal: controller.signal });
        finishReason = data.choices?.[0]?.finish_reason || '';
        usage = data.usage || null;
        if (finishReason === 'length') {
          data = await callDeepSeek({
            key,
            model,
            messages: [...messages, { role: 'user', content: '上一条可能被截断。请重新输出完整回复，控制在 450-650 字，最后一句必须完整。' }],
            maxTokens: Math.min(2200, maxTokens + 700),
            signal: controller.signal
          });
          finishReason = data.choices?.[0]?.finish_reason || finishReason;
          usage = data.usage || usage;
        }
        text = cleanOutput(data.choices?.[0]?.message?.content, 1200) || text;
      } catch (error) {
        fallback = true;
      } finally {
        clearTimeout(timeout);
      }
    } else {
      fallback = true;
    }

    const aiComment = {
      userId: 'album-circle-ai',
      author: 'Album Circle AI',
      avatar: 'AI',
      mood: '引导',
      text,
      albumId: String(comment.albumId || item.id || 'unknown').slice(0, 80),
      albumTitle: String(comment.albumTitle || item.title || '').slice(0, 160),
      isAi: true,
      replyTo: String(comment.id || '').slice(0, 80),
      createdAt: FieldValue.serverTimestamp()
    };
    const doc = await ref.collection('comments').add(aiComment);
    await ref.update({
      updatedAt: FieldValue.serverTimestamp(),
      lastComment: text,
      commentCount: FieldValue.increment(1)
    });

    return json(res, 201, {
      fallback,
      finishReason,
      usage,
      comment: {
        id: doc.id,
        ...aiComment,
        createdAt: Date.now()
      }
    });
  } catch (error) {
    return json(res, error.status || 502, { error: error.message || 'AI comment failed.' });
  }
}
