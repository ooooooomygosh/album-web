import React, { useCallback, useEffect, useRef } from 'react';

export function preloadCoverImage(src, cache) {
  if (!src || typeof window === 'undefined') return Promise.resolve(false);
  if (cache.has(src)) return cache.get(src);
  const job = new Promise((resolve) => {
    const image = new Image();
    let finished = false;
    const finish = (ready) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      image.onload = image.onerror = null;
      if (!ready) image.src = '';
      resolve(ready);
    };
    const timeout = window.setTimeout(() => finish(false), 8000);
    image.decoding = 'async';
    image.onload = async () => {
      try { await image.decode?.(); finish(true); }
      catch { finish(false); }
    };
    image.onerror = () => finish(false);
    image.src = src;
  });
  cache.set(src, job);
  return job;
}

function coverUrl(value) {
  return value ? `url("${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}")` : 'none';
}

export default function CorridorBackground({ item, reducedMotion, imageCache }) {
  const layers = useRef([]);
  const state = useRef({ mounted: false, busy: false, pending: null, active: 0, key: '', animations: [], reducedMotion });
  state.current.reducedMotion = reducedMotion;

  // Finish each fade before reusing the hidden layer. During a fade, retain only
  // the newest decoded selection so repeated navigation cannot build a queue.
  const drain = useCallback(async () => {
    const current = state.current;
    if (current.busy || !current.mounted) return;
    current.busy = true;
    try {
      while (current.pending && current.mounted) {
        const next = current.pending;
        current.pending = null;
        if (next.key === current.key) continue;
        const incomingIndex = 1 - current.active;
        const incoming = layers.current[incomingIndex];
        const outgoing = layers.current[current.active];
        if (!incoming || !outgoing) break;
        incoming.style.setProperty('--background-cover', coverUrl(next.ready ? next.item.cover : ''));
        incoming.style.setProperty('--background-a', next.item.palette?.[0] || '#7ed7c9');
        incoming.style.setProperty('--background-b', next.item.palette?.[1] || '#ff7da8');
        incoming.dataset.albumId = next.item.id;
        incoming.dataset.imageReady = String(next.ready);
        incoming.style.opacity = '0';
        incoming.style.zIndex = '2';
        outgoing.style.zIndex = '1';
        if (!current.reducedMotion) {
          const options = { duration: 600, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'both' };
          // Keep the previous cover opaque underneath to avoid a dark flash.
          current.animations = [incoming.animate([{ opacity: 0 }, { opacity: 1 }], options)];
          await Promise.all(current.animations.map((animation) => animation.finished));
        }
        if (!current.mounted) break;
        incoming.style.opacity = '1';
        outgoing.style.opacity = '0';
        current.animations.forEach((animation) => animation.cancel());
        current.animations = [];
        outgoing.dataset.current = 'false';
        incoming.dataset.current = 'true';
        current.active = incomingIndex;
        current.key = next.key;
      }
    } catch {
      // Unmounting cancels animations and must not change detached layers.
    } finally {
      current.busy = false;
    }
  }, []);

  useEffect(() => {
    const current = state.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      current.pending = null;
      current.animations.forEach((animation) => animation.cancel());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const current = state.current;
    current.pending = null;
    if (reducedMotion) current.animations.forEach((animation) => animation.finish());
    preloadCoverImage(item.cover, imageCache).then((ready) => {
      if (cancelled || !current.mounted) return;
      current.pending = { item, ready, key: JSON.stringify([item.id, item.cover, item.palette]) };
      drain();
    });
    return () => { cancelled = true; };
  }, [item, imageCache, reducedMotion, drain]);

  return (
    <div className="corridor-background" aria-hidden="true">
      {[0, 1].map((index) => <div key={index} className="corridor-background-layer" ref={(node) => { layers.current[index] = node; }} />)}
    </div>
  );
}
