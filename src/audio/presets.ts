/**
 * Звуки этой игры (план, 10.3): шарканье и бег тапочек, звон ключей, сопение, вдох
 * «Wer da?», ворчание, вздох, шаг на цыпочках, скрип половицы, падение книги, полёт и удар
 * словаря, шелест листа, удар штемпеля, скрип и хлопок двери, храп, отказ, верный ответ,
 * весёлые переливы победы. Всё — синтез, без файлов.
 */
import type { Voice } from '../shared/audio/synth';
import { creak, noise, tone } from '../shared/audio/synth';

export type Preset = (v: Voice) => void;

/** Звон связки ключей: несколько негармоничных «динь» вразнобой. */
export const keysJingle: Preset = (v) => {
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const delay = i * (0.025 + Math.random() * 0.04);
    const f = 2400 + Math.random() * 2600;
    tone(v, { type: 'sine', freq: f, release: 0.12 + Math.random() * 0.1, peak: 0.12, delay });
    tone(v, { type: 'sine', freq: f * 2.76, release: 0.06, peak: 0.04, delay });
  }
};

/** Шарканье тапочки. */
export const shuffle: Preset = (v) => {
  noise(v, {
    type: 'bandpass',
    freq: 1300,
    freqTo: 900,
    q: 0.8,
    attack: 0.03,
    release: 0.16,
    peak: 0.12,
  });
};

