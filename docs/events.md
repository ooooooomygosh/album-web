# 小屋全局事件 · Cabin events

Window-level `CustomEvent`s that let parts of the cabin react to each other without importing one another. All are read-only signals: listening never changes playback.

## `cabin:playback`

Dispatched on `window` by the music player (`src/player/usePlayer.jsx` → `usePlaybackBroadcast`).

```js
window.addEventListener('cabin:playback', (event) => {
  const { playing, energy } = event.detail;
  turntable.dataset.playing = String(playing);
  pet.style.setProperty('--groove', energy.toFixed(3)); // 0..1
});
```

| field | type | meaning |
| --- | --- | --- |
| `playing` | `boolean` | Real audio is playing (local files, QQ, 网易云, Music Assistant, or the system player). **`false` in 仅动画展示 mode**, even if the record spins. |
| `energy` | `number` 0..1 | Loudness. RMS of an `AnalyserNode` on the deck's `<audio>`, with a fast attack and slower release. Always `0` when not playing. |
| `estimated` | `boolean` | `true` when no analyser can be attached (Music Assistant speakers, system player, or audio that is not same-origin). `energy` is then a gentle synthetic pulse; don't treat it as a beat. |
| `spinning` | `boolean` | The record is turning on the deck, including 仅动画展示 mode. Use this for platter and tonearm motion, and `playing` for anything that implies sound. |
| `provider` | `string` | `visual`, `auto`, `local`, `qq`, `netease`, `ma` or `system`. |
| `track` | `object \| null` | `{ id, index, title, artist, album }`. `id` is the collection item id. `null` when the deck is empty. |
| `reason` | `string` | `state` (play/pause/source/spin changed), `track` (track or record changed), or `energy` (periodic tick). |

### Timing

- `state` and `track` events are sent **immediately**.
- `energy` ticks are throttled to about **15 fps** (≥ 66 ms apart), only while `playing`, and are skipped when the value barely changes.
- When playback stops, one final event carries `playing: false, energy: 0`. Nothing is sent while paused.
- There is no replay for late listeners. Treat "no event yet" as `{ playing: false, energy: 0 }`.

### Notes for listeners

- Keep handlers cheap. Write a CSS variable or a ref, and let CSS or your own `requestAnimationFrame` do the drawing.
- Respect reduced motion (`[data-desktop-reduce-motion=true]` / `prefers-reduced-motion`). The event still fires, but motion should stay subtle.
- The analyser is attached during the first user-started play and only when the context is running. Audio never goes silent because of it.

### In the desktop pet window

The pet runs in its own Electron window (`pet.html`), so it never sees the main page's `window` events. The music state travels with the companion snapshot instead:

1. `src/CompanionBridge.jsx` listens to `cabin:playback` and adds `musicPlaying`, `energy` (rounded to 0.05) and `energyEstimated` to `albumCompanionSnapshot()`.
2. `desktop/companion-sync.cjs` reads the snapshot. `desktop/wallpaper-model.cjs` `cleanCompanion` whitelists and clamps it (`energy` 0..1, 2 decimals, forced to 0 when nothing is playing). `desktop/pet.cjs` polls about every **125 ms (~8 Hz) while `musicPlaying` is true** and every 750 ms otherwise, and only sends `pet:update` when the cleaned value changed.
3. `src/pet/pet-snapshot.mjs` re-dispatches `cabin:playback` on the pet window with `{ playing, energy, estimated, source: 'companion', reason: 'companion' }`, and only when the values change.

Pet code listens the same way in both windows (`onCabinPlayback` in `src/scene/playback-listener.mjs`). In the pet window the signal is coarser: about 8 Hz, with 0.05 energy steps and roughly 125 ms of extra latency. That is enough for sway or bob, but not for beat-accurate motion. The existing `playing` field in the snapshot still means "grooving" (real audio, spinning, or lo-fi). Use `musicPlaying` / the event's `playing` for real audio only.

## Other player events (existing)

| event | direction | detail |
| --- | --- | --- |
| `cabin-play` | → player | `{ id, track }` put an album on the deck, optionally starting at a track (used by the album card). |
| `cabin-open-music-settings` | → cabin | no detail. Opens 音源与账户 (used by the player's error card). |
| `album-quick-search` | → app | `{ query }` opens 添加专辑 with a catalog search. |
| `album-music-account` / `album-music-settings` | desktop → page | Sign-in or source settings changed. The player re-resolves the current track. |
