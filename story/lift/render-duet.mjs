// render-duet.mjs: a 20 s duet WAV rendered from floor-0-lift's own event log, the H1 way (studio/render-studio.mjs:
// offline, Node stdlib only, no outside audio, master to -16 LUFS under a -2 dBFS look-ahead limiter, 48 kHz 16-bit).
// The voices are the page's own: every 30 Hz sample of the eight x2 voices exactly as main.js set them, played through
// x2 v1's own math (voiceTargets: pitch, side-count partials, distance gain and low-pass, pan) and its graph (glides,
// per-voice low-pass, equal-power pan, the cubic soft limiter, the ceiling). It assumes the listener has tapped, so all
// eight voices speak (in the headless run nobody tapped; the page set the same numbers either way).
// Usage: node render-duet.mjs <events.json> <out.wav> [seconds=20] [lead=1]
//   the window starts `lead` seconds before the first playerCall. Writes only the WAV and <out>.txt beside it.
import {readFileSync, writeFileSync} from 'node:fs';
import {voiceTargets, GLIDE_SECONDS, MAX_PARTIALS} from '../x2/voices/voices.mjs';

const [src, outWav, secArg = '20', leadArg = '1', where = 'observer'] = process.argv.slice(2);
if (!src || !outWav) throw new Error('usage: node render-duet.mjs <events.json> <out.wav> [seconds] [lead]');
const LOG = JSON.parse(readFileSync(src, 'utf8'));
const SR = 48000, DUR = Number(secArg), LEAD = Number(leadArg), NS = Math.round(SR * DUR), CTRL = 32, NB = Math.ceil(NS / CTRL);
// observer (default) = the page's own listener: main.js engine.setListener({x: observer[0]/4, y: observer[1]/4}), observer [0, 24].
// inside = a labelled alternative, NOT what the page does yet: the ears at the gift's centre (0, 0), where ORDERS puts the
// player for the duet ("inside your gift, e = 0"); floor-0 has no inside view, so the page still listens from the edge.
if (!['observer', 'inside'].includes(where)) throw new Error('listener must be observer or inside');
const LISTENER = where === 'inside' ? {x: 0, y: 0} : {x: 0 / 4, y: 24 / 4};
const call = LOG.events.find(e => e.type === 'playerCall'); if (!call) throw new Error('no playerCall in the log');
const T0 = call.t - LEAD, T1 = T0 + DUR;
const samples = LOG.voices.filter(v => v[0] >= T0 - 0.2 && v[0] <= T1 + 0.2); if (samples.length < 10) throw new Error('too few voice samples in the window');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const coef = tau => 1 - Math.exp(-CTRL / (SR * tau));
const K = {pitch: coef(GLIDE_SECONDS.pitch), partial: coef(GLIDE_SECONDS.partial), level: coef(GLIDE_SECONDS.level), pos: coef(GLIDE_SECONDS.position), ceil: coef(0.06)};
const SIN = new Float64Array(16384); for (let i = 0; i < 16384; i++) SIN[i] = Math.sin(2 * Math.PI * i / 16384);

