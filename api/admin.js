import { FieldValue } from 'firebase-admin/firestore';
import { db, json, requireAdmin, safeId } from './_firebase.js';

function publicUser(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    email: data.email,
    name: data.name,
    avatar: data.avatar,
    role: data.role || 'user',
    createdAt: data.createdAt?.toMillis?.() || data.createdAt || 0,
    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || 0
  };
}

function publicRoom(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    ownerName: data.ownerName,
    itemCount: data.itemCount || 0,
    commentCount: data.commentCount || 0,
    members: Object.keys(data.members || {}).length,
    createdAt: data.createdAt?.toMillis?.() || data.createdAt || 0,
    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || 0
  };
}

async function deleteCollection(ref, batchSize = 120) {
  let total = 0;
  while (true) {
    const snapshot = await ref.limit(batchSize).get();
    if (snapshot.empty) return total;
    const batch = db().batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    total += snapshot.size;
  }
}

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req);
    const action = String(req.query.action || req.body?.action || 'dashboard');

    if (req.method === 'GET') {
      if (action === 'config') {
        const doc = await db().collection('albumCircleConfig').doc('ai').get();
        return json(res, 200, { config: doc.exists ? doc.data() : {} });
      }

      const [roomsSnapshot, usersSnapshot, configDoc] = await Promise.all([
        db().collection('albumCircleRooms').orderBy('updatedAt', 'desc').limit(50).get(),
        db().collection('albumCircleUsers').orderBy('updatedAt', 'desc').limit(80).get(),
        db().collection('albumCircleConfig').doc('ai').get()
      ]);
      return json(res, 200, {
        admin: { id: admin.id, name: admin.name },
        rooms: roomsSnapshot.docs.map(publicRoom),
        users: usersSnapshot.docs.map(publicUser),
        config: configDoc.exists ? configDoc.data() : {}
      });
    }

    if (req.method === 'POST') {
      if (action === 'config') {
        const customPrompt = String(req.body?.customPrompt || '').slice(0, 6000);
        const personaPrompt = String(req.body?.personaPrompt || '').slice(0, 6000);
        const temperature = Number(req.body?.temperature || 0.5);
        const personaTemperature = Number(req.body?.personaTemperature ?? 0.72);
        const maxTokens = Number(req.body?.maxTokens || 2100);
        const personaMaxTokens = Number(req.body?.personaMaxTokens || 16000);
        const personaChatMaxTokens = Number(req.body?.personaChatMaxTokens || 5200);
        const config = {
          customPrompt,
          personaPrompt,
          temperature: Math.max(0, Math.min(1, temperature)),
          personaTemperature: Math.max(0, Math.min(1, personaTemperature)),
          maxTokens: Math.max(700, Math.min(3200, maxTokens)),
          personaMaxTokens: Math.max(1200, Math.min(16000, personaMaxTokens)),
          personaChatMaxTokens: Math.max(900, Math.min(8000, personaChatMaxTokens)),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: admin.id
        };
        await db().collection('albumCircleConfig').doc('ai').set(config, { merge: true });
        return json(res, 200, { config: { ...config, updatedAt: Date.now() } });
      }
      return json(res, 400, { error: 'Unknown admin action.' });
    }

    if (req.method === 'DELETE') {
      if (action === 'room') {
        const roomId = safeId(req.query.roomId || req.body?.roomId);
        if (!roomId) return json(res, 400, { error: 'Missing roomId.' });
        const room = db().collection('albumCircleRooms').doc(roomId);
        await Promise.all([deleteCollection(room.collection('items')), deleteCollection(room.collection('comments'))]);
        await room.delete();
        return json(res, 200, { ok: true, deletedRoom: roomId });
      }

      if (action === 'user') {
        const userId = String(req.query.userId || req.body?.userId || '').slice(0, 120);
        if (!userId) return json(res, 400, { error: 'Missing userId.' });
        if (userId === admin.id) return json(res, 400, { error: 'Admin cannot delete the current admin account.' });
        await db().collection('albumCircleUsers').doc(userId).delete();
        return json(res, 200, { ok: true, deletedUser: userId });
      }

      return json(res, 400, { error: 'Unknown admin delete action.' });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return json(res, error.status || 502, { error: error.message || 'Admin request failed.' });
  }
}
