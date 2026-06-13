import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import crypto from 'node:crypto';

function readServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey
    };
  }

  return null;
}

export function db() {
  if (!getApps().length) {
    const serviceAccount = readServiceAccount();
    if (!serviceAccount) {
      throw new Error('Firebase service account is not configured.');
    }

    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'music-b0420.firebasestorage.app'
    });
  }

  return getFirestore();
}

export function storageBucket() {
  db();
  return getStorage().bucket();
}

export function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function safeId(value = 'default') {
  return String(value || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'default';
}

export function roomRef(roomId = 'default') {
  return db().collection('albumCircleRooms').doc(safeId(roomId));
}

export function hashSecret(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export async function requireUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-album-circle-token'];
  if (!token) throw Object.assign(new Error('Authentication required.'), { status: 401 });

  const snapshot = await db().collection('albumCircleUsers').where('tokenHash', '==', hashSecret(token)).limit(1).get();
  if (snapshot.empty) throw Object.assign(new Error('Invalid session.'), { status: 401 });
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function requireAdmin(req) {
  const user = await requireUser(req);
  if (user.role !== 'admin') throw Object.assign(new Error('Admin access required.'), { status: 403 });
  return user;
}
