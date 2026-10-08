import crypto from 'node:crypto';
import { db, json, requireUser } from './_firebase.js';
import { cleanSharedRoom } from '../lib/shared-room.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const shares = db().collection('albumCircleShares');
    if (req.method === 'GET') {
      const id = String(req.query.id || '');
      if (!/^[a-f\d]{32}$/.test(id)) return json(res, 404, { error: '分享链接不存在。' });
      const doc = await shares.doc(id).get();
      if (!doc.exists) return json(res, 404, { error: '分享已撤回或不存在。' });
      return json(res, 200, { snapshot: doc.data().snapshot });
    }
    const user = await requireUser(req);
    if (req.method === 'POST') {
      if (Buffer.byteLength(JSON.stringify(req.body || {})) > 900000) return json(res, 413, { error: '展柜内容过大，请减少条目后重试。' });
      const snapshot = cleanSharedRoom(req.body?.snapshot);
      if (Buffer.byteLength(JSON.stringify(snapshot)) > 900000) return json(res, 413, { error: '展柜内容过大，请减少条目后重试。' });
      const id = crypto.randomBytes(16).toString('hex');
      await shares.doc(id).set({ ownerId: user.id, snapshot, createdAt: Date.now() });
      return json(res, 201, { id, url: `https://album-circle.vercel.app/?share=${id}` });
    }
    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      if (!/^[a-f\d]{32}$/.test(id)) return json(res, 404, { error: '分享链接不存在。' });
      const ref = shares.doc(id), doc = await ref.get();
      if (!doc.exists || doc.data().ownerId !== user.id) return json(res, 403, { error: '只能撤回自己发布的展柜。' });
      await ref.delete(); return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) { return json(res, error.status || 502, { error: error.message || '分享暂时不可用。' }); }
}