// per-slot state, as the page's eight ShapeVoice objects keep it
const slots = Array.from({length: 8}, () => ({f: Array.from({length: MAX_PARTIALS}, (_, i) => 220 * (i + 1)), a: new Float64Array(MAX_PARTIALS), ph: new Float64Array(MAX_PARTIALS), level: 0, cutoff: 18000, pan: 0, z: [0, 0, 0, 0]}));
const L = new Float64Array(NS), R = new Float64Array(NS), buf = new Float64Array(CTRL);
let si = 0, ceiling = samples[0][2];
for (let b = 0; b < NB; b++) {
  const t = T0 + b * CTRL / SR; while (si + 1 < samples.length && samples[si + 1][0] <= t) si++;
  const S = samples[si], ceilT = S[2]; ceiling += (ceilT - ceiling) * K.ceil;
  const bus = new Float64Array(CTRL * 2);
  S[3].forEach(([owner, sides, rank, x, y, moving], v) => {
    const st = slots[v], tg = voiceTargets({sides, rank, size: 1, x, y, moving: !!moving}, {listener: LISTENER, sampleRate: SR});
    const levelT = (moving ? 0.35 : 0.45) * tg.gain * tg.visible;
    const l0 = st.level; st.level += (levelT - st.level) * K.level; st.cutoff += (tg.cutoff - st.cutoff) * K.pos; st.pan += (tg.pan - st.pan) * K.pos;
    for (let s = 0; s < CTRL; s++) buf[s] = 0;
    for (let i = 0; i < MAX_PARTIALS; i++) {
      const fT = Math.min(Math.max(tg.frequency, 55) * (i + 1), SR * 0.45); st.f[i] += (fT - st.f[i]) * K.pitch; st.a[i] += (tg.weights[i] - st.a[i]) * K.partial;
      const amp = st.a[i]; if (amp < 1e-6) { st.ph[i] = (st.ph[i] + CTRL * st.f[i] / SR) % 1; continue; }
      const inc = st.f[i] / SR; let ph = st.ph[i];
      for (let s = 0; s < CTRL; s++) { buf[s] += amp * SIN[(ph * 16384) | 0]; ph += inc; if (ph >= 1) ph -= 1; }
      st.ph[i] = ph;
    }
    // the voice's low-pass (Q 0.7071) at its distance cutoff, then its level and equal-power pan
    const w0 = 2 * Math.PI * Math.min(st.cutoff, SR * 0.45) / SR, al = Math.sin(w0) / (2 * Math.SQRT1_2), c = Math.cos(w0), a0 = 1 + al;
    const b0 = (1 - c) / 2 / a0, b1 = (1 - c) / a0, b2 = b0, a1 = -2 * c / a0, a2 = (1 - al) / a0; let [x1, x2, y1, y2] = st.z;
    const p = (st.pan + 1) / 2, gl = Math.cos(p * Math.PI / 2), gr = Math.sin(p * Math.PI / 2);
    for (let s = 0; s < CTRL; s++) { const xin = buf[s], yv = b0 * xin + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = xin; y2 = y1; y1 = yv;
      const g = l0 + (st.level - l0) * s / CTRL; bus[s * 2] += yv * g * gl; bus[s * 2 + 1] += yv * g * gr; }
    st.z = [x1, x2, y1, y2];
  });
  // the shared cubic soft limiter, then the ceiling (x2 v1's engine)
  for (let s = 0; s < CTRL && b * CTRL + s < NS; s++) { const lim = x => { x = clamp(x, -1, 1); return (3 * x - x * x * x) / 2; }; L[b * CTRL + s] = lim(bus[s * 2]) * ceiling; R[b * CTRL + s] = lim(bus[s * 2 + 1]) * ceiling; }
}
let pagePeak = 0; for (let i = 0; i < NS; i++) pagePeak = Math.max(pagePeak, Math.abs(L[i]), Math.abs(R[i]));

// ---------- the H1 master, unchanged in method (studio/render-studio.mjs): loudness, true peak, look-ahead limiter ----------
function biquad(x, b0, b1, b2, a1, a2) { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; } }
function lufs(A, B) { const k = x => { const y = Float64Array.from(x); biquad(y, 1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585); biquad(y, 1, -2, 1, -1.99004745483398, 0.99007225036621); return y; };
  const a = k(A), b = k(B), blk = 0.4 * SR, hop = 0.1 * SR, ms = [];
  for (let s = 0; s + blk <= a.length; s += hop) { let e = 0; for (let i = s; i < s + blk; i++) e += a[i] * a[i] + b[i] * b[i]; ms.push(e / blk); }
  const ld = m => -0.691 + 10 * Math.log10(m); const g1 = ms.filter(m => ld(m) > -70); const rel = ld(g1.reduce((s, m) => s + m, 0) / g1.length) - 10;
  const g2 = g1.filter(m => ld(m) > rel); return ld(g2.reduce((s, m) => s + m, 0) / g2.length); }
function truePeak(A, B) { const P = 4, T = 12, taps = []; for (let p = 0; p < P; p++) { const row = []; for (let k = -T; k <= T; k++) { const x = k - p / P; const w = 0.5 + 0.5 * Math.cos(Math.PI * x / (T + 1)); row.push(x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x) * w); } taps.push(row); }
  let mx = 0; for (const x of [A, B]) for (let n = T; n < x.length - T; n++) for (let p = 0; p < P; p++) { let y = 0; const row = taps[p]; for (let k = -T; k <= T; k++) y += x[n + k] * row[k + T]; const ay = Math.abs(y); if (ay > mx) mx = ay; }
  return 20 * Math.log10(mx); }
function limit(A, B, ceilDb) { const c = 10 ** (ceilDb / 20), N = A.length, LA = 192, req = new Float64Array(N);
  for (let i = 0; i < N; i++) { const p = Math.max(Math.abs(A[i]), Math.abs(B[i])); req[i] = p > c ? c / p : 1; }
  const mn = new Float64Array(N).fill(1); for (let i = 0; i < N; i++) if (req[i] < 1) for (let k = Math.max(0, i - LA); k <= Math.min(N - 1, i + LA); k++) if (req[i] < mn[k]) mn[k] = req[i];
  const g = new Float64Array(N); let acc = 0; const W = LA; for (let i = 0; i < N; i++) { acc += mn[i]; if (i >= W) acc -= mn[i - W]; g[Math.max(0, i - (W >> 1))] = acc / Math.min(i + 1, W); }
  for (let i = N - (W >> 1); i < N; i++) g[i] = mn[i];
  const rel = 1 - Math.exp(-1 / (0.08 * SR)); let gs = 1; const oA = new Float64Array(N), oB = new Float64Array(N);
  for (let i = 0; i < N; i++) { const gt = Math.min(g[i], req[i]); gs = gt < gs ? gt : gs + (gt - gs) * rel; oA[i] = A[i] * gs; oB[i] = B[i] * gs; }
  return [oA, oB]; }
