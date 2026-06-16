import { FieldValue } from 'firebase-admin/firestore';
import { json, requireUser, roomRef, safeId } from './_firebase.js';
import { memberSnapshot } from '../lib/member-profile.js';

function cleanScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) throw Object.assign(new Error('Score is required.'), { status: 400 });
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

function ratingDocId(userId, itemId) {
  return `${safeId(userId)}_${safeId(itemId)}`.slice(0, 180);
}

function touchRoomForUser(user) {
  return {
    updatedAt: FieldValue.serverTimestamp(),
    [`members.${user.id}`]: true,
    [`memberProfiles.${user.id}`]: memberSnapshot(user)
  };
}

async function ensureItemExists(ref, itemId) {
  const itemDoc = await ref.collection('items').doc(safeId(itemId)).get();
  if (!itemDoc.exists) throw Object.assign(new Error('Item not found.'), { status: 404 });
}

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const ref = roomRef(req.query.roomId);
    const roomDoc = await ref.get();
    if (!roomDoc.exists) return json(res, 404, { error: 'Room not found.' });
    const roomData = roomDoc.data();
    const canView = roomData.members?.[user.id] || roomData.visibility === 'public' || user.role === 'admin';
    const canWrite = roomData.members?.[user.id] || user.role === 'admin';
    if (!canView) return json(res, 403, { error: 'Join the room before opening ratings.' });

    const ratingsRef = ref.collection('ratings');

    if (req.method === 'GET') {
      const itemId = String(req.query.itemId || '').slice(0, 120);
      if (!itemId) return json(res, 400, { error: 'Missing itemId.' });
      await ensureItemExists(ref, itemId);
      const snapshot = await ratingsRef.where('itemId', '==', itemId).limit(200).get();
      const ratings = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          itemId: data.itemId || '',
          userId: data.userId || '',
          userName: data.userName || '',
          score: Number(data.score || 0),
          updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || 0
        };
      });
      const count = ratings.length;
      const average = count ? Math.round((ratings.reduce((sum, rating) => sum + rating.score, 0) / count) * 10) / 10 : 0;
      const mine = ratings.find((rating) => rating.userId === user.id) || null;
      return json(res, 200, { itemId, average, count, mine, ratings });
    }

    if (req.method === 'POST') {
      if (!canWrite) return json(res, 403, { error: 'Join the room before rating.' });
      const itemId = String(req.body?.itemId || '').slice(0, 120);
      if (!itemId) return json(res, 400, { error: 'Missing itemId.' });
      await ensureItemExists(ref, itemId);
      const score = cleanScore(req.body?.score);
      const rating = {
        itemId,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        score,
        updatedAt: FieldValue.serverTimestamp()
      };
      const docId = ratingDocId(user.id, itemId);
      await ratingsRef.doc(docId).set(rating, { merge: true });
      await ref.update(touchRoomForUser(user));
      return json(res, 200, {
        rating: {
          id: docId,
          ...rating,
          updatedAt: Date.now()
        }
      });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return json(res, error.status || 502, { error: error.message || 'Rating request failed.' });
  }
}
