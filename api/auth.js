import { FieldValue } from 'firebase-admin/firestore';
import { db, hashSecret, json, randomToken, storageBucket } from './_firebase.js';
import { normalizeStoredPersona } from '../lib/music-persona.js';
import { memberSnapshot } from '../lib/member-profile.js';

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

const defaultSettings = {
  appearance: {
    glass: 62,
    reduceMotion: false,
    rainbowStatus: true,
    themeStrategy: 'cover',
    customTheme: '#7ed7c9'
  },
  showroom: {
    coverSize: 'comfortable',
    wallLayout: '4x3',
    hoverPreview: 'flip',
    title: '',
    description: '',
    defaultMode: 'cabinet',
    detailMode: 'dossier'
  },
  filters: {
    mineOnly: false
  },
  persona: {
    tone: 'warm',
    historyMode: 'mine'
  }
};

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function cleanHex(value, fallback = '#7ed7c9') {
  const text = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function cleanSettings(value = {}, fallback = defaultSettings) {
  const source = value && typeof value === 'object' ? value : {};
  const appearance = source.appearance && typeof source.appearance === 'object' ? source.appearance : {};
  const showroom = source.showroom && typeof source.showroom === 'object' ? source.showroom : {};
  const filters = source.filters && typeof source.filters === 'object' ? source.filters : {};
  const persona = source.persona && typeof source.persona === 'object' ? source.persona : {};
  return {
    appearance: {
      glass: clampNumber(appearance.glass, fallback.appearance?.glass ?? defaultSettings.appearance.glass, 35, 82),
      reduceMotion: Boolean(appearance.reduceMotion ?? fallback.appearance?.reduceMotion ?? false),
      rainbowStatus: Boolean(appearance.rainbowStatus ?? fallback.appearance?.rainbowStatus ?? true),
      themeStrategy: ['cover', 'custom', 'room'].includes(appearance.themeStrategy) ? appearance.themeStrategy : fallback.appearance?.themeStrategy || 'cover',
      customTheme: cleanHex(appearance.customTheme, fallback.appearance?.customTheme || defaultSettings.appearance.customTheme)
    },
    showroom: {
      coverSize: ['compact', 'comfortable', 'large'].includes(showroom.coverSize) ? showroom.coverSize : fallback.showroom?.coverSize || 'comfortable',
      wallLayout: ['2x2', '3x3', '4x3', '5x4', 'auto'].includes(showroom.wallLayout) ? showroom.wallLayout : fallback.showroom?.wallLayout || '4x3',
      hoverPreview: ['flip', 'blur', 'lift'].includes(showroom.hoverPreview) ? showroom.hoverPreview : fallback.showroom?.hoverPreview || 'flip',
      title: typeof showroom.title === 'string' ? showroom.title.slice(0, 80) : fallback.showroom?.title || '',
      description: typeof showroom.description === 'string' ? showroom.description.slice(0, 220) : fallback.showroom?.description || '',
      defaultMode: ['cabinet', 'detail'].includes(showroom.defaultMode) ? showroom.defaultMode : fallback.showroom?.defaultMode || 'cabinet',
      detailMode: ['dossier', 'comments', 'tracks'].includes(showroom.detailMode) ? showroom.detailMode : fallback.showroom?.detailMode || 'dossier'
    },
    filters: {
      mineOnly: Boolean(filters.mineOnly ?? fallback.filters?.mineOnly ?? false)
    },
    persona: {
      tone: ['warm', 'mystic', 'critic', 'playful'].includes(persona.tone) ? persona.tone : fallback.persona?.tone || 'warm',
      historyMode: ['selected', 'mine', 'room', 'none'].includes(persona.historyMode) ? persona.historyMode : fallback.persona?.historyMode || 'mine'
    }
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
      settings: cleanSettings(data.settings || {}),
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
    settings: cleanSettings(data.settings || {}),
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

async function syncJoinedRoomProfiles(user) {
  const snapshot = memberSnapshot(user);
  const roomsSnapshot = await db().collection('albumCircleRooms').where(`members.${user.id}`, '==', true).limit(50).get();
  if (roomsSnapshot.empty) return;
  const batch = db().batch();
  roomsSnapshot.docs.forEach((roomDoc) => {
    batch.update(roomDoc.ref, { [`memberProfiles.${user.id}`]: snapshot });
  });
  await batch.commit();
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
      const nextUser = { ...user, ...patch };
      await syncJoinedRoomProfiles(nextUser);
      return json(res, 200, publicUser(user.id, nextUser, req.headers.authorization?.replace(/^Bearer\s+/i, '')));
    }

    if (action === 'updateSettings') {
      const { requireUser } = await import('./_firebase.js');
      const user = await requireUser(req);
      const settings = cleanSettings(body.settings || {}, cleanSettings(user.settings || {}));
      const patch = {
        settings,
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
      await syncJoinedRoomProfiles({ ...user, ...patch });
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
      const sessionHash = hashSecret(token);
      const baseAdminData = {
        email,
        name: 'Admin',
        avatar: 'A',
        role: 'admin',
        passwordHash,
        tokenHash: hashSecret(token),
        sessionHashes: [sessionHash],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      if (existing.empty) {
        const adminData = { ...baseAdminData, settings: cleanSettings({}) };
        const doc = await users.add(adminData);
        return json(res, 201, publicUser(doc.id, { ...adminData, createdAt: Date.now() }, token));
      }
      const doc = existing.docs[0];
      const existingData = doc.data();
      const adminPatch = {
        email,
        name: existingData.name || 'Admin',
        avatar: existingData.avatar || 'A',
        role: 'admin',
        passwordHash,
        tokenHash: hashSecret(token),
        sessionHashes: FieldValue.arrayUnion(sessionHash),
        createdAt: existingData.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      await doc.ref.set(adminPatch, { merge: true });
      return json(res, 200, publicUser(doc.id, { ...existingData, ...adminPatch, sessionHashes: [...(existingData.sessionHashes || []), sessionHash] }, token));
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
        sessionHashes: [hashSecret(token)],
        settings: cleanSettings({}),
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
        sessionHashes: FieldValue.arrayUnion(hashSecret(token)),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return json(res, 200, publicUser(doc.id, data, token));
  } catch (error) {
    return json(res, error.status || 502, { error: error.message || 'Authentication failed.' });
  }
}
