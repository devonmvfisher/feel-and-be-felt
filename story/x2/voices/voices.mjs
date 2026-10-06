// Original shape voices. Browser runtime: one ES module, Web Audio only.
export const MAX_PARTIALS = 16;
export const CIRCLE_SIDES = 32;
export const MAX_GAIN = 0.12;
export const MAX_VOICES = 8;
export const PEACE_LEVEL = 0.35;
export const GLIDE_SECONDS = Object.freeze({ pitch: 0.055, partial: 0.035, level: 0.045, position: 0.06 });
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smoothstep = value => { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); };
function finite(value, label) { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(label + ' must be a finite number'); return value; }
function range(value, low, high, label) { finite(value, label); if (value < low || value > high) throw new RangeError(label + ' must be ' + low + '..' + high); return value; }

export function advanceGlide(current, target, elapsed, tau = GLIDE_SECONDS.pitch) {
  finite(current, 'current'); finite(target, 'target'); range(elapsed, 0, Number.MAX_VALUE, 'elapsed');
  if (finite(tau, 'tau') <= 0) throw new RangeError('tau must be positive');
  return target + (current - target) * Math.exp(-elapsed / tau);
}

export function pitchFor(rank, size = 1) {
  range(rank, 0, 1, 'rank'); range(size, 0, 16, 'size');
  return size === 0 ? 0 : clamp(110 * 2 ** (2 * rank) / Math.sqrt(Math.max(size, 0.25)), 55, 880);
}

