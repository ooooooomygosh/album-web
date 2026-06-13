import { FieldValue } from 'firebase-admin/firestore';
import { db, hashSecret, json, randomToken, storageBucket } from './_firebase.js';
import { normalizeStoredPersona } from '../lib/music-persona.js';

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 160);
}

function adminCredentials() {
  const login = String(process.env.ADMIN_LOGIN || 'admin').trim();
  const password = String(process.env.ADMIN_PASSWORD || '');
  return {
    login,
    email: login.includes('@') ? cleanEmail(login) : 'admin@album-circle.local',
    password,
    enabled: Boolean(password)
  };
}

function cleanList(value, limit = 12, max = 80) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[，,、\n]/);
  return [...new Set(list.map((item) => String(item || '').trim().slice(0, max)).filter(Boolean))].slice(0, limit);
}

function cleanLinks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      label: String(item?.label || '').trim().slice(0, 40),
      url: String(item?.url || '').trim().slice(0, 240)
    }))
    .filter((item) => item.label && /^https?:\/\//i.test(item.url))
    .slice(0, 5);
}

function cleanProfile(value = {}) {
  const profile = value && typeof value === 'object' ? value : {};
  const birthYear = Number(profile.birthYear || 0);
  return {
    bio: String(profile.bio || '').trim().slice(0, 360),
    location: String(profile.location || '').trim().slice(0, 80),
    favoriteGenres: cleanList(profile.favoriteGenres, 16, 60),
    favoriteArtists: cleanList(profile.favoriteArtists, 18, 80),
    favoriteBands: cleanList(profile.favoriteBands, 18, 80),
    favoriteAlbums: cleanList(profile.favoriteAlbums, 18, 120),
    favoriteSongs: cleanList(profile.favoriteSongs, 24, 120),
    gender: String(profile.gender || '').trim().slice(0, 40),
    birthYear: birthYear >= 1900 && birthYear <= new Date().getFullYear() ? birthYear : '',
    mbti: String(profile.mbti || '').trim().toUpperCase().slice(0, 16),
    major: String(profile.major || '').trim().slice(0, 100),
    links: cleanLinks(profile.links)
  };
}

function publicUser(id, data, token) {
  const userData = { id, ...data, profile: cleanProfile(data.profile || {}), publicTags: cleanList(data.publicTags, 24, 40) };
  return {
    token,
    user: {
      id,
      email: data.email,
      name: data.name,
      avatar: data.avatar,
      avatarUrl: data.avatarUrl || '',
      avatarDataUrl: data.avatarDataUrl || '',
      profile: userData.profile,
      publicTags: userData.publicTags,
      latestPersona: normalizeStoredPersona(data.latestPersona, userData),
      role: data.role || 'user',
      createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now()
    }
  };
}

function publicUserPayload(id, data) {
  const userData = { id, ...data, profile: cleanProfile(data.profile || {}), publicTags: cleanList(data.publicTags, 24, 40) };
  return {
    id,
    email: data.email,
    name: data.name,
    avatar: data.avatar,
    avatarUrl: data.avatarUrl || '',
    avatarDataUrl: data.avatarDataUrl || '',
    profile: userData.profile,
    publicTags: userData.publicTags,
    latestPersona: normalizeStoredPersona(data.latestPersona, userData),
    role: data.role || 'user',
    createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now()
  };
}

function parseAvatarDataUrl(value) {
  const text = String(value || '');
  const match = text.match(/^data:(image\/(?:png|jpe?g|webp));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw Object.assign(new Error('Avatar must be a PNG, JPEG, or WebP data URL.'), { status: 400 });
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 180000) throw Object.assign(new Error('Avatar image must be under 180 KB after compression.'), { status: 400 });
  return { mime: match[1], buffer, dataUrl: text };
}

function publicRoom(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || 'Untitled room',
    ownerName: data.ownerName || '',
    itemCount: data.itemCount || 0,
    commentCount: data.commentCount || 0,
    memberCount: Object.keys(data.members || {}).length,
    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || 0
  };
}

