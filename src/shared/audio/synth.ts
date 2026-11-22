/**
 * Маленький WebAudio-синтезатор серии: шум, тоны, огибающие, фильтры.
 * Звуки синтезируются — без аудиофайлов (план, 10.1). Каждый звук — функция, которая
 * расставляет узлы на графе и отпускает их после окончания.
 */

export interface Voice {
  ctx: AudioContext;
  /** Куда подключать выход звука (шина эффектов с панорамой). */
  out: AudioNode;
  /** Момент начала, секунды AudioContext. */
  t: number;
  /** Множитель высоты (разброс ±5%). */
  pitch: number;
  /** Громкость звука 0..1. */
  gain: number;
}

let noiseCache: AudioBuffer | null = null;
let noiseCtx: BaseAudioContext | null = null;

/** Две секунды белого шума — один буфер на всю игру. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (noiseCache && noiseCtx === ctx) return noiseCache;
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 0x2545f491;
  for (let i = 0; i < len; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    data[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
  }
  noiseCache = buf;
  noiseCtx = ctx;
  return buf;
}

/** Огибающая громкости: атака, спад до уровня, отпускание. */
export function envelope(
  g: GainNode,
  t: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
  curve: 'lin' | 'exp' = 'exp',
): number {
  const p = g.gain;
  p.cancelScheduledValues(t);
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  p.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
  if (curve === 'exp') p.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  else p.linearRampToValueAtTime(0.0001, t + attack + hold + release);
  return t + attack + hold + release;
}

/** Шумовой всплеск через фильтр. */
export function noise(
  v: Voice,
  opts: {
    type?: BiquadFilterType;
    freq: number;
    freqTo?: number;
    q?: number;
    attack?: number;
    hold?: number;
    release: number;
    peak?: number;
    delay?: number;
  },
): number {
  const { ctx } = v;
  const t = v.t + (opts.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.setValueAtTime(opts.freq * v.pitch, t);
  const end = t + (opts.attack ?? 0.005) + (opts.hold ?? 0) + opts.release;
  if (opts.freqTo !== undefined)
    f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqTo * v.pitch), end);
  f.Q.value = opts.q ?? 1;
  const g = ctx.createGain();
  envelope(g, t, (opts.peak ?? 1) * v.gain, opts.attack ?? 0.005, opts.hold ?? 0, opts.release);
  src.connect(f).connect(g).connect(v.out);
  const offset = Math.random() * 1.5;
  src.start(t, offset);
  src.stop(end + 0.05);
  return end;
}

/** Тон с огибающей и, по желанию, скольжением высоты. */
export function tone(
  v: Voice,
  opts: {
    type?: OscillatorType;
    freq: number;
    freqTo?: number;
    attack?: number;
    hold?: number;
    release: number;
    peak?: number;
    delay?: number;
    filter?: { type: BiquadFilterType; freq: number; q?: number };
    vibrato?: { rate: number; depth: number };
  },
): number {
  const { ctx } = v;
  const t = v.t + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq * v.pitch, t);
  const end = t + (opts.attack ?? 0.005) + (opts.hold ?? 0) + opts.release;
  if (opts.freqTo !== undefined)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqTo * v.pitch), end);
  let node: AudioNode = osc;
  if (opts.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = opts.vibrato.rate;
    depth.gain.value = opts.vibrato.depth * opts.freq * v.pitch;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(end + 0.05);
  }
  if (opts.filter) {
    const f = ctx.createBiquadFilter();
    f.type = opts.filter.type;
    f.frequency.value = opts.filter.freq;
    f.Q.value = opts.filter.q ?? 1;
    node.connect(f);
    node = f;
  }
  const g = ctx.createGain();
  envelope(g, t, (opts.peak ?? 1) * v.gain, opts.attack ?? 0.005, opts.hold ?? 0, opts.release);
  node.connect(g).connect(v.out);
  osc.start(t);
  osc.stop(end + 0.05);
  return end;
}

/**
 * Скрип дерева: пилообразный тон с «рваной» модуляцией высоты и громкости через
 * резонансный фильтр — половица, дверь.
 */
export function creak(
  v: Voice,
  opts: {
    freq: number;
    freqTo: number;
    dur: number;
    ratchet: number;
    peak?: number;
    bright?: number;
    delay?: number;
  },
): number {
  const { ctx } = v;
  const t = v.t + (opts.delay ?? 0);
  const end = t + opts.dur;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(opts.freq * v.pitch, t);
  osc.frequency.linearRampToValueAtTime(opts.freqTo * v.pitch, end);
  // Неровная скорость «зубцов» скрипа.
  const jitter = ctx.createOscillator();
  jitter.type = 'square';
  jitter.frequency.setValueAtTime(opts.ratchet, t);
  jitter.frequency.linearRampToValueAtTime(opts.ratchet * 0.6, end);
  const jitterDepth = ctx.createGain();
  jitterDepth.gain.value = opts.freq * 0.12 * v.pitch;
  jitter.connect(jitterDepth).connect(osc.frequency);
  const am = ctx.createGain();
  am.gain.value = 0.5;
  const amLfo = ctx.createOscillator();
  amLfo.type = 'square';
  amLfo.frequency.setValueAtTime(opts.ratchet * 1.3, t);
  const amDepth = ctx.createGain();
  amDepth.gain.value = 0.45;
  amLfo.connect(amDepth).connect(am.gain);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = (opts.bright ?? 1100) * v.pitch;
  f.Q.value = 6;
  const g = ctx.createGain();
  envelope(g, t, (opts.peak ?? 0.5) * v.gain, 0.03, opts.dur * 0.6, opts.dur * 0.4, 'lin');
  osc.connect(am).connect(f).connect(g).connect(v.out);
  for (const o of [osc, jitter, amLfo]) {
    o.start(t);
    o.stop(end + 0.1);
  }
  return end;
}
