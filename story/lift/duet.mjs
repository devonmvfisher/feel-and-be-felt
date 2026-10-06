// duet.mjs (lift 1, ORDERS 4b HB1): you call from inside your gift, the smallest one near you sings your shape back
// wrong, its guess is drawn beside your belt, and when your held slice meets it the street holds one chord.
// Pure: no DOM, no three.js, no audio. Time comes in as seconds; shapes come in as plain arrays (the shared shapes:
// a slice's felt corners [{x,z,angle}], its centre [x,z], citizens [{sides,size,pos:[x,z],d}]).
// Built from the book's Lineland voices fitting (s.13) and PLAN lift 1; nothing from any other work.

// Design numbers. OURS = untested design numbers from ORDERS 4b; TUNED = changed once here, recorded in LIFT.md.
export const DUET = Object.freeze({
  reach: 12,          // OURS: the answering figure stands within 12 sizes of your outline
  minSides: 3,        // ORDERS: the figure has 3 or more sides
  tolDeg: 6,          // the slice law's own tolerance: the fit needs every angle within 6 degrees
  tieDeg: 6,          // OURS (here): corners within the same 6 degrees of the sharpest count as equally sharp
  fadeSeconds: 8,     // OURS: the guess fades over 8 s unless you call again
  floor: 1 / 3,       // Victor's condition: never below a third of full brightness while the duet lives
  giveUp: 20,         // ORDERS: no fit in 20 s and the figure stops calling
  chordSeconds: 4,    // OURS: one held chord, one breath
  glide: 0.06,        // ORDERS: voices glide in 60 ms
  singEvery: 4,       // OURS (here): the figure sings again every 4 whole seconds until it fits or gives up
  singSeconds: 1.2,   // OURS (here): one sung phrase lasts 1.2 s
  holdFrames: 3,      // the slice law's 3-frame hold, applied to the fit
  inset: 0.88,        // OURS (here): the guess is drawn at 88% of your slice's size so the two outlines stay separate
  flashSeconds: 0.35, // OURS (here): the two outlines flash once
  mergeSeconds: 0.8   // OURS (here): then the guess slides onto your outline and they become one
});

const TAU = 2 * Math.PI;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// Interior angles (degrees) of a simple polygon given in order.
export function polygonAngles(pts) {
  const n = pts.length; if (n < 3) return [];
  let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const o = Math.sign(area) || 1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], c = pts[(i + 1) % n];
    const turn = wrap(Math.atan2(c[1] - p[1], c[0] - p[0]) - Math.atan2(p[1] - a[1], p[0] - a[0]));
    return 180 - turn * o * 180 / Math.PI;
  });
}

