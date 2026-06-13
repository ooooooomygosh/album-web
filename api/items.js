import { FieldValue } from 'firebase-admin/firestore';
import { json, requireUser, roomRef } from './_firebase.js';
import { memberSnapshot } from '../lib/member-profile.js';

function cleanArray(value, fallback = [], limit = 20) {
  return Array.isArray(value) ? value.map((item) => String(item).slice(0, 160)).filter(Boolean).slice(0, limit) : fallback;
}

function cleanProviderLinks(value = []) {
  return Array.isArray(value)
    ? value.map((item) => ({
      provider: String(item?.provider || '').slice(0, 40),
      type: String(item?.type || 'search').slice(0, 40),
      url: String(item?.url || '').slice(0, 700),
      providerId: String(item?.providerId || '').slice(0, 160),
      confidence: String(item?.confidence || 'search').slice(0, 40),
      source: String(item?.source || '').slice(0, 80)
    })).filter((item) => item.provider && /^https?:\/\//i.test(item.url)).slice(0, 10)
    : [];
}

function cleanProfile(value = {}) {
  if (!value || typeof value !== 'object') return null;
  return {
    overview: String(value.overview || '').slice(0, 1800),
    genre: cleanArray(value.genre, [], 8),
    albumContext: String(value.albumContext || '').slice(0, 1600),
    creativeBackground: String(value.creativeBackground || '').slice(0, 1600),
    melodyMotif: String(value.melodyMotif || '').slice(0, 1600),
    lyricPerspective: String(value.lyricPerspective || '').slice(0, 1600),
    arrangement: String(value.arrangement || '').slice(0, 1600),
    releaseState: String(value.releaseState || '').slice(0, 1600),
    listeningGuide: cleanArray(value.listeningGuide, [], 10),
    discussionPrompts: cleanArray(value.discussionPrompts, [], 6),
    sources: Array.isArray(value.sources)
      ? value.sources.map((source) => ({
        title: String(source.title || '').slice(0, 180),
        url: String(source.url || '').slice(0, 500)
      })).filter((source) => source.title && source.url).slice(0, 6)
      : []
  };
}

function cleanItem(body) {
  const title = String(body.title || '').trim().slice(0, 160);
  const artist = String(body.artist || '').trim().slice(0, 160);
  if (!title || !artist) throw new Error('Title and artist are required.');

  return {
    type: String(body.type || 'song').slice(0, 24),
    title,
    artist,
    albumTitle: String(body.albumTitle || body.title || '').trim().slice(0, 180),
    year: String(body.year || 'unknown').slice(0, 16),
    label: String(body.label || 'Apple catalog').slice(0, 120),
    producer: String(body.producer || '').slice(0, 240),
    cover: String(body.cover || '').slice(0, 700),
    palette: cleanArray(body.palette, ['#6fc7ff', '#f7df71', '#f8fbff'], 3),
    platforms: cleanArray(body.platforms, ['Apple Music / iTunes'], 8),
    confidence: Number(body.confidence || body.match || 82),
    match: Number(body.match || body.confidence || 82),
    tracks: cleanArray(body.tracks, [title], 60),
    context: String(body.context || '').slice(0, 900),
    background: String(body.background || '').slice(0, 1200),
    aiProfile: cleanProfile(body.aiProfile),
    tags: cleanArray(body.tags, ['added'], 12),
    source: String(body.source || 'manual').slice(0, 80),
    externalId: String(body.externalId || body.id || '').slice(0, 120),
    externalIds: body.externalIds && typeof body.externalIds === 'object' ? Object.fromEntries(Object.entries(body.externalIds).map(([key, value]) => [String(key).slice(0, 80), String(value || '').slice(0, 180)])) : {},
    collectionId: String(body.collectionId || '').slice(0, 120),
    trackDetails: Array.isArray(body.trackDetails) ? body.trackDetails.slice(0, 80).map((track) => ({
      title: String(track?.title || '').slice(0, 160),
      position: String(track?.position || '').slice(0, 24),
      discNumber: Number(track?.discNumber || 1),
      trackNumber: Number(track?.trackNumber || 0),
      lengthMillis: Number(track?.lengthMillis || 0),
      source: String(track?.source || '').slice(0, 80),
      recordingId: String(track?.recordingId || '').slice(0, 120)
    })).filter((track) => track.title) : [],
    metadataCompleteness: body.metadataCompleteness && typeof body.metadataCompleteness === 'object' ? body.metadataCompleteness : {},
    previewUrl: String(body.previewUrl || '').slice(0, 700),
    trackViewUrl: String(body.trackViewUrl || '').slice(0, 700),
    collectionViewUrl: String(body.collectionViewUrl || '').slice(0, 700),
    storefront: String(body.storefront || body.country || '').slice(0, 12),
    providerLinks: cleanProviderLinks(body.providerLinks),
    copiedFrom: body.copiedFrom && typeof body.copiedFrom === 'object' ? {
      roomId: String(body.copiedFrom.roomId || '').slice(0, 80),
      itemId: String(body.copiedFrom.itemId || '').slice(0, 120),
      title: String(body.copiedFrom.title || '').slice(0, 160),
      artist: String(body.copiedFrom.artist || '').slice(0, 160),
      copiedAt: Date.now()
    } : null,
    addedBy: String(body.addedBy || 'You').trim().slice(0, 60) || 'You',
    addedByAvatar: String(body.addedByAvatar || '').slice(0, 8),
    createdAt: FieldValue.serverTimestamp()
  };
}

function touchRoomForUser(user, extra) {
  return {
    ...extra,
    updatedAt: FieldValue.serverTimestamp(),
    [`members.${user.id}`]: true,
    [`memberProfiles.${user.id}`]: memberSnapshot(user)
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
    if (!canView) return json(res, 403, { error: 'Join the room before opening its showroom.' });
    const itemsRef = ref.collection('items');

    if (req.method === 'GET') {
      const snapshot = await itemsRef.orderBy('createdAt', 'desc').limit(80).get();
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toMillis?.() || data.createdAt || 0
        };
      });

      return json(res, 200, { items });
    }

    if (req.method === 'POST') {
      if (!canWrite) return json(res, 403, { error: 'Join the room before changing its showroom.' });
      if (String(req.body?.action || '') === 'copy') {
        const sourceRoomId = String(req.body?.sourceRoomId || '').slice(0, 80);
        const sourceItemId = String(req.body?.sourceItemId || '').slice(0, 120);
        const sourceRoom = roomRef(sourceRoomId);
        const sourceRoomDoc = await sourceRoom.get();
        if (!sourceRoomDoc.exists) return json(res, 404, { error: 'Source room not found.' });
        const sourceRoomData = sourceRoomDoc.data();
        if (!sourceRoomData.members?.[user.id] && sourceRoomData.visibility !== 'public' && user.role !== 'admin') return json(res, 403, { error: 'You cannot copy from this room.' });
        const sourceItemDoc = await sourceRoom.collection('items').doc(sourceItemId).get();
        if (!sourceItemDoc.exists) return json(res, 404, { error: 'Source item not found.' });
        const sourceItem = sourceItemDoc.data();
        const copied = {
          ...sourceItem,
          copiedFrom: {
            roomId: sourceRoomId,
            itemId: sourceItemId,
            title: sourceItem.title,
            artist: sourceItem.artist
          }
        };
        const item = {
          ...cleanItem(copied),
          addedById: user.id,
          addedBy: user.name,
          addedByAvatar: user.avatar
        };
        const doc = await itemsRef.add(item);
        await ref.update(touchRoomForUser(user, { lastItem: `${item.title} - ${item.artist}`, itemCount: FieldValue.increment(1) }));
        return json(res, 201, { item: { id: doc.id, ...item, createdAt: Date.now() } });
      }
      const item = {
        ...cleanItem(req.body || {}),
        addedById: user.id,
        addedBy: user.name,
        addedByAvatar: user.avatar
      };
      const doc = await itemsRef.add(item);
      await ref.update(
        touchRoomForUser(user, {
          lastItem: `${item.title} - ${item.artist}`,
          itemCount: FieldValue.increment(1)
        })
      );

      return json(res, 201, {
        item: {
          id: doc.id,
          ...item,
          createdAt: Date.now()
        }
      });
    }

    if (req.method === 'DELETE') {
      const itemId = String(req.query.itemId || '').slice(0, 120);
      if (!itemId) return json(res, 400, { error: 'Missing itemId.' });
      const doc = await itemsRef.doc(itemId).get();
      if (!doc.exists) return json(res, 404, { error: 'Item not found.' });
      const data = doc.data();
      if (data.addedById !== user.id && user.role !== 'admin') return json(res, 403, { error: 'You can only delete music you added.' });
      await doc.ref.delete();
      await ref.update({
        updatedAt: FieldValue.serverTimestamp(),
        itemCount: FieldValue.increment(-1)
      });
      return json(res, 200, { ok: true, deletedId: itemId });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    const message = error.message || 'Unknown Firebase error';
    const status = error.status || (message.includes('PERMISSION_DENIED') || message.includes('Firestore API') ? 503 : 502);
    return json(res, status, { error: message });
  }
}
