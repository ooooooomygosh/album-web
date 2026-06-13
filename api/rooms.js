import { FieldValue } from 'firebase-admin/firestore';
import { db, hashSecret, json, requireUser, roomRef, safeId } from './_firebase.js';

function cleanName(value) {
  return String(value || '').trim().slice(0, 80);
}

function cleanImageUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:') return '';
    const trustedHosts = [
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'res.cloudinary.com',
      'images.unsplash.com',
      'is1-ssl.mzstatic.com',
      'is2-ssl.mzstatic.com',
      'is3-ssl.mzstatic.com',
      'is4-ssl.mzstatic.com',
      'is5-ssl.mzstatic.com',
      'coverartarchive.org'
    ];
    const imageLike = /\.(png|jpe?g|webp|avif)(\?.*)?$/i.test(url.pathname + url.search)
      || /(^|[?&])(format|fm|contentType)=([^&]*)(png|jpe?g|webp|avif|image%2F|image\/)/i.test(url.search)
      || trustedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    if (!imageLike) return '';
    return url.toString().slice(0, 520);
  } catch {
    return '';
  }
}

function cleanHeroConfig(value = {}, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const owns = (key) => Object.prototype.hasOwnProperty.call(source, key);
  const pick = (key, defaultValue = '') => (owns(key) ? source[key] : fallback[key] ?? defaultValue);
  const visualModeValue = pick('visualMode', 'observatory');
  const motionLevelValue = pick('motionLevel', 'ambient');
  const visualMode = ['observatory', 'vinyl', 'editorial'].includes(visualModeValue) ? visualModeValue : 'observatory';
  const motionLevel = ['still', 'ambient', 'cinematic'].includes(motionLevelValue) ? motionLevelValue : 'ambient';
  return {
    eyebrow: String(pick('eyebrow', 'shared listening room')).slice(0, 48),
    title: String(pick('title', '')).slice(0, 80),
    titleSuffix: String(pick('titleSuffix', '把朋友的推荐整理成展柜。')).slice(0, 80),
    description: String(pick('description', '')).slice(0, 280),
    accentName: String(pick('accentName', 'Listening Observatory')).slice(0, 42),
    backgroundUrl: cleanImageUrl(pick('backgroundUrl', '')),
    visualMode,
    motionLevel
  };
}

function publicRoom(id, data) {
  return {
    id,
    name: data.name || 'Untitled room',
    description: data.description || '',
    heroConfig: cleanHeroConfig(data.heroConfig, { description: data.description || '' }),
    ownerId: data.ownerId,
    ownerName: data.ownerName,
    visibility: data.visibility || 'unlisted',
    joinMode: data.joinMode || 'open',
    discoverable: Boolean(data.discoverable),
    itemCount: data.itemCount || 0,
    commentCount: data.commentCount || 0,
    memberProfiles: data.memberProfiles || {},
    createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now()
  };
}

