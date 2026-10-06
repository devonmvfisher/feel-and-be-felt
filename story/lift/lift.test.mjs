// Node checks for the three lift modules, on the real block's slices (the same exported functions floor-0-lift uses).
// Run: node lift.test.mjs   (reads ../floor-0-lift/models/cube.glb; writes nothing)
import {readFileSync} from 'node:fs';
import {WORLD,giftMatrix,giftHeight,feltCorners} from '../floor-0-lift/main.js';
import {triangleSoup,sliceTriangles,loopSegments} from '../x1/20261005-x1-FLATLAND-ENGINE-v1/flatland-engine/lib/geometry.mjs';
import {DUET,pickCorners,makeGuess,fitError,pickFigure,createDuet,polygonAngles} from './duet.mjs';
import {createQuiet} from './quiet.mjs';
import {createColour,mixHex} from './colour.mjs';
import {parseLift} from './floor0-adapter.mjs';

let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'ok   ' : 'FAIL ') + m); };

// the real block, as slicecheck reads it
const bytes = readFileSync(new URL('../floor-0-lift/models/cube.glb', import.meta.url)), jl = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + jl).toString('utf8')), bin = bytes.subarray(20 + jl + 8);
const view = (i, T) => { const a = doc.accessors[i], v = doc.bufferViews[a.bufferView], per = {SCALAR: 1, VEC2: 2, VEC3: 3}[a.type]; return new T(bin.buffer.slice(bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0), bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + a.count * per * T.BYTES_PER_ELEMENT)); };
const parts = []; let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (const mesh of doc.meshes) for (const p of mesh.primitives) { const a = doc.accessors[p.attributes.POSITION]; min = min.map((v, i) => Math.min(v, a.min[i])); max = max.map((v, i) => Math.max(v, a.max[i]));
  parts.push({positions: view(p.attributes.POSITION, Float32Array), indices: view(p.indices, doc.accessors[p.indices].componentType === 5125 ? Uint32Array : Uint16Array)}); }
const M = giftMatrix(min, max, WORLD.poseShelf, WORLD.giftSize), chunks = parts.map(p => triangleSoup(p, M)), soup = new Float64Array(chunks.reduce((n, c) => n + c.length, 0)); { let k = 0; for (const c of chunks) { soup.set(c, k); k += c.length; } }
let low = Infinity; for (let i = 1; i < soup.length; i += 3) low = Math.min(low, soup[i]); const half = -low;
const at = t => { const s = sliceTriangles(soup, -giftHeight(t, half)), corners = s.loops.flatMap(l => feltCorners(l)), segs = s.loops.flatMap(loopSegments); let cx = 0, cz = 0; for (const g of segs) { cx += g[0][0]; cz += g[0][1]; } return {corners, center: segs.length ? [cx / segs.length, cz / segs.length] : [0, 0]}; };

// 1. the guess from the held hexagon (t = 12): a triangle of your three sharpest, evenly spread corners
const hex = at(12); ok(hex.corners.length === 6, `hold slice has 6 felt corners (${hex.corners.map(c => c.angle.toFixed(1)).join(', ')})`);
const g3 = makeGuess(hex.corners, hex.center, 3); ok(g3 && g3.k === 3, `guess for a 3-sided figure has 3 corners: idx ${g3?.idx} angles ${g3?.angles.map(a => a.toFixed(1))}`);
ok(g3 && g3.angles.every(a => Math.abs(a - 60) < 8), 'the triangle guess is near-equilateral (every angle within 8 of 60)');
const g4 = makeGuess(hex.corners, hex.center, 4); ok(g4 && g4.k === 4, `guess for a 4-sided figure has 4 corners: angles ${g4?.angles.map(a => a.toFixed(1))}`);
ok(makeGuess(hex.corners, hex.center, 6) === null && makeGuess(hex.corners.slice(0, 3), hex.center, 3) === null, 'no guess with as many corners as your slice, and none from a triangle slice (the guess is always wrong, never equal)');
ok(Math.abs(polygonAngles(g3.raw).reduce((a, b) => a + b, 0) - 180) < 1e-6, 'guess angles sum to 180');

// 2. the fit: as the cycle lifts the block, the slice becomes the triangle the guess sang
let run = 0, fitT = null, worst = null;
for (let f = 14 * 30; f < 24 * 30; f++) { const t = f / 30, s = at(t), e = s.corners.length === 3 ? fitError(s.corners.map(c => c.angle), g3.angles) : Infinity; run = e <= DUET.tolDeg ? run + 1 : 0; if (run >= 3) { fitT = t; worst = e; break; } }
ok(fitT !== null, `the triangle guess fits on the way up at t = ${fitT?.toFixed(3)} s (worst angle error ${worst?.toFixed(2)} deg, tolerance ${DUET.tolDeg})`);
let fit4 = false; for (let f = 0; f < 30 * 30 && !fit4; f++) { const s = at(f / 30); fit4 = s.corners.length === 4 && fitError(s.corners.map(c => c.angle), g4.angles) <= DUET.tolDeg; }
ok(!fit4, 'deliberate break: a square guess never fits this pose on its cycle (so the 20 s give-up path is real)');

// 3. the figure: smallest with 3 or more sides within 12 sizes; ties to fewer sides, then nearest
const cits = [{sides: 6, size: 1, d: 2, pos: [0, 0]}, {sides: 3, size: 1, d: 9, pos: [0, 0]}, {sides: 3, size: 1, d: 4, pos: [0, 0]}, {sides: 2, size: 1, d: 1, pos: [0, 0]}, {sides: 3, size: 1, d: 13, pos: [0, 0]}];
ok(pickFigure(cits) === 2, 'figure = the nearest of the fewest-sided within reach (a Line is skipped)');
ok(pickFigure([{sides: 3, size: 1, d: 12.5, pos: [0, 0]}]) === -1, 'nobody past 12 sizes answers');

