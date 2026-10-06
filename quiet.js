// quiet.mjs (lift 2, ORDERS 4b HB1, PLAN lift 2, the Eno seat): a room that keeps going when you leave.
// After a minute with no input the table's light eases to an even, dim level, and the shelf's gifts drift through the
// plane on slow loops of unrelated lengths, so the street never plays the same hour twice. The street keeps feeling
// them by the same law; nothing here makes a sound. Any input ends it within one frame.
// Pure: no DOM, no three.js. Time in seconds.

export const QUIET = Object.freeze({
  idle: 60,            // OURS: a minute with no input
  ease: 5,             // OURS: the light eases over 5 s
  loops: [37, 53, 71], // OURS (PLAN lift 2): one loop per gift on the shelf; with only the cube at web weight, the cube takes 37
  dim: 0.55            // OURS (here): the even, dim level, as a share of the room's normal light
});

const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export function createQuiet(opts = {}) {
  const P = { ...QUIET, ...opts };
  let lastInput = null, active = false, since = null;
  const out = [];
  const emit = (now, type, data = {}) => { const e = { t: +now.toFixed(4), type, ...data }; out.push(e); return e; };
  return {
    // Any input: ends the quiet at once (the caller calls this from its input handlers, so the next frame is normal).
    input(now, kind = 'input') { if (active) { active = false; emit(now, 'unattendedEnd', { by: kind, after: +(now - since).toFixed(3) }); } lastInput = now; since = null; },
    // Each frame: returns {active, mix} where mix 0..1 is how far the light and the drift have eased in.
    step(now) {
      if (lastInput === null) lastInput = now;
      const idle = now - lastInput;
      if (!active && idle >= P.idle) { active = true; since = now; emit(now, 'unattendedStart', { idle: +idle.toFixed(3) }); }
      return { active, mix: active ? smooth((now - since) / P.ease) : 0, idle };
    },
    // The light: normal (1) eases to the even, dim level.
    light(mix) { return 1 + (P.dim - 1) * mix; },
    // Gift number g's height while unattended: from above the plane (top) down through it to the same depth below and
    // back, on its own loop; blended from the height it had (h) as the quiet eases in.
    height(g, h, top, now, mix) {
      if (!active || mix <= 0) return h;
      const L = P.loops[g % P.loops.length], s = now - since, drift = top * Math.cos(2 * Math.PI * s / L);
      return h + (drift - h) * mix;
    },
    // Test hook (labelled in LIFT.md wherever used): pretend the last input was `seconds` ago.
    backdate(now, seconds) { lastInput = now - seconds; },
    get active() { return active; },
    get events() { return out; }
  };
}
