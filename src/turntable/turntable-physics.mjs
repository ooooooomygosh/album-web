// Physics of the close-up turntable. A real deck does not start or stop
// instantly: the platter spins up in about half a second and coasts down
// for longer; the tonearm lifts, swings, then lowers onto the groove, and
// the needle drifts inwards as the side plays. Pure and time-stepped so it
// is testable; the canvas only reads the state.
export const GEOMETRY = Object.freeze({
  width: 240, height: 150,
  center: Object.freeze([82, 75]),
  platterRadius: 64, recordRadius: 58, labelRadius: 18,
  outerGroove: 55, innerGroove: 23,
  pivot: Object.freeze([200, 30]), armLength: 112
});
export const RPM = Object.freeze({ 33: 100 / 3, 45: 45 });
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Arm angle (radians, canvas coordinates) that puts the stylus on radius r.
export function grooveAngle(radius, geometry = GEOMETRY) {
  const [px, py] = geometry.pivot, [cx, cy] = geometry.center, L = geometry.armLength;
  const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
  const k = (radius * radius - d * d - L * L) / (2 * L);
  const phi = Math.atan2(dy, dx), spread = Math.acos(clamp(k / d, -1, 1));
  // Two solutions; the arm reaches the record from the pivot's lower-left.
  return phi + spread;
}
export function stylusPoint(angle, geometry = GEOMETRY) {
  return [geometry.pivot[0] + Math.cos(angle) * geometry.armLength, geometry.pivot[1] + Math.sin(angle) * geometry.armLength];
}
// At rest the arm lies along the plinth's right edge, clear of the platter.
export const REST_ANGLE = 1.78;
export const progressAngle = (progress, geometry = GEOMETRY) => grooveAngle(geometry.outerGroove - clamp(progress, 0, 1) * (geometry.outerGroove - geometry.innerGroove), geometry);
// Pointer → progress along the side (for dragging the arm to seek).
export function progressFromPoint([x, y], geometry = GEOMETRY) {
  const [cx, cy] = geometry.center, r = Math.hypot(x - cx, y - cy);
  return clamp((geometry.outerGroove - r) / (geometry.outerGroove - geometry.innerGroove), 0, 1);
}
// Time on the side → radius: track gaps are drawn where one song ends.
export function sideProgress(durations, trackIndex, position = 0) {
  const lengths = durations.map((value) => Math.max(0, Number(value) || 0));
  const known = lengths.every((value) => value > 0) && lengths.length > 0;
  const list = known ? lengths : lengths.map(() => 1);
  const total = list.reduce((sum, value) => sum + value, 0) || 1;
  const before = list.slice(0, trackIndex).reduce((sum, value) => sum + value, 0);
  const current = list[trackIndex] || 0;
  const within = known ? clamp(position * 1000, 0, current) : clamp(position / 240, 0, 1) * current;
  return { progress: clamp((before + within) / total, 0, 1), gaps: list.slice(0, -1).map((_, index) => list.slice(0, index + 1).reduce((sum, value) => sum + value, 0) / total) };
}
// Progress → which track and how far into it, for seeking by needle.
export function seekTarget(durations, progress) {
  const lengths = durations.map((value) => Math.max(0, Number(value) || 0));
  const known = lengths.length > 0 && lengths.every((value) => value > 0);
  const list = known ? lengths : lengths.map(() => 1);
  const total = list.reduce((sum, value) => sum + value, 0);
  if (!total) return { trackIndex: 0, seconds: 0 };
  let at = clamp(progress, 0, .9999) * total;
  for (let index = 0; index < list.length; index++) {
    if (at < list[index]) return { trackIndex: index, seconds: known ? at / 1000 : 0 };
    at -= list[index];
  }
  return { trackIndex: list.length - 1, seconds: 0 };
}

export function createDeckPhysics({ speed = 33 } = {}) {
  const state = { angle: 0, omega: 0, arm: REST_ANGLE, lift: 1, speed, cue: 'rest' };
  return {
    state,
    setSpeed(value) { state.speed = RPM[value] ? value : 33; },
    // motor: platter driven; target: where the arm should be (null = rest); lowered: needle down.
    step(dt, { motor = false, armTarget = null, lowered = false, dragging = false } = {}) {
      const step = clamp(dt, 0, .1);
      const goal = motor ? RPM[state.speed] / 60 * TAU : 0;
      const tau = motor ? .45 : 1.35; // spin up quickly, coast down slowly
      state.omega += (goal - state.omega) * (1 - Math.exp(-step / tau));
      if (!motor && state.omega < .01) state.omega = 0;
      state.angle = (state.angle + state.omega * step) % TAU;
      const target = armTarget ?? REST_ANGLE;
      const distance = target - state.arm;
      // Lift before moving anywhere, lower only once the arm has arrived.
      const travelling = Math.abs(distance) > .004 && !dragging;
      const wantLift = travelling || !lowered || dragging ? 1 : 0;
      state.lift += clamp(wantLift - state.lift, -step / .35, step / .18);
      if (dragging) state.arm = target;
      else if (state.lift > .85 || !travelling) {
        // While lowered, the groove carries the arm (small steps only).
        const rate = state.lift > .85 ? 1.6 : .25;
        state.arm += clamp(distance, -rate * step, rate * step);
      }
      state.cue = state.lift > .95 ? (Math.abs(state.arm - REST_ANGLE) < .01 ? 'rest' : 'lifted') : state.lift < .05 ? 'playing' : 'moving';
      return state;
    }
  };
}
