'use strict';
// Reads the display-only room and focus state that the cabin page exposes,
// for the wallpaper and the desktop pet.
const READ_SCRIPT = `(() => {
  const companion = window.albumCompanionSnapshot?.() || null;
  const room = window.albumRoomSnapshot?.() || null;
  return { room: room ? { ...room, focus: companion?.focus || null } : null,
    companion: companion ? { focus: companion.focus, playing: companion.playing, track: companion.track, reduceMotion: document.documentElement.dataset.desktopReduceMotion === 'true' } : null };
})()`;

async function readCompanion(site) {
  if (!site || site.isDestroyed()) return null;
  return site.executeJavaScript(READ_SCRIPT);
}

// Polls while at least one window listens and calls it only on change.
function createCompanionPoller({ getSite, clean, interval = 750, onValue }) {
  let timer = null, busy = false, last = '';
  async function poll() {
    if (busy) return; busy = true;
    try {
      const value = clean(await readCompanion(getSite()));
      const json = JSON.stringify(value);
      if (value && json !== last) { last = json; onValue(value); }
    } catch { /* A reload leaves the last valid state in place. */ }
    finally { busy = false; }
  }
  return {
    start() { if (!timer) { last = ''; timer = setInterval(poll, interval); poll(); } },
    stop() { clearInterval(timer); timer = null; last = ''; },
    poll
  };
}

// Sends a whitelisted command from a companion window to the business page.
const COMMANDS = new Set(['focus-start', 'focus-pause', 'focus-toggle', 'focus-skip', 'sound-toggle', 'play-toggle']);
function sendCompanionCommand(site, command) {
  if (!COMMANDS.has(command) || !site || site.isDestroyed()) return false;
  site.executeJavaScript(`window.dispatchEvent(new CustomEvent('album-companion-command', { detail: { command: ${JSON.stringify(command)} } }));`).catch(() => {});
  return true;
}
module.exports = { readCompanion, createCompanionPoller, sendCompanionCommand, COMMANDS };
