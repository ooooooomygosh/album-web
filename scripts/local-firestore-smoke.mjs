import { FieldValue } from 'firebase-admin/firestore';

process.env.ALBUM_CIRCLE_LOCAL_FIRESTORE = '1';
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '';

const { db, hashSecret, requireUser } = await import('../api/_firebase.js');

const store = db();
const users = store.collection('albumCircleUsers');
const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const firstToken = `local-token-${runId}`;
const secondToken = `second-token-${runId}`;
const userDoc = await users.add({
  email: `local-smoke-${runId}@example.test`,
  name: 'Local Smoke',
  avatar: 'L',
  sessionHashes: [hashSecret(firstToken)],
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp()
});

await userDoc.set({
  sessionHashes: FieldValue.arrayUnion(hashSecret(secondToken)),
  loginCount: FieldValue.increment(1),
  profile: {
    favoriteGenres: ['Dream Pop']
  }
}, { merge: true });

const found = await users.where('sessionHashes', 'array-contains', hashSecret(secondToken)).limit(1).get();
if (found.empty || found.docs[0].id !== userDoc.id) {
  throw new Error('Local Firestore array-contains query failed.');
}

const user = await requireUser({ headers: { authorization: `Bearer ${secondToken}` } });
if (user.id !== userDoc.id || user.loginCount !== 1 || user.profile.favoriteGenres[0] !== 'Dream Pop') {
  throw new Error(`Local requireUser returned wrong user: ${JSON.stringify(user)}`);
}

const roomRef = store.collection('albumCircleRooms').doc('local-room');
await roomRef.set({
  name: 'Local Room',
  members: { [user.id]: true },
  itemCount: 0,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp()
});
await roomRef.collection('items').add({
  title: 'Local Song',
  artist: 'Album Circle',
  addedById: user.id,
  createdAt: FieldValue.serverTimestamp()
});
const items = await roomRef.collection('items').where('addedById', '==', user.id).limit(5).get();
if (items.size !== 1) throw new Error(`Local subcollection query failed: ${items.size}`);

const batch = store.batch();
batch.update(roomRef, { [`memberProfiles.${user.id}`]: { name: user.name, avatar: user.avatar } });
batch.delete(items.docs[0].ref);
await batch.commit();

const updatedRoom = await roomRef.get();
if (updatedRoom.data()?.memberProfiles?.[user.id]?.name !== user.name) {
  throw new Error('Local batch update failed.');
}

const deletedItems = await roomRef.collection('items').where('addedById', '==', user.id).limit(5).get();
if (!deletedItems.empty) throw new Error(`Local batch delete failed: ${deletedItems.size}`);

console.log(JSON.stringify({
  userId: user.id,
  queriedUsers: found.size,
  queriedItems: items.size,
  remainingItems: deletedItems.size
}, null, 2));
