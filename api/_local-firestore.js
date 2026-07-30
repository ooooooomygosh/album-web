import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const collections = new Map();
const storeFile = process.env.ALBUM_CIRCLE_LOCAL_FIRESTORE_FILE || path.join(process.cwd(), 'tmp', 'local-firestore.json');
let loadedMtime = 0;

function loadCollections() {
  try {
    const stat = fs.statSync(storeFile);
    if (stat.mtimeMs <= loadedMtime) return;
    const raw = JSON.parse(fs.readFileSync(storeFile, 'utf8') || '{}');
    collections.clear();
    Object.entries(raw.collections || {}).forEach(([key, entries]) => {
      collections.set(key, new Map(entries));
    });
    loadedMtime = stat.mtimeMs;
  } catch {
    if (!loadedMtime) collections.clear();
  }
}

function saveCollections() {
  fs.mkdirSync(path.dirname(storeFile), { recursive: true });
  const payload = {
    collections: Object.fromEntries([...collections.entries()].map(([key, map]) => [key, [...map.entries()]]))
  };
  fs.writeFileSync(storeFile, JSON.stringify(payload, null, 2));
  loadedMtime = fs.statSync(storeFile).mtimeMs;
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function collectionMap(path) {
  loadCollections();
  const key = path.join('/');
  if (!collections.has(key)) collections.set(key, new Map());
  return collections.get(key);
}

function splitPath(path) {
  return String(path || '').split('.').filter(Boolean);
}

function getPath(target, path) {
  return splitPath(path).reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), target);
}

function setPath(target, path, value) {
  const parts = splitPath(path);
  let node = target;
  parts.slice(0, -1).forEach((part) => {
    if (!node[part] || typeof node[part] !== 'object' || Array.isArray(node[part])) node[part] = {};
    node = node[part];
  });
  node[parts.at(-1)] = value;
}

function applyValue(current, value) {
  const type = value?.constructor?.name || '';
  if (type === 'ServerTimestampTransform') return Date.now();
  if (type === 'ArrayUnionTransform') {
    const base = Array.isArray(current) ? current : [];
    const next = [...base];
    value.elements.forEach((item) => {
      if (!next.some((existing) => JSON.stringify(existing) === JSON.stringify(item))) next.push(item);
    });
    return next;
  }
  if (type === 'NumericIncrementTransform') {
    const number = Number(current || 0);
    return number + Number(value.operand || 0);
  }
  return clone(value);
}

function applyPatch(target, patch) {
  Object.entries(patch || {}).forEach(([key, value]) => {
    setPath(target, key, applyValue(getPath(target, key), value));
  });
  return target;
}

function docSnapshot(ref, data) {
  return {
    id: ref.id,
    ref,
    exists: Boolean(data),
    data: () => clone(data)
  };
}

function querySnapshot(docs) {
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length
  };
}

class LocalDocumentReference {
  constructor(path, id) {
    this.path = path;
    this.id = id;
  }

  collection(name) {
    return new LocalCollectionReference([...this.path, this.id, name]);
  }

  async get() {
    return docSnapshot(this, collectionMap(this.path).get(this.id));
  }

  async set(data, options = {}) {
    const map = collectionMap(this.path);
    const current = options.merge ? clone(map.get(this.id) || {}) : {};
    map.set(this.id, applyPatch(current, data));
    saveCollections();
  }

  async update(data) {
    const map = collectionMap(this.path);
    if (!map.has(this.id)) throw Object.assign(new Error('Document not found.'), { status: 404 });
    map.set(this.id, applyPatch(clone(map.get(this.id)), data));
    saveCollections();
  }

  async delete() {
    collectionMap(this.path).delete(this.id);
    saveCollections();
  }
}

class LocalQuery {
  constructor(path, filters = [], sort = null, count = 0) {
    this.path = path;
    this.filters = filters;
    this.sort = sort;
    this.count = count;
  }

  where(field, operator, expected) {
    return new LocalQuery(this.path, [...this.filters, { field, operator, expected }], this.sort, this.count);
  }

  orderBy(field, direction = 'asc') {
    return new LocalQuery(this.path, this.filters, { field, direction }, this.count);
  }

  limit(count) {
    return new LocalQuery(this.path, this.filters, this.sort, Number(count) || 0);
  }

  async get() {
    let docs = [...collectionMap(this.path).entries()]
      .map(([id, data]) => docSnapshot(new LocalDocumentReference(this.path, id), data))
      .filter((doc) => this.filters.every((filter) => matchesFilter(doc.data(), filter)));
    if (this.sort) {
      const direction = this.sort.direction === 'desc' ? -1 : 1;
      docs = docs.sort((a, b) => {
        const left = getPath(a.data(), this.sort.field) || 0;
        const right = getPath(b.data(), this.sort.field) || 0;
        return left > right ? direction : left < right ? -direction : 0;
      });
    }
    if (this.count) docs = docs.slice(0, this.count);
    return querySnapshot(docs);
  }
}

function matchesFilter(data, filter) {
  const actual = getPath(data, filter.field);
  if (filter.operator === '==') return actual === filter.expected;
  if (filter.operator === 'array-contains') return Array.isArray(actual) && actual.includes(filter.expected);
  return false;
}

class LocalCollectionReference extends LocalQuery {
  constructor(path) {
    super(path);
    this.id = path.at(-1);
  }

  doc(id) {
    return new LocalDocumentReference(this.path, String(id || crypto.randomUUID()));
  }

  async add(data) {
    const ref = this.doc(crypto.randomUUID().replace(/-/g, '').slice(0, 20));
    await ref.set(data);
    return ref;
  }
}

class LocalBatch {
  constructor() {
    this.operations = [];
  }

  update(ref, data) {
    this.operations.push(() => ref.update(data));
    return this;
  }

  delete(ref) {
    this.operations.push(() => ref.delete());
    return this;
  }

  async commit() {
    for (const operation of this.operations) await operation();
  }
}

export function localDb() {
  return {
    collection(name) {
      return new LocalCollectionReference([name]);
    },
    batch() {
      return new LocalBatch();
    }
  };
}
