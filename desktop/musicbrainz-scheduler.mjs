// MusicBrainz asks each client to issue at most one request per second.
// Share one scheduler across searches and detail lookups in this process.
export function createMusicBrainzScheduler({ intervalMs = 1100, maxQueued = 64, now = () => performance.now(), setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id) } = {}) {
  const queue = [];
  let nextStart = 0;
  let timer;
  function pump() {
    if (timer !== undefined) { clearTimer(timer); timer = undefined; }
    if (!queue.length) return;
    const delay = Math.max(0, nextStart - now());
    if (delay > 0) { timer = setTimer(pump, delay); return; }
    const item = queue.shift();
    item.signal?.removeEventListener('abort', item.abort);
    if (item.signal?.aborted) { item.reject(item.signal.reason); pump(); return; }
    nextStart = now() + intervalMs;
    // Do not wait for a slow response before scheduling the next start.
    try { Promise.resolve(item.work()).then(item.resolve, item.reject); }
    catch (error) { item.reject(error); }
    pump();
  }
  return function schedule(work, signal) {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (queue.length >= maxQueued) return Promise.reject(new Error('MusicBrainz request queue is full'));
    return new Promise((resolve, reject) => {
      const item = { work, signal, resolve, reject };
      item.abort = () => {
        const index = queue.indexOf(item);
        if (index >= 0) queue.splice(index, 1);
        signal.removeEventListener('abort', item.abort);
        reject(signal.reason);
        pump();
      };
      signal?.addEventListener('abort', item.abort, { once: true });
      queue.push(item);
      pump();
    });
  };
}

export const scheduleMusicBrainz = createMusicBrainzScheduler();