export const presets: Record<string, Preset> = {
  /** Верный ответ: короткий щелчок. */
  correct: (v) => {
    tone(v, { type: 'triangle', freq: 1760, release: 0.05, peak: 0.16 });
    tone(v, { type: 'sine', freq: 2640, release: 0.07, peak: 0.06, delay: 0.02 });
  },
  /** Отказ: два тихих глухих «тук». */
  deny: (v) => {
    tone(v, { type: 'sine', freq: 330, freqTo: 260, release: 0.06, peak: 0.16 });
    tone(v, { type: 'sine', freq: 300, freqTo: 230, release: 0.06, peak: 0.12, delay: 0.09 });
  },
  /** Шаг на цыпочках — едва слышный шорох. */
  step: (v) => {
    noise(v, { type: 'lowpass', freq: 900, release: 0.05, peak: 0.12 });
  },
  /** Скрипучая половица: долгий скрип. */
  squeak: (v) => {
    creak(v, { freq: 170, freqTo: 120, dur: 0.62, ratchet: 32, peak: 0.55, bright: 1000 });
    creak(v, {
      freq: 260,
      freqTo: 210,
      dur: 0.4,
      ratchet: 45,
      peak: 0.25,
      bright: 1700,
      delay: 0.12,
    });
  },
  /** Ошибка: с полки падает книга — шелест страниц и глухой удар. */
  bookFall: (v) => {
    noise(v, {
      type: 'bandpass',
      freq: 2600,
      freqTo: 1500,
      q: 1.2,
      attack: 0.02,
      release: 0.16,
      peak: 0.25,
    });
    tone(v, { type: 'sine', freq: 150, freqTo: 52, release: 0.22, peak: 0.85, delay: 0.2 });
    noise(v, { type: 'lowpass', freq: 600, release: 0.18, peak: 0.6, delay: 0.2 });
    noise(v, { type: 'bandpass', freq: 1800, q: 0.8, release: 0.1, peak: 0.12, delay: 0.32 });
  },
  /** Полёт словаря: свист. */
  throw: (v) => {
    noise(v, {
      type: 'bandpass',
      freq: 500,
      freqTo: 1800,
      q: 2,
      attack: 0.08,
      release: 0.2,
      peak: 0.3,
    });
  },
  /** Словарь упал: тяжёлый удар. */
  thud: (v) => {
    tone(v, { type: 'sine', freq: 120, freqTo: 42, release: 0.3, peak: 1 });
    noise(v, { type: 'lowpass', freq: 500, freqTo: 200, release: 0.25, peak: 0.8 });
    noise(v, { type: 'bandpass', freq: 2200, q: 1, release: 0.08, peak: 0.15, delay: 0.02 });
  },
  /** Шелест листа. */
  rustle: (v) => {
    for (let i = 0; i < 4; i++) {
      noise(v, {
        type: 'bandpass',
        freq: 3800 + Math.random() * 1500,
        q: 1.5,
        attack: 0.01,
        release: 0.06,
        peak: 0.18,
        delay: i * 0.06,
      });
    }
  },
  /** Взял словарь: глухой шорох. */
  grab: (v) => {
    noise(v, { type: 'lowpass', freq: 1200, release: 0.1, peak: 0.3 });
    tone(v, { type: 'sine', freq: 220, freqTo: 140, release: 0.08, peak: 0.25 });
  },
  /** Нюх: сопение. */
  sniff: (v) => {
    for (let i = 0; i < 3; i++) {
      noise(v, {
        type: 'bandpass',
        freq: 2200,
        freqTo: 3200,
        q: 3,
        attack: 0.05,
        release: 0.07,
        peak: 0.28,
        delay: i * 0.17,
      });
    }
  },
  /** «Wer da?» — короткий вдох. */
  inhale: (v) => {
    noise(v, {
      type: 'highpass',
      freq: 1400,
      freqTo: 2600,
      q: 0.7,
      attack: 0.16,
      release: 0.08,
      peak: 0.3,
    });
    tone(v, {
      type: 'triangle',
      freq: 220,
      freqTo: 330,
      attack: 0.04,
      hold: 0.06,
      release: 0.12,
      peak: 0.12,
      delay: 0.2,
      filter: { type: 'lowpass', freq: 900 },
    });
  },
  /** Бег: шлёпанье тапочек и бренчание ключей. */
  run: (v) => {
    for (let i = 0; i < 4; i++)
      noise(v, { type: 'bandpass', freq: 900, q: 1, release: 0.05, peak: 0.3, delay: i * 0.11 });
    keysJingle({ ...v, gain: v.gain * 1.2 });
  },
  /** Злится: ворчание «хррм». */
  grumble: (v) => {
    tone(v, {
      type: 'sawtooth',
      freq: 95,
      freqTo: 75,
      attack: 0.05,
      hold: 0.25,
      release: 0.2,
      peak: 0.35,
      filter: { type: 'lowpass', freq: 520, q: 2 },
      vibrato: { rate: 19, depth: 0.08 },
    });
  },
  /** Успокоился: вздох. */
  sigh: (v) => {
    noise(v, {
      type: 'bandpass',
      freq: 1100,
      freqTo: 500,
      q: 0.9,
      attack: 0.15,
      hold: 0.1,
      release: 0.45,
      peak: 0.3,
    });
  },
  /** Поимка: хватает за шиворот. */
  grabHero: (v) => {
    noise(v, { type: 'bandpass', freq: 1500, q: 0.7, release: 0.12, peak: 0.3 });
  },
  /** Удар штемпеля. */
  stamp: (v) => {
    tone(v, { type: 'sine', freq: 95, freqTo: 38, release: 0.28, peak: 1 });
    noise(v, { type: 'lowpass', freq: 800, release: 0.12, peak: 0.7 });
    noise(v, { type: 'highpass', freq: 3000, release: 0.03, peak: 0.25 });
  },
  /** Скрип двери. */
  doorCreak: (v) => {
    creak(v, { freq: 140, freqTo: 230, dur: 0.85, ratchet: 26, peak: 0.35, bright: 900 });
  },
  /** Хлопок двери. */
  doorSlam: (v) => {
    tone(v, { type: 'sine', freq: 80, freqTo: 34, release: 0.45, peak: 1 });
    noise(v, { type: 'lowpass', freq: 700, freqTo: 120, release: 0.6, peak: 0.9 });
    noise(v, { type: 'bandpass', freq: 2500, q: 1, release: 0.05, peak: 0.25 });
  },
  /** Храп. */
  snore: (v) => {
    for (let i = 0; i < 2; i++) {
      noise(v, {
        type: 'bandpass',
        freq: 280,
        freqTo: 420,
        q: 4,
        attack: 0.35,
        hold: 0.15,
        release: 0.35,
        peak: 0.45,
        delay: i * 1.3,
      });
      tone(v, {
        type: 'sawtooth',
        freq: 62,
        attack: 0.35,
        hold: 0.15,
        release: 0.35,
        peak: 0.12,
        delay: i * 1.3,
        filter: { type: 'lowpass', freq: 300 },
      });
    }
  },
  /** Победа: тихие весёлые переливы — дорийский лад. */
  win: (v) => {
    const notes = [293.66, 349.23, 440, 587.33, 523.25, 659.25, 587.33];
    notes.forEach((f, i) => {
      tone(v, {
        type: 'triangle',
        freq: f,
        attack: 0.01,
        release: 0.32,
        peak: 0.24,
        delay: i * 0.11,
      });
      tone(v, {
        type: 'sine',
        freq: f * 2,
        attack: 0.005,
        release: 0.18,
        peak: 0.06,
        delay: i * 0.11,
      });
    });
  },
};