export function harmonicWeights(sides, fundamental = 220, sampleRate = 48000) {
  range(sides, 0, 1000000, 'sides'); range(fundamental, 0, 20000, 'fundamental');
  if (finite(sampleRate, 'sampleRate') <= 0) throw new RangeError('sampleRate must be positive');
  const circle = smoothstep((sides - MAX_PARTIALS) / (CIRCLE_SIDES - MAX_PARTIALS));
  const weights = Array.from({ length: MAX_PARTIALS }, (_, i) => {
    const harmonic = i + 1;
    if (sides === 0 || fundamental === 0 || fundamental * harmonic >= sampleRate * 0.45) return 0;
    return harmonic === 1 ? 1 : smoothstep(sides - i) * (1 - circle) / Math.sqrt(harmonic);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  return sum ? weights.map(value => value / sum) : weights;
}

export function countPartials(sides) {
  return harmonicWeights(sides).filter(value => value > 0.000001).length;
}

export function distanceCurve(distance, sampleRate = 48000) {
  if (finite(distance, 'distance') < 0) throw new RangeError('distance must be nonnegative');
  if (finite(sampleRate, 'sampleRate') <= 0) throw new RangeError('sampleRate must be positive');
  return { gain: 1 / (1 + distance) ** 2, cutoff: Math.min(sampleRate * 0.45, 40 + 17960 / (1 + distance * 0.65)) };
}

export function positionFor(position, listener = { x: 0, y: 0 }, mode = 'flatland', sampleRate = 48000) {
  if (!['flatland', 'lineland'].includes(mode)) throw new RangeError('mode must be flatland or lineland');
  const dx = finite(position.x, 'x') - finite(listener.x, 'listener x');
  const dy = mode === 'lineland' ? 0 : finite(position.y, 'y') - finite(listener.y, 'listener y');
  const distance = Math.hypot(dx, dy), curve = distanceCurve(distance, sampleRate);
  return { distance, pan: clamp(dx / Math.max(mode === 'lineland' ? 4 : distance, 1), -1, 1), ...curve };
}

function unitLimit(value) { const x = clamp(finite(value, 'sample'), -1, 1); return (3 * x - x * x * x) / 2; }
export function limiterSample(value, ceiling = MAX_GAIN) { return unitLimit(value) * range(ceiling, 0, MAX_GAIN, 'ceiling'); }
export function limiterCurve(length = 4097) {
  if (!Number.isInteger(length) || length < 3 || length % 2 !== 1) throw new RangeError('limiter curve length must be an odd integer >=3');
  return Float32Array.from({ length }, (_, i) => unitLimit(2 * i / (length - 1) - 1));
}

const DEFAULTS = Object.freeze({ sides: 3, rank: 0.2, size: 1, x: 0, y: 1, moving: false });
function shapeState(patch = {}, previous = DEFAULTS) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('shape update needs an object');
  for (const key of Object.keys(patch)) if (!Object.hasOwn(DEFAULTS, key)) throw new RangeError('unknown shape field: ' + key);
  const state = { ...previous, ...patch };
  range(state.sides, 0, 1000000, 'sides'); range(state.rank, 0, 1, 'rank'); range(state.size, 0, 16, 'size');
  range(state.x, -1000000, 1000000, 'x'); range(state.y, -1000000, 1000000, 'y');
  if (typeof state.moving !== 'boolean') throw new TypeError('moving must be boolean');
  return state;
}

export function voiceTargets(shape, { mode = 'flatland', listener = { x: 0, y: 0 }, sampleRate = 48000 } = {}) {
  const state = shapeState(shape);
  const position = positionFor(state, listener, mode, sampleRate);
  const visible = mode === 'lineland' ? 1 : smoothstep(state.sides) * smoothstep(state.size / 0.1);
  const frequency = mode === 'lineland' ? 220 : pitchFor(state.rank, state.size);
  const weights = mode === 'lineland' ? [1, ...Array(MAX_PARTIALS - 1).fill(0)] : harmonicWeights(state.sides, frequency, sampleRate);
  return { ...position, visible, frequency, weights };
}

// Own record matches the AudioParam target/linear functions, including hold fallback.
class ParamGlide {
  constructor(param, context, value, tau) {
    this.param = param; this.context = context; this.value = value; this.target = value; this.time = context.currentTime; this.tau = tau; this.linear = null;
    param.setValueAtTime(value, this.time);
  }
  at(time) {
    const elapsed = Math.max(0, time - this.time);
    if (this.linear) return this.value + (this.target - this.value) * clamp(elapsed / this.linear, 0, 1);
    return advanceGlide(this.value, this.target, elapsed, this.tau);
  }
  hold(time) {
    const value = this.at(time);
    if (typeof this.param.cancelAndHoldAtTime === 'function') this.param.cancelAndHoldAtTime(time);
    else { this.param.cancelScheduledValues(time); this.param.setValueAtTime(value, time); }
    this.value = value; this.time = time; this.linear = null;
  }
  to(target, time = this.context.currentTime) {
    finite(target, 'parameter target');
    if (target === this.target) return;
    this.hold(time); this.target = target;
    this.param.setTargetAtTime(target, time, this.tau);
  }
  fadeToZero(time = this.context.currentTime, seconds = 0.05) {
    if (this.target === 0) return;
    this.hold(time); this.target = 0; this.linear = seconds;
    this.param.linearRampToValueAtTime(0, time + seconds);
  }
}

function trustedTap(event) {
  return typeof globalThis.Event === 'function' && event instanceof globalThis.Event && event.isTrusted === true
    && (['click', 'pointerdown', 'pointerup', 'touchend'].includes(event.type) || event.type === 'keydown' && ['Enter', ' '].includes(event.key));
}

class ShapeVoice {
  constructor(engine, shape) { this.engine = engine; this.model = shapeState(shape); this.speaking = false; this.nodes = null; this.disposed = false; }
  get state() { return Object.freeze({ ...this.model, speaking: this.speaking }); }
  check() { if (this.disposed || this.engine.closed) throw new Error('voice is disposed'); }
  ensureNodes() {
    if (this.nodes) return;
    const ctx = this.engine.context, now = ctx.currentTime;
    const filter = ctx.createBiquadFilter(), level = ctx.createGain(), pan = ctx.createStereoPanner();
    filter.type = 'lowpass'; filter.Q.setValueAtTime(Math.SQRT1_2, now);
    filter.connect(level); level.connect(pan); pan.connect(this.engine.bus);
    const nodes = { filter, level, pan, bank: [], glides: {
      cutoff: new ParamGlide(filter.frequency, ctx, 18000, GLIDE_SECONDS.position),
      level: new ParamGlide(level.gain, ctx, 0, GLIDE_SECONDS.level), pan: new ParamGlide(pan.pan, ctx, 0, GLIDE_SECONDS.position) } };
    let ended = 0;
    for (let i = 1; i <= MAX_PARTIALS; i++) {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = 'sine'; oscillator.connect(gain); gain.connect(filter);
      const frequency = new ParamGlide(oscillator.frequency, ctx, 220 * i, GLIDE_SECONDS.pitch);
      const amplitude = new ParamGlide(gain.gain, ctx, 0, GLIDE_SECONDS.partial);
      oscillator.onended = () => {
        oscillator.disconnect(); gain.disconnect(); ended++;
        if (ended === MAX_PARTIALS) { filter.disconnect(); level.disconnect(); pan.disconnect(); nodes.onComplete?.(); }
      };
      nodes.bank.push({ oscillator, gain, frequency, amplitude });
      oscillator.start(now);
    }
    this.nodes = nodes;
  }
  apply() {
    this.check();
    if (!this.engine.unlocked) return;
    if (!this.nodes && !this.speaking && !this.model.moving) return;
    this.ensureNodes();
    const ctx = this.engine.context, now = ctx.currentTime;
    const target = voiceTargets(this.model, { mode: this.engine.mode, listener: this.engine.listener, sampleRate: ctx.sampleRate });
    this.nodes.bank.forEach((partial, i) => {
      partial.frequency.to(Math.min(Math.max(target.frequency, 55) * (i + 1), ctx.sampleRate * 0.45), now);
      partial.amplitude.to(target.weights[i], now);
    });
    this.nodes.glides.cutoff.to(target.cutoff, now); this.nodes.glides.pan.to(target.pan, now);
    const level = (this.model.moving ? PEACE_LEVEL : this.speaking ? 0.45 : 0) * target.gain * target.visible;
    if (level === 0) this.nodes.glides.level.fadeToZero(now);
    else this.nodes.glides.level.to(level, now);
  }
  update(patch) { this.check(); this.model = shapeState(patch, this.model); this.apply(); return this; }
  start() { this.check(); if (!this.engine.unlocked) throw new Error('tap first to enable sound'); this.speaking = true; this.apply(); return this; }
  stop() { this.check(); this.speaking = false; this.apply(); return this; }
  setMoving(value) { return this.update({ moving: value }); }
  dispose() {
    if (this.disposed) return this.done;
    let complete;
    this.done = new Promise(resolve => { complete = resolve; });
    this.speaking = false; this.model = { ...this.model, moving: false };
    if (this.nodes) {
      const time = this.engine.context.currentTime;
      this.nodes.onComplete = complete;
      this.nodes.glides.level.fadeToZero(time);
      for (const partial of this.nodes.bank) partial.oscillator.stop(time + 0.06);
      if (this.engine.context.state !== 'running') complete();
    } else complete();
    this.disposed = true; this.engine.voices.delete(this);
    return this.done;
  }
}

class VoiceEngine {
  constructor({ ceiling = MAX_GAIN, contextFactory = null } = {}) {
    range(ceiling, 0, MAX_GAIN, 'ceiling');
    if (contextFactory !== null && typeof contextFactory !== 'function') throw new TypeError('contextFactory must be a function');
    this.ceiling = ceiling; this.contextFactory = contextFactory; this.context = null; this.bus = null; this.master = null;
    this.unlocked = false; this.closed = false; this.pending = null; this.voices = new Set(); this.mode = 'flatland'; this.listener = { x: 0, y: 0 };
  }
  get status() { return Object.freeze({ unlocked: this.unlocked, closed: this.closed, voices: this.voices.size, mode: this.mode, ceiling: this.ceiling }); }
  async unlock(event) {
    if (this.closed) throw new Error('engine is disposed');
    if (!trustedTap(event)) throw new Error('sound needs a trusted player tap or Enter/Space');
    if (this.pending) return this.pending;
    this.pending = (async () => {
      if (!this.context) {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!this.contextFactory && typeof Audio !== 'function') throw new Error('Web Audio is unavailable');
        const ctx = this.contextFactory ? this.contextFactory() : new Audio();
        this.context = ctx; this.bus = ctx.createGain();
        const limiter = ctx.createWaveShaper(), output = ctx.createGain();
        limiter.curve = limiterCurve(); limiter.oversample = 'none';
        this.bus.gain.setValueAtTime(1, ctx.currentTime);
        this.bus.connect(limiter); limiter.connect(output); output.connect(ctx.destination);
        this.master = new ParamGlide(output.gain, ctx, 0, GLIDE_SECONDS.level);
      }
      await this.context.resume();
      if (this.closed) return;
      this.unlocked = true; this.master.to(this.ceiling);
      for (const voice of this.voices) voice.apply();
    })();
    try { await this.pending; } finally { this.pending = null; }
  }
  createVoice(shape = {}) {
    if (this.closed) throw new Error('engine is disposed');
    if (this.voices.size >= MAX_VOICES) throw new RangeError('at most ' + MAX_VOICES + ' voices per engine');
    const voice = new ShapeVoice(this, shape); this.voices.add(voice); voice.apply(); return voice;
  }
  setMode(mode) {
    if (this.closed) throw new Error('engine is disposed');
    if (!['flatland', 'lineland'].includes(mode)) throw new RangeError('mode must be flatland or lineland');
    this.mode = mode; for (const voice of this.voices) voice.apply(); return this;
  }
  setListener(listener) {
    if (this.closed) throw new Error('engine is disposed');
    const next = { x: range(listener.x, -1000000, 1000000, 'listener x'), y: range(listener.y ?? 0, -1000000, 1000000, 'listener y') };
    this.listener = next; for (const voice of this.voices) voice.apply(); return this;
  }
  setCeiling(ceiling) {
    if (this.closed) throw new Error('engine is disposed');
    range(ceiling, 0, MAX_GAIN, 'ceiling'); this.ceiling = ceiling;
    if (this.master) this.master.to(ceiling); return this;
  }
  silence() {
    if (this.closed) throw new Error('engine is disposed');
    for (const voice of this.voices) { voice.model = { ...voice.model, moving: false }; voice.stop(); }
    return this;
  }
  async dispose() {
    if (this.closed) return this.disposal;
    const ended = [...this.voices].map(voice => voice.dispose());
    this.closed = true; this.unlocked = false;
    this.disposal = (async () => {
      if (this.context) {
        if (this.context.state === 'running') await Promise.all(ended);
        await this.context.close();
      }
    })();
    return this.disposal;
  }
}

export function createVoices(options) { return new VoiceEngine(options); }
