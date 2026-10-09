// Backups intentionally exclude an active countdown: importing must not start work.
export function backupFocus(state) {
  if (!state) return null;
  return { tasks: state.tasks, sessions: state.sessions, rewards: state.rewards, settings: state.settings, notes: typeof state.notes === 'string' ? state.notes : '' };
}
export function restoreFocus(saved, current) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return current;
  // Pre-notes backups must not silently erase a newer feature's local content.
  return { ...saved, notes: Object.prototype.hasOwnProperty.call(saved, 'notes') ? saved.notes : current?.notes || '' };
}
