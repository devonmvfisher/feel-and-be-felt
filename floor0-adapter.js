// floor0-adapter.mjs: joins the three pure lift modules (duet, quiet, colour) to floor-0, which has citizens but no
// CrowdState, small figure or crossing bus yet. Loaded only when the switch names a lift (?lift=duet,quiet,colour or
// WORLD.lift in main.js); with the switch off main.js never imports this file and the page is floor-0 as it passed.
// When round two lands, only this file changes (point it at x3's CrowdState and small figure and at VOICE-LAW's outline
// voice); the three modules stay as they are.
import {regularPolygon} from './geometry.js';
import {createDuet} from './duet.js';
import {createQuiet} from './quiet.js';
import {createColour} from './colour.js';

export const LIFTS = ['duet', 'quiet', 'colour'];

// Parse the switch: "duet,quiet,colour" (any order, any subset; "off" or empty = none). Unknown names are refused.
export function parseLift(text) {
  const names = String(text ?? '').split(',').map(s => s.trim().toLowerCase()).filter(s => s && s !== 'off');
  for (const n of names) if (!LIFTS.includes(n)) throw new Error('?lift= knows only ' + LIFTS.join(', ') + ' (got "' + n + '").');
  return LIFTS.filter(n => names.includes(n));
}

export function createLift(list, {THREE, scene, WORLD, R, people, lineMat, eyeMat, hemi, key, t0, api}) {
  const on = new Set(list), clock = () => (performance.now() - t0) / 1000;
  const duet = on.has('duet') ? createDuet() : null, quiet = on.has('quiet') ? createQuiet() : null, colour = on.has('colour') ? createColour(people.length) : null;
  const log = {list: [...list], boot: new Date().toISOString(), events: [], voices: [], about: 'floor-0-lift event log: t = page seconds since boot (performance clock); giftT = the gift cycle clock; voices = the 8 x2 voices as main.js set them, [owner, sides, rank, x, y, moving], sampled at 30 Hz with the ceiling'};
  const push = evs => { for (const e of evs) log.events.push({...e, frame: api.frames}); };
  const gift = new THREE.Color(WORLD.gift), white = new THREE.Color('#ffffff'), beltBase = lineMat.color.clone(), figColour = new THREE.Color(WORLD.light);
  let view = {corners: [], center: [0, 0], citizens: []}, lastLog = -1, mix = 0;

  // The guess outline: a thin loop of light in the figure's own colour.
  const guessGeo = new THREE.BufferGeometry(); guessGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(33 * 3), 3));
  const guessMat = new THREE.LineBasicMaterial({color: WORLD.light, transparent: true, opacity: 0, depthTest: false});
  const guessLine = new THREE.LineLoop(guessGeo, guessMat); guessLine.renderOrder = 9; guessLine.visible = false; scene.add(guessLine);

  // Input: the call key sends playerCall (duet); any input ends the quiet within one frame.
  const input = kind => { if (quiet) quiet.input(clock(), kind); };
  const doCall = () => { if (!duet) return; input('call'); push(duet.call(clock(), view)); };
  addEventListener('keydown', e => { input('key'); if (e.key === 'c' || e.key === 'C') doCall(); });
  for (const type of ['pointerdown', 'pointermove', 'wheel', 'touchstart']) addEventListener(type, () => input(type), {passive: true});
  document.getElementById('eye')?.addEventListener('input', () => input('eye'));

  return {
    // The gift's height: unattended drift (the cube is the only gift at web weight, so it takes the first loop).
    giftHeight(h, half) {
      if (!quiet) return h;
      const now = clock(), q = quiet.step(now); mix = q.mix;
      if (q.active !== (log._q ?? false)) { log._q = q.active; }
      push(quiet.events.splice(0));
      return quiet.height(0, h, half + 1.5, now, mix);
    },
    // After floor-0's touch pass: the duet, the colour trace and the quiet light, then the drawing.
    afterFeel({corners, center, giftT}) {
      const now = clock();
      view = {corners, center, citizens: people.map(c => ({sides: c.sides, size: WORLD.size, pos: c.pos, d: Number.isFinite(c.d) ? Math.max(0, c.d - R) : Infinity}))};
      if (duet) {
        push(duet.step(now, view));
        const st = duet.state;
        if (st && st.stopPos && st.phase !== 'waiting') {   // the figure stops and faces the slice
          const c = people[st.figure]; c.pos[0] = st.stopPos[0]; c.pos[1] = st.stopPos[1]; c.moving = false;
          c.heading = Math.atan2(center[1] - c.pos[1], center[0] - c.pos[0]); c.loop = regularPolygon(c.sides, R, c.pos, c.angle);
          c.mesh.position.set(c.pos[0], 0, c.pos[1]); c.eye.position.set(c.pos[0] + Math.cos(c.heading) * R * 0.75, 0.06, c.pos[1] + Math.sin(c.heading) * R * 0.75);
        }
        const d = duet.draw(now);
        if (d) {
          const arr = guessGeo.attributes.position.array, n = Math.min(32, d.pts.length);
          for (let i = 0; i < n; i++) arr.set([d.pts[i][0], 0.08, d.pts[i][1]], i * 3);
          guessGeo.attributes.position.needsUpdate = true; guessGeo.setDrawRange(0, n); guessGeo.computeBoundingSphere();
          guessMat.color.copy(figColour).lerp(white, d.flash); guessMat.opacity = Math.max(d.brightness, d.flash); guessLine.visible = guessMat.opacity > 0.001;
          lineMat.color.copy(beltBase).lerp(white, d.belt ?? 0);
        } else { guessLine.visible = false; lineMat.color.copy(beltBase); }
      }
      if (colour) { const m = colour.step(now, view.citizens.map(c => c.d)); people.forEach((c, i) => { if (m[i] > 0) c.mat.color.lerp(gift, m[i]); }); }
      if (quiet) { const L = quiet.light(mix); hemi.intensity = 1.6 * L; key.intensity = 2.2 * (1 - mix); if (mix > 0) { for (const c of people) c.mat.color.multiplyScalar(L); eyeMat.color.setScalar(L); } else eyeMat.color.setScalar(1); }
      api.lift.giftT = giftT;
    },
    // Voices: the figure joins the eight voices while it sings; its voice, and during the chord every voice in reach,
    // takes the guess's corner count. Each keeps its own pitch (rank), so the street holds one chord.
    voiceOrder(order) {
      const st = duet?.state; if (!st || st.figure < 0 || order.includes(st.figure)) return order;
      return [...order.slice(0, order.length - 1), st.figure];
    },
    voiceSides(i, sides) {
      if (!duet) return sides; const v = duet.voice(i, clock(), view.citizens[i]?.d ?? Infinity);
      return v ? v.sides : sides;
    },
    logVoices(giftT, voices, ceiling) {
      const now = clock(); if (now - lastLog < 1 / 30 - 1e-4) return; lastLog = now;
      log.voices.push([+now.toFixed(4), +giftT.toFixed(4), ceiling, voices.map(s => { const m = s.v.state; return [s.owner, +m.sides.toFixed(3), +m.rank.toFixed(4), +m.x.toFixed(3), +m.y.toFixed(3), m.moving ? 1 : 0]; })]);
    },
    api: {
      list: [...list],
      call: doCall,
      state: () => ({duet: duet?.state ?? null, quiet: quiet ? {active: quiet.active, mix} : null, colour: colour ? {traced: colour.traced, passes: colour.passes} : null, guessVisible: guessLine.visible, guessOpacity: +guessMat.opacity.toFixed(3), events: log.events.length}),
      log: () => log,
      backdate: s => quiet?.backdate(clock(), s)
    }
  };
}
