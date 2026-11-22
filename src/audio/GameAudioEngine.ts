/**
 * Звук игры: эффекты, голос ключей и эмбиент (план, раздел 10).
 * Главный звуковой сигнал — ключи библиотекаря: пока он идёт, связка тихо звенит,
 * громкость и панорама зависят от расстояния до героя; когда он слушает, ключи
 * смолкают — тишина значит опасность (10.2).
 */
import { balance } from '../config/balance';
import { Mixer } from '../shared/audio/mixer';
import { noise, tone } from '../shared/audio/synth';
import { KeysVoice } from './keysVoice';
import { presets } from './presets';
import type { AudioFrame, AudioSettings, GameAudio } from './types';

/** Громкость звуков по умолчанию. */
const GAIN: Record<string, number> = {
  correct: 0.7,
  deny: 0.6,
  step: 0.5,
  squeak: 0.9,
  bookFall: 0.9,
  throw: 0.7,
  thud: 0.9,
  rustle: 0.7,
  grab: 0.7,
  sniff: 0.7,
  inhale: 0.7,
  run: 0.6,
  grumble: 0.8,
  sigh: 0.6,
  stamp: 1,
  doorCreak: 0.6,
  doorSlam: 0.9,
  snore: 0.6,
  win: 0.8,
};

export class GameAudioEngine implements GameAudio {
  private readonly mixer = new Mixer();
  private readonly keys = new KeysVoice(this.mixer);
  private clockAt = 0;
  private tick = false;
  private owlAt = 20;
  private heartAt = 0;
  private wind: { src: AudioBufferSourceNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  private time = 0;
  private paused = false;

  unlock(): void {
    if (!this.mixer.unlock()) return;
    if (!this.wind) this.startWind();
  }

  play(name: string, pan = 0): void {
    const preset = presets[name === 'grab' ? 'grab' : name];
    if (!preset) return;
    // Повторяющиеся звуки — с разбросом высоты ±5% (10.6).
    const pitch = 1 + (Math.random() * 2 - 1) * balance.audio.pitchJitter;
    const v = this.mixer.voice(pan, GAIN[name] ?? 0.7, pitch);
    if (v) preset(v);
  }

  setSettings(s: AudioSettings): void {
    this.mixer.set(s);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.mixer.setPaused(paused);
  }

  update(dt: number, frame: AudioFrame): void {
    if (!this.mixer.ready) return;
    this.time += dt;
    // Эмбиент — старый дом ночью: часы с маятником, ветер, редкий филин (10.4).
    this.clockAt -= dt;
    if (this.clockAt <= 0) {
      this.clockAt = 1;
      this.tick = !this.tick;
      const v = this.mixer.voice(0.35, 0.18, this.tick ? 1 : 0.84, 'ambient');
      if (v) {
        noise(v, { type: 'bandpass', freq: 2600, q: 6, release: 0.035, peak: 0.5 });
        tone(v, { type: 'sine', freq: 1300, release: 0.04, peak: 0.12 });
      }
    }
    this.owlAt -= dt;
    if (this.owlAt <= 0) {
      this.owlAt = 25 + Math.random() * 25;
      const v = this.mixer.voice(-0.5 + Math.random(), 0.25, 1, 'ambient');
      if (v) {
        tone(v, {
          type: 'sine',
          freq: 392,
          freqTo: 370,
          attack: 0.08,
          hold: 0.25,
          release: 0.3,
          peak: 0.4,
          vibrato: { rate: 6, depth: 0.01 },
        });
        tone(v, {
          type: 'sine',
          freq: 392,
          freqTo: 360,
          attack: 0.06,
          hold: 0.12,
          release: 0.2,
          peak: 0.32,
          delay: 0.85,
        });
        tone(v, {
          type: 'sine',
          freq: 392,
          freqTo: 350,
          attack: 0.06,
          hold: 0.25,
          release: 0.35,
          peak: 0.36,
          delay: 1.25,
        });
      }
    }
    // Герой в кольце громкого слуха: эмбиент на 40% тише, слышно сердцебиение (10.5).
    this.mixer.setAmbientDuck(frame.earshot ? 1 - balance.audio.earshotAmbientDuck : 1);
    if (frame.earshot && frame.playing) {
      this.heartAt -= dt;
      if (this.heartAt <= 0) {
        this.heartAt = 0.86;
        const v = this.mixer.voice(0, 0.7, 1);
        if (v) {
          tone(v, { type: 'sine', freq: 62, freqTo: 48, release: 0.12, peak: 0.6 });
          tone(v, { type: 'sine', freq: 58, freqTo: 44, release: 0.14, peak: 0.45, delay: 0.24 });
        }
      }
    } else {
      this.heartAt = 0;
    }
    // Голос ключей: звенят на ходу, смолкают, когда он слушает.
    this.keys.update(dt, frame.librarians, frame.playing && !this.paused);
  }

  private startWind(): void {
    const ctx = this.mixer.ctx;
    if (!ctx) return;
    const v = this.mixer.voice(0, 1, 1, 'ambient');
    if (!v) return;
    const src = ctx.createBufferSource();
    src.buffer = (() => {
      // Мягкий «коричневый» шум для ветра.
      const len = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
        d[i] = last * 3.2;
      }
      return buf;
    })();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0.16;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const depth = ctx.createGain();
    depth.gain.value = 0.1;
    lfo.connect(depth).connect(gain.gain);
    src.connect(f).connect(gain).connect(v.out);
    src.start();
    lfo.start();
    this.wind = { src, gain, lfo };
  }

  destroy(): void {
    try {
      this.wind?.src.stop();
      this.wind?.lfo.stop();
    } catch {
      // Узлы уже остановлены.
    }
    this.wind = null;
    this.mixer.destroy();
  }
}