// 4. the state machine on the real slices: call at 11.3 s, answer at 13, sing, fit on the way up, chord 4 s
const d = createDuet(), people = () => [{sides: 3, size: 1, d: 3, pos: [5, 5]}, {sides: 5, size: 1, d: 1, pos: [1, 1]}];
const ev = []; let t = 10; const sv = tt => ({...at(tt), citizens: people()});
for (; t < 30; t += 1 / 30) { if (Math.abs(t - 11.3) < 1 / 60) ev.push(...d.call(t, sv(t))); ev.push(...d.step(t, sv(t))); }
const kinds = ev.map(e => e.type); const ans = ev.find(e => e.type === 'figureAnswer'), fit = ev.find(e => e.type === 'fit'), end = ev.find(e => e.type === 'chordEnd');
ok(ans && ans.at === 13 && ans.t - 13 < 1 / 30 + 1e-9, `answer on the whole-second clock one beat after the call: due ${ans?.at}, drawn on the frame at ${ans?.t}`);
ok(fit && fit.t > 16 && fit.t < 23, `fit at ${fit?.t} s, inside the lift-off window`);
ok(end && Math.abs(end.t - fit.t - 4) < 0.05, `chord holds 4 s (${fit?.t} to ${end?.t})`);
ok(kinds.includes('heraldQuiet') && kinds.filter(k => k === 'figureSing').length >= 1, `events: ${[...new Set(kinds)].join(', ')}`);
const v1 = d.voice(0, 13.5, 3); ok(v1 === null, 'after the duet, no voice is bent');
// brightness floor while singing
const d2 = createDuet(); d2.call(11.3, sv(11.3)); d2.step(13, sv(13)); const b0 = d2.draw(13).brightness, b8 = d2.draw(25).brightness;
ok(b0 === 1 && Math.abs(b8 - 1 / 3) < 1e-9, `guess brightness 1 at the answer, floor 1/3 after 8 s (${b8.toFixed(3)})`);
// give-up path with a square guess
const d3 = createDuet(), e3 = []; d3.call(11.3, sv(11.3)); for (let tt = 11.3; tt < 40; tt += 1 / 30) e3.push(...d3.step(tt, {...at(tt), citizens: [{sides: 4, size: 1, d: 3, pos: [0, 0]}]}));
const gu = e3.find(e => e.type === 'duetEnd'); ok(gu && /no fit/.test(gu.why) && Math.abs(gu.t - 33) < 0.05, `square guess gives up 20 s after it first sang: ${gu?.t} (${gu?.why})`);

// 5. quiet: 60 s idle, 5 s ease, any input ends it
const q = createQuiet(); q.step(0); let r = q.step(59.9); ok(!r.active, 'not quiet at 59.9 s'); r = q.step(60); ok(r.active && r.mix === 0, 'quiet starts at 60 s');
r = q.step(65); ok(r.mix === 1 && Math.abs(q.light(r.mix) - 0.55) < 1e-9, 'light at the even, dim level after 5 s');
const hq = q.height(0, 3, 7.873, 60 + 37, 1); ok(Math.abs(hq - 7.873) < 1e-9, 'the cube returns to the top after one 37 s loop');
q.input(70, 'key'); r = q.step(70.016); ok(!r.active && r.mix === 0, 'any input ends the quiet on the next frame');

// 6. colour: within 1 size -> 25% mix, fading over 4 s
const c = createColour(2); let m = c.step(0, [0.5, 3]); ok(m[0] === 0.25 && m[1] === 0, 'trace at 25% within 1 size, none at 3');
for (let tt = 0.1; tt <= 2.0001; tt += 0.1) m = c.step(tt, [Infinity, Infinity]); ok(Math.abs(m[0] - 0.125) < 1e-6, `half faded after 2 s (${m[0].toFixed(4)})`);
for (let tt = 2.1; tt <= 4.2; tt += 0.1) m = c.step(tt, [Infinity, Infinity]); ok(m[0] === 0, 'gone after 4 s');
ok(mixHex('#F2E8D5', '#C8107A', 0.25) === '#e8b2be', 'a 25% trace on a citizen reads ' + mixHex('#F2E8D5', '#C8107A', 0.25));

// 7. the switch
ok(parseLift('duet,quiet,colour').join() === 'duet,quiet,colour' && parseLift('').length === 0 && parseLift('off').length === 0 && parseLift('colour,duet').join() === 'duet,colour', 'switch parses any subset, off and empty');
let threw = false; try { parseLift('hands'); } catch { threw = true; } ok(threw, 'switch refuses an unknown name');

console.log(`LIFT TESTS: ${pass} pass, ${fail} fail`); process.exitCode = fail ? 1 : 0;
// 8. the merge pairs corners one to one (added after the first fit still showed the guess turned 60 degrees from the slice)
{ const {pairCorners} = await import('./duet.mjs'); const tri = [[0, 1], [0.87, -0.5], [-0.87, -0.5]], turned = [[0, -1], [-0.87, 0.5], [0.87, 0.5]];
  const map = pairCorners(tri, turned); console.log((new Set(map).size === 3 ? 'ok   ' : 'FAIL ') + 'a guess turned 60 degrees still pairs each corner with a different one: ' + map); if (new Set(map).size !== 3) process.exitCode = 1; }
