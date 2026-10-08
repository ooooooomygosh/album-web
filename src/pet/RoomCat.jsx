import React, { useEffect, useRef, useState } from 'react';
import PixelCat from './PixelCat';
import { bubbleText, celebrateUntil, petPose, pokeLine } from './pet-model.mjs';

export function useClock(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), interval); return () => clearInterval(timer); }, [interval]);
  return now;
}
// Shared by the room, the wallpaper and the desktop pet: tracks celebration,
// pokes and song changes, and returns the current pose and bubble.
export function useCatBehaviour({ focus = {}, playing = false, track = '', lastActivity = 0 }) {
  const now = useClock(500), [celebrate, setCelebrate] = useState(0), [poke, setPoke] = useState({ text: '', at: 0 });
  const fish = useRef(focus.fish), song = useRef({ track, at: 0 });
  useEffect(() => { if (fish.current !== undefined && focus.fish > fish.current) setCelebrate(celebrateUntil(Date.now())); fish.current = focus.fish; }, [focus.fish]);
  if (track !== song.current.track) song.current = { track, at: track ? Date.now() : 0 };
  const hour = new Date(now).getHours(), remaining = focus.endsAt ? Math.max(0, focus.endsAt - now) : focus.remaining || 0;
  const pose = petPose({ playing, phase: focus.phase, paused: focus.paused, idleMs: lastActivity ? now - lastActivity : 0, hour, celebrateUntil: celebrate, now, poked: poke.at });
  const bubble = bubbleText({ phase: focus.phase, paused: focus.paused, remaining, track, trackChangedAt: song.current.at, poke: poke.text, pokedAt: poke.at, now, hour });
  return { pose, bubble, now, poke: () => setPoke({ text: pokeLine(), at: Date.now() }) };
}

export default function RoomCat({ focus, playing, track, reduceMotion, interactive = true, hidden = false }) {
  const [activity, setActivity] = useState(() => Date.now());
  useEffect(() => {
    if (!interactive) return;
    let last = 0; const mark = () => { const time = Date.now(); if (time - last > 5000) { last = time; setActivity(time); } };
    ['pointermove', 'keydown', 'wheel'].forEach((name) => window.addEventListener(name, mark, { passive: true }));
    return () => ['pointermove', 'keydown', 'wheel'].forEach((name) => window.removeEventListener(name, mark));
  }, [interactive]);
  const cat = useCatBehaviour({ focus, playing, track, lastActivity: interactive ? activity : 0 });
  if (hidden) return null;
  const body = <><PixelCat pose={cat.pose} accessory={focus?.accessory || ''} reduceMotion={reduceMotion} label={`像素小猫 · ${{ idle: '发呆', groove: '跟着音乐摇摆', celebrate: '庆祝', walk: '散步', sleep: '睡觉', focus: '陪你专注' }[cat.pose]}`}/>{cat.bubble && <span className="room-cat-bubble" role="status">{cat.bubble}</span>}</>;
  return interactive
    ? <button type="button" className="room-cat" aria-label="摸摸小猫" onClick={cat.poke}>{body}</button>
    : <div className="room-cat">{body}</div>;
}
