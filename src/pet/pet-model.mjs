// What the cat is doing, derived from the room's state. Pure and testable.
import { POSES } from './cat-sprites.mjs';

export const FPS = Object.freeze({ idle: 2, groove: 4, celebrate: 6, walk: 4, sleep: 1, focus: 1.5 });
const IDLE_SLEEP_MS = 5 * 60 * 1000, CELEBRATE_MS = 4000;
export const isNight = (hour) => hour >= 23 || hour < 6;

export function petPose({ playing = false, phase = 'idle', paused = false, idleMs = 0, hour = 12, celebrateUntil = 0, now = 0, poked = 0 } = {}) {
  if (now < celebrateUntil) return 'celebrate';
  if (poked && now - poked < 1500) return 'celebrate';
  if (phase === 'focus' && !paused) return 'focus';
  if (playing) return 'groove';
  if (phase === 'shortBreak' || phase === 'longBreak') return 'walk';
  if (isNight(hour) || idleMs > IDLE_SLEEP_MS) return 'sleep';
  return 'idle';
}
export function frameAt(pose, timeMs) {
  const count = POSES[pose] || 1, fps = FPS[pose] || 2;
  return Math.floor(timeMs / 1000 * fps) % count;
}
export function celebrateUntil(now) { return now + CELEBRATE_MS; }

const POKE_LINES = ['喵～', '今天也辛苦啦', '摸摸头 (=^･ω･^=)', '要不要放张唱片？', '喝口水再继续吧', '咕噜咕噜…', '我在陪你哦'];
export function pokeLine(random = Math.random) { return POKE_LINES[Math.floor(random() * POKE_LINES.length)]; }

// The speech bubble: focus countdown first, then a new song, then pokes.
export function bubbleText({ phase = 'idle', paused = false, remaining = 0, track = '', trackChangedAt = 0, poke = '', pokedAt = 0, now = 0, hour = 12 } = {}) {
  if (poke && now - pokedAt < 3000) return poke;
  if (phase === 'focus' && !paused) { const m = Math.ceil(remaining / 60000); return m > 1 ? `专注中 · 还剩 ${m} 分钟` : '最后冲刺！'; }
  if (phase === 'focus' && paused) return '专注暂停中';
  if (phase === 'shortBreak' || phase === 'longBreak') return `休息一下 · ${Math.ceil(remaining / 60000)} 分钟`;
  if (track && now - trackChangedAt < 6000) return `♪ ${track}`;
  if (isNight(hour)) return '';
  return '';
}