const TARGET = -16;
function master(A, B) { const N = A.length; for (let i = 0; i < N; i++) { const fi = Math.min(1, i / (0.02 * SR)), fo = smooth(Math.min(1, (N - i) / (1.0 * SR))); A[i] *= fi * fo; B[i] *= fi * fo; }
  let G = 1, out = [A, B], ceil = -2.0, lu = 0, tp = 0;
  for (let it = 0; it < 6; it++) { const a = A.map(v => v * G), b = B.map(v => v * G); out = limit(a, b, ceil); lu = lufs(out[0], out[1]);
    G *= 10 ** ((TARGET - lu) / 20); if (Math.abs(TARGET - lu) < 0.05) { tp = truePeak(out[0], out[1]); if (tp <= -1.2) break; ceil -= 0.4; } }
  tp = truePeak(out[0], out[1]); return {L: out[0], R: out[1], lufs: lu, tp, gainDb: 20 * Math.log10(G)}; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function wav(path, A, B) { const N = A.length, out = Buffer.alloc(44 + N * 4), r = mulberry32(42);
  out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
  out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) for (const [c, x] of [[0, A], [1, B]]) { const d = (r() - r()) / 32768; out.writeInt16LE(clamp(Math.round((x[i] + d) * 32767), -32768, 32767), 44 + i * 4 + c * 2); }
  writeFileSync(path, out); }

const m = master(L, R); wav(outWav, m.L, m.R);
// longest stretch under -50 dBFS after the first sound (as studio/measure-studio.mjs reads it), in 10 ms windows
const thr = 10 ** (-50 / 20), win = SR / 100; let first = -1, run = 0, longest = 0;
for (let w = 0; w * win < NS; w++) { let pk = 0; for (let i = w * win; i < Math.min(NS, (w + 1) * win); i++) pk = Math.max(pk, Math.abs(m.L[i]), Math.abs(m.R[i])); if (pk >= thr) { if (first < 0) first = w; run = 0; } else if (first >= 0) { run++; longest = Math.max(longest, run); } }
// what the log says happened inside the window (page clock, and seconds into the WAV)
const inWin = LOG.events.filter(e => e.t >= T0 && e.t <= T1).map(e => `${(e.t - T0).toFixed(2)} s  ${e.type}${e.k ? ' k=' + e.k : ''}${e.worstDeg !== undefined ? ' worst ' + e.worstDeg + ' deg' : ''}`);
const fit = LOG.events.find(e => e.type === 'fit'), cs = LOG.events.find(e => e.type === 'chordStart'), ce = LOG.events.find(e => e.type === 'chordEnd');
let chord = null; if (cs && ce) { const rows = LOG.voices.filter(v => v[0] > cs.t + 0.1 && v[0] < ce.t - 0.05); chord = {samples: rows.length, voicesAtK: rows.length ? +(rows.reduce((n, v) => n + v[3].filter(x => Math.abs(x[1] - cs.k) < 1e-6).length, 0) / rows.length).toFixed(2) : 0}; }
const lines = [
  `render-duet: ${outWav} (listener: ${where}${where === 'inside' ? ', a renderer choice the page does not make yet' : ', as the page'})`, `source: ${src} (${LOG.voices.length} voice samples, ${LOG.events.length} events, lift ${LOG.list.join(',')})`,
  `window: page ${T0.toFixed(3)} to ${T1.toFixed(3)} s (${DUR} s, starting ${LEAD} s before the first playerCall); ${samples.length} voice samples used`,
  `page output peak before mastering: ${(20 * Math.log10(pagePeak)).toFixed(1)} dBFS (x2 ceiling ${ceiling}); master gain ${m.gainDb.toFixed(1)} dB to ${TARGET} LUFS (the H1 listening level, a playback choice)`,
  `own meter: ${m.lufs.toFixed(2)} LUFS, true peak (4x, own) ${m.tp.toFixed(2)} dBTP; longest stretch under -50 dBFS after the first sound: ${(longest / 100).toFixed(2)} s`,
  `chord: ${chord ? chord.voicesAtK + ' of 8 voices at the guess corner count on average over ' + chord.samples + ' samples' : 'none in log'}`,
  'events in the window (seconds into the WAV):', ...inWin.map(s => '  ' + s)];
writeFileSync(outWav.replace(/\.wav$/i, '') + '.txt', lines.join('\n') + '\n'); console.log(lines.join('\n'));
