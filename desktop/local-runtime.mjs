import auth from '../api/auth.js';
import rooms from '../api/rooms.js';
import items from '../api/items.js';
import comments from '../api/comments.js';
import ratings from '../api/ratings.js';
import search from '../api/search.js';
import resolveLink from '../api/resolve-link.js';
import background from '../api/_ai/background.js';
import recommend from '../api/_ai/recommend.js';
import comment from '../api/_ai/comment.js';
import { db, hashSecret } from '../api/_firebase.js';

export const handlers = { '/api/auth': auth, '/api/rooms': rooms, '/api/items': items, '/api/comments': comments, '/api/ratings': ratings, '/api/search': search, '/api/resolve-link': resolveLink, '/api/ai/background': background, '/api/ai/recommend': recommend, '/api/ai/comment': comment };
export async function bootstrap(token) {
  const user = { id: 'local-owner', name: '我的收藏', avatar: '♪', role: 'user', settings: {} };
  const ref = db().collection('albumCircleUsers').doc(user.id);
  const old = await ref.get();
  await ref.set({ ...(old.exists ? old.data() : user), sessionHashes: [hashSecret(token)] });
  const roomRef = db().collection('albumCircleRooms').doc('local-room');
  if (!(await roomRef.get()).exists) await roomRef.set({ name: '我的音乐展柜', ownerId: user.id, ownerName: user.name, members: { [user.id]: true }, memberProfiles: { [user.id]: user }, visibility: 'private', joinMode: 'ownerOnly', createdAt: Date.now(), updatedAt: Date.now() });
  const saved = (await ref.get()).data();
  return { token, user: { ...user, name: saved.name || user.name, avatar: saved.avatar || user.avatar, settings: saved.settings || {}, profile: saved.profile || {} } };
}
