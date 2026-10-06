// colour.mjs (lift 3, ORDERS 4b HB1): colour with a history. The magenta gift is the only colour in the city (the
// book's colour chapters, s.8 to 10). A citizen whose outline the magenta slice passes within 1 size keeps a faint
// magenta tint, at most a 25% mix, fading over 4 s. Light only: no sound, no cue, so the voice law stands.
// Pure: no DOM, no three.js. Distances in sizes, time in seconds.

export const COLOUR = Object.freeze({
  reach: 1,   // OURS: the slice passes within 1 size of the citizen's outline
  mix: 0.25,  // OURS: at most a 25% mix toward the gift's colour
  fade: 4     // OURS: the trace fades over 4 s
});

export function createColour(count, opts = {}) {
  const P = { ...COLOUR, ...opts };
  const tint = new Float64Array(count);
  let last = null, touched = 0;
  return {
    // gaps[i] = distance from citizen i's own outline to the slice's outline, in sizes (Infinity when there is no slice).
    // Returns the mix (0..P.mix) for each citizen.
    step(now, gaps) {
      const dt = last === null ? 0 : Math.max(0, Math.min(0.25, now - last)); last = now;
      for (let i = 0; i < count; i++) {
        if (gaps[i] <= P.reach) { if (tint[i] < 1) touched++; tint[i] = 1; }
        else tint[i] = Math.max(0, tint[i] - dt / P.fade);
      }
      return Array.from(tint, v => v * P.mix);
    },
    get traced() { let n = 0; for (const v of tint) if (v > 0) n++; return n; },
    get passes() { return touched; }
  };
}

// Mix two #rrggbb colours (a toward b by m), for tests and for pages without three.js.
export function mixHex(a, b, m) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * m).toString(16).padStart(2, '0')).join('');
}
