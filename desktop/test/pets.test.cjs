const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = import('../../src/pet/pet-catalog.mjs');
const sprites = import('../../src/pet/pet-sprites.mjs');

test('five stable companion identities preserve legacy cat fallback', async () => {
  const { PETS, DEFAULT_PET_ID, normalizePetId, getPet } = await catalog;
  assert.equal(DEFAULT_PET_ID, 'cat');
  assert.deepEqual(PETS.map(p => p.id), ['cat', 'chick', 'bunny', 'bear', 'fox']);
  assert.equal(new Set(PETS.map(p => p.name)).size, 5);
  for (const bad of [undefined, null, '', 'dog', '__proto__', {}, 3]) {
    assert.equal(normalizePetId(bad), 'cat'); assert.equal(getPet(bad).id, 'cat');
  }
  assert.equal(getPet('chick').name, '蛋挞');
  assert.ok(Object.isFrozen(PETS));
});

test('every pet pose, frame and accessory is a valid nonempty 32px sprite', async () => {
  const { PETS } = await catalog;
  const { petFrame, PET_PALETTES, SIZE, POSES, ACCESSORIES } = await sprites;
  for (const { id } of PETS) for (const [pose, count] of Object.entries(POSES)) for (let i = 0; i < count; i++) for (const accessory of ACCESSORIES) {
    const frame = petFrame(id, pose, i, accessory);
    assert.equal(frame.length, SIZE, `${id}:${pose}:${i}:${accessory}`);
    assert.ok(frame.every(row => row.length === SIZE));
    assert.ok(frame.flat().every(pixel => Number.isInteger(pixel) && pixel >= 0 && pixel < PET_PALETTES[id].length));
    assert.ok(frame.flat().filter(Boolean).length > 100);
    assert.ok(frame.flat().includes(0), 'transparent background');
  }
});

test('species have genuinely different silhouettes, not palette swaps', async () => {
  const { PETS } = await catalog, { petFrame, POSES } = await sprites;
  for (const pose of Object.keys(POSES)) {
    const silhouettes = PETS.map(({ id }) => JSON.stringify(petFrame(id, pose, 0).map(row => row.map(Boolean))));
    assert.equal(new Set(silhouettes).size, PETS.length, pose);
  }
});

test('every species animates in every state and all accessories change its pixels', async () => {
  const { PETS } = await catalog, { petFrame, POSES, ACCESSORIES } = await sprites;
  for (const { id } of PETS) for (const [pose, count] of Object.entries(POSES)) {
    const frames = Array.from({ length: count }, (_, i) => JSON.stringify(petFrame(id, pose, i)));
    assert.ok(new Set(frames).size > 1, `${id}:${pose} should animate`);
    // Original cat intentionally removes a scarf while curled asleep.
    for (const acc of ACCESSORIES.slice(1)) if (!(id === 'cat' && pose === 'sleep' && acc === 'scarf')) {
      assert.notEqual(JSON.stringify(petFrame(id, pose, 0, acc)), frames[0], `${id}:${pose}:${acc}`);
    }
  }
});

test('cat pixels remain byte-for-byte backwards compatible', async () => {
  const { catFrame } = await import('../../src/pet/cat-sprites.mjs');
  const { petFrame, POSES, ACCESSORIES } = await sprites;
  for (const [pose, count] of Object.entries(POSES)) for (let i = 0; i < count; i++) for (const accessory of ACCESSORIES) {
    assert.deepEqual(petFrame('cat', pose, i, accessory), catFrame(pose, i, accessory));
  }
});

test('invalid render inputs normalize deterministically and reuse bounded cache entries', async () => {
  const { petFrame, cachedPetFrame, normalizeFrame } = await sprites;
  assert.deepEqual(petFrame('missing', 'missing', NaN, 'crown'), petFrame('cat', 'idle', 0));
  assert.deepEqual(normalizeFrame('__proto__', Infinity), { pose: 'idle', index: 0 });
  assert.deepEqual(normalizeFrame('walk', -1), { pose: 'walk', index: 1 });
  assert.equal(cachedPetFrame('chick', 'walk', 1, ''), cachedPetFrame('chick', 'walk', 2001, 'invalid'));
  assert.notEqual(cachedPetFrame('chick', 'walk', 1, ''), cachedPetFrame('bear', 'walk', 1, ''));
});

test('pixel hit testing follows each pet, pose and accessory exactly', async () => {
  const { PETS } = await catalog, { petFrame, petOpaqueAt, POSES, ACCESSORIES } = await sprites;
  for (const { id } of PETS) for (const pose of Object.keys(POSES)) for (const acc of ACCESSORIES) {
    const frame = petFrame(id, pose, 0, acc);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) assert.equal(petOpaqueAt(id, pose, 0, acc, (x + .5) / 32, (y + .5) / 32), Boolean(frame[y][x]), `${id}:${pose}:${x},${y}`);
    for (const [x, y] of [[-1, 0], [0, -1], [1, .5], [.5, 1], [NaN, 0], [0, Infinity]]) assert.equal(petOpaqueAt(id, pose, 0, acc, x, y), false);
  }
});

test('draw uses species-specific colors and transparent canvas clearing', async () => {
  const { drawPetFrame, petFrame, PET_PALETTES } = await sprites;
  const calls = [], colors = new Set();
  const ctx = { clearRect: (...args) => calls.push(args), fillRect: () => colors.add(ctx.fillStyle), fillStyle: '' };
  drawPetFrame(ctx, petFrame('chick'), 'chick', 2);
  assert.deepEqual(calls, [[0, 0, 64, 64]]); assert.ok(colors.has(PET_PALETTES.chick[2])); assert.ok(!colors.has(PET_PALETTES.cat[2]));
});

test('species-specific poke lines and random edge inputs remain safe', async () => {
  const { pokeLine } = await import('../../src/pet/pet-model.mjs');
  assert.match(pokeLine(() => 0, 'chick'), /啾/);
  assert.match(pokeLine(() => 0, 'cat'), /喵/);
  for (const value of [-10, 0, .99, 1, 2, NaN, Infinity]) assert.equal(typeof pokeLine(() => value, 'bunny'), 'string');
});

test('black cat skin changes only cat colors and preserves default orange drawing', async () => {
  const { drawPetFrame, petFrame } = await sprites;
  const { PALETTE, CAT_PALETTES } = await import('../../src/pet/cat-sprites.mjs');
  const draw = (id, skin) => {
    const calls = [], ctx = { clearRect() {}, fillRect: (...xy) => calls.push([ctx.fillStyle, ...xy]) };
    drawPetFrame(ctx, petFrame(id), id, 1, skin); return calls;
  };
  const orange = draw('cat');
  assert.deepEqual(draw('cat', 'orange'), orange); assert.deepEqual(draw('cat', 'invalid'), orange);
  assert.ok(orange.some(([color]) => color === PALETTE[2]));
  const black = draw('cat', 'black'); assert.notDeepEqual(black, orange);
  assert.deepEqual(black.map(([, ...xy]) => xy), orange.map(([, ...xy]) => xy));
  assert.ok(black.some(([color]) => color === CAT_PALETTES.black[2]));
  for (const id of ['chick', 'bunny', 'bear', 'fox']) assert.deepEqual(draw(id, 'black'), draw(id, 'orange'), id);
});