// Your slice cut down to the figure's own corner count k, keeping your sharpest corners. Corners within tieDeg of the
// sharpest count as equally sharp; among equals the figure keeps the most evenly spread set (by order round the loop).
// Returns the kept corner indices in loop order, or null when no smaller guess exists.
export function pickCorners(corners, k, tieDeg = DUET.tieDeg) {
  const n = corners.length; if (n < 4 || k < 3 || k >= n) return null;
  const order = corners.map((c, i) => [c.angle, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const kept = new Set();
  while (kept.size < k) {
    const left = order.filter(([, i]) => !kept.has(i)); const sharp = left[0][0];
    const tie = left.filter(([a]) => a <= sharp + tieDeg).map(([, i]) => i).sort((a, b) => a - b);
    const need = k - kept.size;
    if (tie.length <= need) { for (const i of tie) kept.add(i); continue; }
    // evenly spread choice among the tie group: try every starting point, keep the set with the widest smallest gap
    let best = null, bestGap = -1;
    for (let s = 0; s < tie.length; s++) {
      const pick = Array.from({ length: need }, (_, j) => tie[(s + Math.floor(j * tie.length / need)) % tie.length]);
      const all = [...kept, ...pick].sort((a, b) => a - b);
      let gap = Infinity; for (let j = 0; j < all.length; j++) { const g = ((all[(j + 1) % all.length] - all[j]) + n) % n || n; gap = Math.min(gap, g); }
      if (gap > bestGap) { bestGap = gap; best = pick; }
    }
    for (const i of best) kept.add(i);
  }
  return [...kept].sort((a, b) => a - b);
}

// The guess: the kept corners as an outline, drawn at your slice's centre, at `inset` of your slice's size.
export function makeGuess(corners, center, k, { inset = DUET.inset, tieDeg = DUET.tieDeg } = {}) {
  const idx = pickCorners(corners, k, tieDeg); if (!idx) return null;
  const raw = idx.map(i => [corners[i].x, corners[i].z]);
  const pts = raw.map(([x, z]) => [center[0] + (x - center[0]) * inset, center[1] + (z - center[1]) * inset]);
  return { k, idx, raw, pts, angles: polygonAngles(raw) };
}

// Does a held slice fit the guess? Same corner count and every angle within tolDeg, after the best cyclic alignment
// (either direction round the loop). Returns the worst angle error in degrees, or Infinity.
export function fitError(angles, guessAngles) {
  const n = angles.length; if (n !== guessAngles.length || n < 3) return Infinity;
  let best = Infinity;
  for (const dir of [1, -1]) for (let r = 0; r < n; r++) {
    let worst = 0; for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(angles[(r + dir * i + n * 2) % n] - guessAngles[i]));
    best = Math.min(best, worst);
  }
  return best;
}

// Pair the guess's corners with a fit outline's corners one to one, keeping loop order (either direction), with the
// least total travel, so the merge never folds two corners onto one.
export function pairCorners(pts, corners) {
  const n = pts.length; if (corners.length !== n) return pts.map((_, i) => i % Math.max(1, corners.length));
  let best = null, bestD = Infinity;
  for (const dir of [1, -1]) for (let r = 0; r < n; r++) {
    const map = pts.map((_, i) => ((r + dir * i) % n + n) % n);
    const d = map.reduce((acc, j, i) => acc + Math.hypot(corners[j][0] - pts[i][0], corners[j][1] - pts[i][1]), 0);
    if (d < bestD) { bestD = d; best = map; }
  }
  return best;
}

// Who answers: the smallest citizen within reach with 3 or more sides; ties go to fewer sides, then the nearest.
export function pickFigure(citizens, { reach = DUET.reach, minSides = DUET.minSides } = {}) {
  let best = -1;
  citizens.forEach((c, i) => {
    if (!(c.sides >= minSides) || !(c.d <= reach * (c.size || 1))) return;
    if (best < 0) { best = i; return; }
    const b = citizens[best];
    if (c.size < b.size || (c.size === b.size && (c.sides < b.sides || (c.sides === b.sides && c.d < b.d)))) best = i;
  });
  return best;
}

// The duet as a small state machine. call(now, view) and step(now, view) return events; draw(now) says what to show;
// voice(i, now) says how citizen i's voice is bent (null = leave it alone).
export function createDuet(opts = {}) {
  const P = { ...DUET, ...opts };
  let s = null;   // the live duet, or null
  const out = [];
  const emit = (now, type, data = {}) => { const e = { t: +now.toFixed(4), type, ...data }; out.push(e); return e; };

  function call(now, view) {
    const ev = [];
    ev.push(emit(now, 'playerCall', { corners: view.corners.length }));
    if (s && s.phase === 'chord') return ev;   // one duet at a time; a call during the chord changes nothing
    const answerAt = Math.ceil(now + 1 - 1e-9);   // one beat later, on the whole-second clock
    if (s && s.phase === 'singing') { s.lastCall = now; s.recallAt = answerAt; return ev; }
    s = { phase: 'waiting', callAt: now, answerAt, lastCall: now, figure: -1, guess: null, fitRun: 0 };
    return ev;
  }

  function step(now, view) {
    const ev = [];
    if (!s) return ev;
    if (s.phase === 'waiting' && now >= s.answerAt) {
      const fig = pickFigure(view.citizens, P);
      const k = fig >= 0 ? Math.min(view.citizens[fig].sides, view.corners.length - 1) : 0;
      const guess = fig >= 0 ? makeGuess(view.corners, view.center, k, P) : null;
      if (!guess) { ev.push(emit(now, 'noAnswer', { corners: view.corners.length, figure: fig })); s = null; return ev; }
      Object.assign(s, { phase: 'singing', figure: fig, guess, singStart: s.answerAt, lastSing: s.answerAt, nextSing: s.answerAt, stopPos: view.citizens[fig].pos.slice() });
      ev.push(emit(now, 'figureAnswer', { at: s.answerAt, figure: fig, figureSides: view.citizens[fig].sides, k, sliceCorners: view.corners.length, guessAngles: guess.angles.map(a => +a.toFixed(1)), sliceAngles: view.corners.map(c => +c.angle.toFixed(1)) }));
    }
    if (s.phase === 'singing') {
      if (s.recallAt !== undefined && now >= s.recallAt) {   // you called again: the guess is sung again from your slice now
        const k = Math.min(view.citizens[s.figure].sides, view.corners.length - 1), g = makeGuess(view.corners, view.center, k, P);
        if (g) s.guess = g; s.lastSing = s.recallAt; s.nextSing = s.recallAt; s.singStart = s.recallAt; delete s.recallAt;
        ev.push(emit(now, 'figureAnswer', { figure: s.figure, k: s.guess.k, again: true, guessAngles: s.guess.angles.map(a => +a.toFixed(1)) }));
      }
      if (now >= s.nextSing) { ev.push(emit(now, 'figureSing', { figure: s.figure, k: s.guess.k })); s.singing = [s.nextSing, s.nextSing + P.singSeconds]; s.nextSing += P.singEvery; }
      const err = view.corners.length === s.guess.k ? fitError(view.corners.map(c => c.angle), s.guess.angles) : Infinity;
      s.fitRun = err <= P.tolDeg ? s.fitRun + 1 : 0;
      if (s.fitRun >= P.holdFrames) {
        s.phase = 'chord'; s.fitAt = now; s.fitCorners = view.corners.map(c => [c.x, c.z]); s.fitCenter = view.center.slice();
        ev.push(emit(now, 'fit', { figure: s.figure, k: s.guess.k, worstDeg: +err.toFixed(2), sliceAngles: view.corners.map(c => +c.angle.toFixed(1)) }));
        ev.push(emit(now, 'heraldQuiet', { k: s.guess.k }));
        ev.push(emit(now, 'chordStart', { k: s.guess.k, seconds: P.chordSeconds }));
      } else if (now - s.singStart >= P.giveUp) { ev.push(emit(now, 'duetEnd', { why: 'no fit in ' + P.giveUp + ' s', figure: s.figure })); s = null; return ev; }
    }
    if (s && s.phase === 'chord' && now >= s.fitAt + P.chordSeconds) { ev.push(emit(now, 'chordEnd', { k: s.guess.k })); ev.push(emit(now, 'duetEnd', { why: 'fit', figure: s.figure })); s = null; }
    return ev;
  }

  // What to draw: the guess outline (points, brightness 0..1, flash 0..1) and the belt flash. Brightness never falls
  // below the floor while the duet lives; after the fit the guess slides onto your outline (merge 0..1).
  function draw(now) {
    if (!s || !s.guess || s.phase === 'waiting') return null;
    if (s.phase === 'singing') {
      const age = Math.max(0, now - Math.max(s.lastSing, s.lastCall));
      return { pts: s.guess.pts, k: s.guess.k, figure: s.figure, brightness: Math.max(P.floor, 1 - (1 - P.floor) * Math.min(1, age / P.fadeSeconds)), flash: 0, merge: 0 };
    }
    const a = now - s.fitAt, flash = a < P.flashSeconds ? 1 - a / P.flashSeconds : 0, m = Math.min(1, Math.max(0, (a - P.flashSeconds) / P.mergeSeconds));
    // slide each guess corner onto its partner on your outline at the moment of the fit (one partner each, in loop order)
    const map = s.fitMap ?? (s.fitMap = pairCorners(s.guess.pts, s.fitCorners));
    const pts = s.guess.pts.map((p, i) => { const q = s.fitCorners[map[i]]; return [p[0] + (q[0] - p[0]) * m, p[1] + (q[1] - p[1]) * m]; });
    // TUNED once (LIFT.md): the one outline they became stays lit through the chord and fades with it (was: gone at merge).
    const after = a - P.flashSeconds - P.mergeSeconds, hold = Math.max(0.001, P.chordSeconds - P.flashSeconds - P.mergeSeconds);
    return { pts, k: s.guess.k, figure: s.figure, brightness: m < 1 ? 1 : Math.max(0, 1 - after / hold), flash, merge: m, belt: flash };
  }

  // How citizen i's voice is bent: while the figure sings, its voice takes the guess's corner count; during the chord,
  // every voice within reach takes it too (each keeps its own pitch, so the street holds one chord).
  function voice(i, now, d) {
    if (!s || !s.guess) return null;
    if (s.phase === 'singing' && i === s.figure && s.singing && now >= s.singing[0] && now < s.singing[1]) return { sides: s.guess.k, sing: true };
    if (s.phase === 'chord' && (i === s.figure || d <= P.reach)) return { sides: s.guess.k, chord: true };
    return null;
  }

  return {
    call, step, draw, voice,
    get state() { return s ? { phase: s.phase, figure: s.figure, k: s.guess?.k ?? null, stopPos: s.stopPos ?? null } : null; },
    get events() { return out; }
  };
}

export const _test = { TAU };
