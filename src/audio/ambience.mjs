// Procedurally synthesised ambience. No recordings are bundled, so every
// sound is generated from noise with Web Audio filters and envelopes.
export const AMBIENCE_TRACKS = Object.freeze([
  { id: 'rain', name: '雨声' },
  { id: 'fire', name: '壁炉' },
  { id: 'wind', name: '风声' },
  { id: 'white', name: '白噪声' },
  { id: 'vinyl', name: '黑胶底噪' }
]);
export const SOUND_KEY = 'album-circle-sound-v1';
const level = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Math.round(Number(value) * 100) / 100)) : fallback;
export function normalizeMix(value = {}) {
  const v = value && typeof value === 'object' ? value : {}, tracks = v.tracks && typeof v.tracks === 'object' ? v.tracks : {};
  return {
    master: level(v.master, .8), lofi: level(v.lofi, .55), lofiOn: v.lofiOn === true,
    tracks: Object.fromEntries(AMBIENCE_TRACKS.map(({ id }) => [id, level(tracks[id], id === 'rain' ? .45 : 0)]))
  };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Fills `out` with noise of the requested colour. Pure, so it is testable.
export function fillNoise(out, colour, random = Math.random) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < out.length; i++) {
    const white = random() * 2 - 1;
    if (colour === 'pink') { // Paul Kellet's economy filter.
      b0 = .99886 * b0 + white * .0555179; b1 = .99332 * b1 + white * .0750759; b2 = .969 * b2 + white * .153852;
      b3 = .8665 * b3 + white * .3104856; b4 = .55 * b4 + white * .5329522; b5 = -.7616 * b5 - white * .016898;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * .5362) * .11; b6 = white * .115926;
    } else if (colour === 'brown') { last = (last + .02 * white) / 1.02; out[i] = last * 3.5; }
    else if (colour === 'crackle') out[i] = random() < .0006 ? (random() * 2 - 1) * .9 : random() < .004 ? (random() * 2 - 1) * .12 : 0;
    else out[i] = white;
  }
  return out;
}

function noiseSource(context, colour, seconds = 4) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  fillNoise(buffer.getChannelData(0), colour);
  const source = context.createBufferSource(); source.buffer = buffer; source.loop = true; return source;
}
function filter(context, type, frequency, q = .7) { const node = context.createBiquadFilter(); node.type = type; node.frequency.value = frequency; node.Q.value = q; return node; }
function lfo(context, frequency, depth, target) {
  const osc = context.createOscillator(), gain = context.createGain(); osc.frequency.value = frequency; gain.gain.value = depth;
  osc.connect(gain).connect(target); osc.start(); return osc;
}
// Short filtered noise bursts: rain drops and fire crackles.
function bursts(context, destination, { rate, frequency, spread, length, gain }) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * .08), context.sampleRate); fillNoise(buffer.getChannelData(0), 'white');
  let timer;
  const schedule = () => {
    const now = context.currentTime;
    for (let t = 0; t < .25; t += 1 / rate) {
      if (Math.random() > .6) continue;
      const at = now + t + Math.random() / rate, source = context.createBufferSource(), band = filter(context, 'bandpass', frequency * (1 - spread / 2 + Math.random() * spread), 4), env = context.createGain();
      source.buffer = buffer; env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(gain * (.3 + Math.random() * .7), at + .002); env.gain.exponentialRampToValueAtTime(.0001, at + length * (.5 + Math.random()));
      source.connect(band).connect(env).connect(destination); source.start(at); source.stop(at + .1);
    }
    timer = setTimeout(schedule, 250);
  };
  schedule();
  return { stop: () => clearTimeout(timer) };
}

const BUILDERS = {
  rain(context, out) {
    const bed = noiseSource(context, 'pink'), hp = filter(context, 'highpass', 500), lp = filter(context, 'lowpass', 7000), gain = context.createGain(); gain.gain.value = .9;
    bed.connect(hp).connect(lp).connect(gain).connect(out); bed.start();
    const drops = bursts(context, out, { rate: 40, frequency: 3200, spread: 1.2, length: .025, gain: .35 });
    return () => { bed.stop(); drops.stop(); };
  },
  fire(context, out) {
    const bed = noiseSource(context, 'brown'), lp = filter(context, 'lowpass', 420), gain = context.createGain(); gain.gain.value = .9;
    const flicker = lfo(context, .35, .25, gain.gain);
    bed.connect(lp).connect(gain).connect(out); bed.start();
    const crackles = bursts(context, out, { rate: 9, frequency: 2600, spread: 1.4, length: .012, gain: .9 });
    return () => { bed.stop(); flicker.stop(); crackles.stop(); };
  },
  wind(context, out) {
    const bed = noiseSource(context, 'brown', 6), band = filter(context, 'bandpass', 520, 1.4), gain = context.createGain(); gain.gain.value = .9;
    const sweep = lfo(context, .07, 320, band.frequency), gust = lfo(context, .11, .35, gain.gain);
    bed.connect(band).connect(gain).connect(out); bed.start();
    return () => { bed.stop(); sweep.stop(); gust.stop(); };
  },
  white(context, out) {
    const bed = noiseSource(context, 'white'), lp = filter(context, 'lowpass', 9000), gain = context.createGain(); gain.gain.value = .22;
    bed.connect(lp).connect(gain).connect(out); bed.start();
    return () => bed.stop();
  },
  vinyl(context, out) {
    const bed = noiseSource(context, 'crackle', 5), hp = filter(context, 'highpass', 900), hiss = noiseSource(context, 'pink'), hissGain = context.createGain(), gain = context.createGain();
    hissGain.gain.value = .035; gain.gain.value = 1.2;
    bed.connect(hp).connect(gain).connect(out); hiss.connect(filter(context, 'highpass', 3000)).connect(hissGain).connect(out); bed.start(); hiss.start();
    return () => { bed.stop(); hiss.stop(); };
  }
};

// One mixer: each track has its own gain and is built lazily on first use.
export function createAmbience(context, destination = context.destination) {
  const master = context.createGain(); master.gain.value = 1; master.connect(destination);
  const tracks = new Map();
  const ramp = (param, value) => { param.cancelScheduledValues(context.currentTime); param.setTargetAtTime(value, context.currentTime, .25); };
  function set(id, volume) {
    if (!BUILDERS[id]) return;
    let track = tracks.get(id);
    if (volume > 0 && !track) {
      const gain = context.createGain(); gain.gain.value = 0; gain.connect(master);
      track = { gain, stop: BUILDERS[id](context, gain) }; tracks.set(id, track);
    }
    if (!track) return;
    ramp(track.gain.gain, volume * volume); // Perceptual curve.
    if (volume <= 0) {
      clearTimeout(track.release);
      track.release = setTimeout(() => { if (tracks.get(id) === track && track.gain.gain.value < .002) { track.stop(); track.gain.disconnect(); tracks.delete(id); } }, 1500);
    } else clearTimeout(track.release);
  }
  return {
    set, master,
    setMaster: (value) => ramp(master.gain, value),
    active: () => [...tracks.keys()],
    stop() { for (const track of tracks.values()) { clearTimeout(track.release); track.stop(); track.gain.disconnect(); } tracks.clear(); master.disconnect(); }
  };
}