function countBy(list, key) {
  const map = new Map();
  list.forEach((item) => {
    const value = String(item[key] || '').trim();
    if (!value) return;
    map.set(value, (map.get(value) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count }));
}

function countValues(list) {
  const map = new Map();
  list.forEach((item) => {
    const value = String(item || '').trim();
    if (!value) return;
    map.set(value, (map.get(value) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([name, count]) => ({ name, count }));
}

async function profileStats(user) {
  const roomsSnapshot = await db().collection('albumCircleRooms').where(`members.${user.id}`, '==', true).limit(30).get();
  const rooms = roomsSnapshot.docs.map(publicRoom).sort((a, b) => b.updatedAt - a.updatedAt);
  const itemBatches = await Promise.all(
    roomsSnapshot.docs.map(async (roomDoc) => {
      const items = await roomDoc.ref.collection('items').where('addedById', '==', user.id).limit(80).get();
      return items.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          roomId: roomDoc.id,
          roomName: roomDoc.data().name || 'Untitled room',
          type: data.type || 'song',
          title: data.title || '',
          artist: data.artist || '',
          albumTitle: data.albumTitle || '',
          cover: data.cover || '',
          tags: data.tags || [],
          createdAt: data.createdAt?.toMillis?.() || data.createdAt || 0
        };
      });
    })
  );
  const addedItems = itemBatches.flat().sort((a, b) => b.createdAt - a.createdAt);
  return {
    rooms,
    stats: {
      roomsJoined: rooms.length,
      itemsAdded: addedItems.length,
      albumsAdded: addedItems.filter((item) => item.type === 'album').length,
      songsAdded: addedItems.filter((item) => item.type !== 'album').length,
      topArtists: countBy(addedItems, 'artist'),
      topAlbums: countBy(addedItems, 'albumTitle'),
      tags: countValues(addedItems.flatMap((item) => item.tags || [])),
      recentAdds: addedItems.slice(0, 24)
    }
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { requireUser } = await import('./_firebase.js');
      const user = await requireUser(req);
      if (req.query.action === 'stats') return json(res, 200, await profileStats(user));
      return json(res, 200, { user: publicUserPayload(user.id, user) });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

    const body = req.body || {};
    const action = String(body.action || 'login');
    const rawEmail = String(body.email || '').trim();
    const admin = adminCredentials();
    const isAdminLoginName = rawEmail === admin.login || rawEmail === admin.email;
    const email = isAdminLoginName ? admin.email : cleanEmail(rawEmail);
    const password = String(body.password || '');
    const name = String(body.name || email.split('@')[0] || 'Music friend').trim().slice(0, 60);
    const avatar = String(body.avatar || name[0] || 'M').trim().slice(0, 2);

    const isBootstrapAdmin = admin.enabled && isAdminLoginName && password === admin.password;

    if (action === 'updateProfile') {
      const { requireUser } = await import('./_firebase.js');
      const user = await requireUser(req);
      const nextName = String(body.name || user.name || '').trim().slice(0, 60) || user.name;
      const nextAvatar = String(body.avatar || user.avatar || nextName[0] || 'M').trim().slice(0, 2);
      const patch = {
        name: nextName,
        avatar: nextAvatar,
        avatarUrl: String(body.avatarUrl || user.avatarUrl || '').trim().slice(0, 700),
        avatarDataUrl: String(body.avatarDataUrl || user.avatarDataUrl || '').trim().slice(0, 180000),
        profile: cleanProfile(body.profile || {}),
        publicTags: cleanList(body.publicTags, 24, 40),
        updatedAt: FieldValue.serverTimestamp()
      };
      await db().collection('albumCircleUsers').doc(user.id).set(patch, { merge: true });
      return json(res, 200, publicUser(user.id, { ...user, ...patch }, req.headers.authorization?.replace(/^Bearer\s+/i, '')));
    }

    if (action === 'avatar') {
      const { requireUser } = await import('./_firebase.js');
      const user = await requireUser(req);
      const { mime, buffer, dataUrl } = parseAvatarDataUrl(body.dataUrl);
      const extension = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const patch = { updatedAt: FieldValue.serverTimestamp() };
      try {
        const bucket = storageBucket();
        const file = bucket.file(`album-circle-avatars/${user.id}/avatar.${extension}`);
        await file.save(buffer, {
          resumable: false,
          metadata: { contentType: mime, cacheControl: 'public, max-age=31536000' }
        });
        await file.makePublic().catch(() => null);
        patch.avatarUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
        patch.avatarDataUrl = '';
      } catch {
        patch.avatarDataUrl = dataUrl;
        patch.avatarUrl = '';
      }
      await db().collection('albumCircleUsers').doc(user.id).set(patch, { merge: true });
      return json(res, 200, { ok: true, avatarUrl: patch.avatarUrl || '', avatarDataUrl: patch.avatarDataUrl || '' });
    }

    if (!isBootstrapAdmin && (!email.includes('@') || password.length < 6)) {
      return json(res, 400, { error: 'Use an email and a password with at least 6 characters.' });
    }

    const users = db().collection('albumCircleUsers');
    const existing = await users.where('email', '==', email).limit(1).get();
    const passwordHash = hashSecret(password);

    if (isBootstrapAdmin) {
      const token = randomToken();
      const adminData = {
        email,
        name: 'Admin',
        avatar: 'A',
        role: 'admin',
        passwordHash,
        tokenHash: hashSecret(token),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      if (existing.empty) {
        const doc = await users.add(adminData);
        return json(res, 201, publicUser(doc.id, { ...adminData, createdAt: Date.now() }, token));
      }
      const doc = existing.docs[0];
      await doc.ref.set({ ...adminData, createdAt: doc.data().createdAt || FieldValue.serverTimestamp() }, { merge: true });
      return json(res, 200, publicUser(doc.id, { ...doc.data(), ...adminData }, token));
    }

    if (action === 'signup' || action === 'register') {
      if (!existing.empty) return json(res, 409, { error: 'This email is already registered.' });
      const token = randomToken();
      const doc = await users.add({
        email,
        name,
        avatar,
        passwordHash,
        tokenHash: hashSecret(token),
        role: 'user',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      return json(res, 201, publicUser(doc.id, { email, name, avatar, role: 'user', createdAt: Date.now() }, token));
    }

    if (existing.empty) return json(res, 401, { error: 'Account not found.' });
    const doc = existing.docs[0];
    const data = doc.data();
    if (data.passwordHash !== passwordHash) return json(res, 401, { error: 'Incorrect password.' });

    const token = randomToken();
    await doc.ref.set(
      {
        tokenHash: hashSecret(token),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return json(res, 200, publicUser(doc.id, data, token));
  } catch (error) {
    return json(res, error.status || 502, { error: error.message || 'Authentication failed.' });
  }
}
