import { FieldValue } from 'firebase-admin/firestore';
import { json, requireUser, roomRef } from './_firebase.js';

function cleanComment(body) {
  const text = String(body.text || '').trim().slice(0, 1200);
  if (!text) throw new Error('Comment text is required.');

  return {
    author: String(body.author || 'You').trim().slice(0, 40) || 'You',
    avatar: String(body.avatar || body.author || 'Y').trim().slice(0, 2).toUpperCase(),
    mood: String(body.mood || '9.0').trim().slice(0, 8),
    text,
    albumId: String(body.albumId || 'unknown').slice(0, 80),
    albumTitle: String(body.albumTitle || '').slice(0, 160),
    createdAt: FieldValue.serverTimestamp()
  };
}

function touchRoomForUser(user, extra) {
  return {
    ...extra,
    updatedAt: FieldValue.serverTimestamp(),
    [`members.${user.id}`]: true,
    [`memberProfiles.${user.id}`]: { name: user.name, avatar: user.avatar, avatarUrl: user.avatarUrl || '', publicTags: user.publicTags || [] }
  };
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
    if (!canView) return json(res, 403, { error: 'Join the room before opening comments.' });
    const commentsRef = ref.collection('comments');

    if (req.method === 'GET') {
      const snapshot = await commentsRef.orderBy('createdAt', 'desc').limit(80).get();
      const comments = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          author: data.author,
          avatar: data.avatar,
          mood: data.mood,
          text: data.text,
          userId: data.userId || '',
          albumId: data.albumId,
          albumTitle: data.albumTitle,
          isAi: Boolean(data.isAi),
          replyTo: data.replyTo || '',
          createdAt: data.createdAt?.toMillis?.() || data.createdAt || 0
        };
      });

      return json(res, 200, { comments });
    }

    if (req.method === 'POST') {
      if (!canWrite) return json(res, 403, { error: 'Join the room before commenting.' });
      const comment = {
        ...cleanComment(req.body || {}),
        userId: user.id,
        author: user.name,
        avatar: user.avatar
      };
      const doc = await commentsRef.add(comment);
      await ref.update(
        touchRoomForUser(user, {
          lastComment: comment.text,
          commentCount: FieldValue.increment(1)
        })
      );

      return json(res, 201, {
        comment: {
          id: doc.id,
          ...comment,
          createdAt: Date.now()
        }
      });
    }

    if (req.method === 'DELETE') {
      const commentId = String(req.query.commentId || '').slice(0, 120);
      if (!commentId) return json(res, 400, { error: 'Missing commentId.' });
      const doc = await commentsRef.doc(commentId).get();
      if (!doc.exists) return json(res, 404, { error: 'Comment not found.' });
      const data = doc.data();
      if (data.userId !== user.id && user.role !== 'admin') return json(res, 403, { error: 'You can only delete your own comments.' });
      await doc.ref.delete();
      await ref.update({
        updatedAt: FieldValue.serverTimestamp(),
        commentCount: FieldValue.increment(-1)
      });
      return json(res, 200, { ok: true, deletedId: commentId });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    const message = error.message || 'Unknown Firebase error';
    const status = error.status || (message.includes('PERMISSION_DENIED') || message.includes('Firestore API') ? 503 : 502);
    return json(res, status, {
      error: message,
      action:
        status === 503
          ? 'Enable Cloud Firestore API and create a Firestore database for this Firebase project.'
          : 'Check Firebase service account configuration.'
    });
  }
}