function memberPatch(user) {
  return {
    [`members.${user.id}`]: true,
    [`memberProfiles.${user.id}`]: {
      name: user.name,
      avatar: user.avatar,
      avatarUrl: user.avatarUrl || '',
      publicTags: user.publicTags || []
    },
    updatedAt: FieldValue.serverTimestamp()
  };
}

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);

    if (req.method === 'GET') {
      if (req.query.scope === 'discover') {
        const snapshot = await db()
          .collection('albumCircleRooms')
          .where('visibility', '==', 'public')
          .where('discoverable', '==', true)
          .limit(40)
          .get();
        const rooms = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || 'Untitled room',
              description: data.description || '',
              ownerName: data.ownerName || '',
              joinMode: data.joinMode || 'open',
              itemCount: data.itemCount || 0,
              commentCount: data.commentCount || 0,
              memberCount: Object.keys(data.members || {}).length,
              updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || 0
            };
          })
          .sort((a, b) => b.updatedAt - a.updatedAt);
        return json(res, 200, { rooms });
      }

      const requested = req.query.roomId ? safeId(req.query.roomId) : '';
      if (requested) {
        const doc = await roomRef(requested).get();
        if (!doc.exists) return json(res, 404, { error: 'Room not found.' });
        const data = doc.data();
        if (!data.members?.[user.id] && data.visibility !== 'public') return json(res, 403, { error: 'Join the room before opening it.' });
        return json(res, 200, { room: publicRoom(doc.id, doc.data()) });
      }

      const snapshot = await db()
        .collection('albumCircleRooms')
        .where(`members.${user.id}`, '==', true)
        .limit(20)
        .get();
      const rooms = snapshot.docs
        .map((doc) => publicRoom(doc.id, doc.data()))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      return json(res, 200, { rooms });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = String(body.action || 'create');

      if (action === 'join') {
        const roomId = safeId(body.roomId);
        const doc = await roomRef(roomId).get();
        if (!doc.exists) return json(res, 404, { error: 'Room not found.' });
        const data = doc.data();
        if ((data.joinMode || 'open') === 'password') {
          const password = String(body.password || '');
          if (!data.passwordHash || hashSecret(password) !== data.passwordHash) return json(res, 403, { error: 'Room password is incorrect.' });
        }
        if ((data.joinMode || 'open') === 'ownerOnly' && data.ownerId !== user.id && user.role !== 'admin') return json(res, 403, { error: 'This room is not open for self-join.' });
        await doc.ref.update(memberPatch(user));
        const updated = await doc.ref.get();
        return json(res, 200, { room: publicRoom(updated.id, updated.data()) });
      }

      if (action === 'settings') {
        const roomId = safeId(body.roomId);
        const ref = roomRef(roomId);
        const doc = await ref.get();
        if (!doc.exists) return json(res, 404, { error: 'Room not found.' });
        const data = doc.data();
        if (data.ownerId !== user.id && user.role !== 'admin') return json(res, 403, { error: 'Only the room owner can update room settings.' });
        const visibility = ['public', 'unlisted', 'private'].includes(body.visibility) ? body.visibility : data.visibility || 'unlisted';
        const joinMode = ['open', 'password', 'ownerOnly'].includes(body.joinMode) ? body.joinMode : data.joinMode || 'open';
        const patch = {
          visibility,
          joinMode,
          discoverable: Boolean(body.discoverable && visibility === 'public'),
          description: String(Object.prototype.hasOwnProperty.call(body, 'description') ? body.description : data.description || '').slice(0, 180),
          heroConfig: cleanHeroConfig(body.heroConfig, data.heroConfig || { description: data.description || '' }),
          updatedAt: FieldValue.serverTimestamp()
        };
        if (joinMode === 'password' && body.password) patch.passwordHash = hashSecret(String(body.password));
        await ref.set(patch, { merge: true });
        const updated = await ref.get();
        return json(res, 200, { room: publicRoom(updated.id, updated.data()) });
      }

      const name = cleanName(body.name);
      if (!name) return json(res, 400, { error: 'Room name is required.' });
      const id = safeId(body.slug || `${name}-${Date.now().toString(36)}`);
      const ref = roomRef(id);
      const exists = await ref.get();
      if (exists.exists) return json(res, 409, { error: 'Room id already exists.' });
      const room = {
        name,
        description: String(body.description || '').slice(0, 180),
        heroConfig: cleanHeroConfig(body.heroConfig, { description: body.description || '' }),
        ownerId: user.id,
        ownerName: user.name,
        visibility: ['public', 'unlisted', 'private'].includes(body.visibility) ? body.visibility : 'unlisted',
        joinMode: ['open', 'password', 'ownerOnly'].includes(body.joinMode) ? body.joinMode : 'open',
        discoverable: Boolean(body.discoverable && body.visibility === 'public'),
        passwordHash: body.password ? hashSecret(String(body.password)) : '',
        members: { [user.id]: true },
        memberProfiles: {
          [user.id]: {
            name: user.name,
            avatar: user.avatar,
            avatarUrl: user.avatarUrl || '',
            publicTags: user.publicTags || []
          }
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      await ref.set(room);
      return json(res, 201, { room: publicRoom(id, { ...room, createdAt: Date.now(), updatedAt: Date.now() }) });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return json(res, error.status || 502, { error: error.message || 'Room request failed.' });
  }
}
