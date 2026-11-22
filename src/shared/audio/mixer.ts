/**
 * Звуковой микшер серии (план, 10.1, 10.7, 10.8): AudioContext запускается по первому
 * жесту, до этого — тишина без ошибок. Две шины — эффекты и эмбиент — с отдельной
 * громкостью и общим выключателем; приглушение эмбиента; пауза.
 */
import type { Voice } from './synth';

export interface MixerSettings {
  on: boolean;
  sfx: number;
  ambient: number;
}

export class Mixer {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private ambDuck: GainNode | null = null;
  private settings: MixerSettings = { on: true, sfx: 0.8, ambient: 0.6 };
  private paused = false;
  private duck = 1;
  private failed = false;

  /** Создаёт и будит AudioContext. Вызывать только из обработчика жеста пользователя. */
  unlock(): boolean {
    if (this.failed) return false;
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
          this.failed = true;
          return false;
        }
        const ctx = new Ctor();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.sfxBus = ctx.createGain();
        this.ambBus = ctx.createGain();
        this.ambDuck = ctx.createGain();
        // Мягкий компрессор, чтобы громкие удары не хрипели.
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 3.5;
        this.sfxBus.connect(this.master);
        this.ambBus.connect(this.ambDuck).connect(this.master);
        this.master.connect(comp).connect(ctx.destination);
        this.apply();
      } catch {
        this.failed = true;
        return false;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return true;
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state !== 'closed';
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  set(settings: MixerSettings): void {
    this.settings = { ...settings };
    this.apply();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.apply();
  }

  /** Приглушение эмбиента: 1 — полная громкость, 0.6 — на 40% тише (10.5). */
  setAmbientDuck(level: number): void {
    if (Math.abs(level - this.duck) < 0.01) return;
    this.duck = level;
    if (this.ctx && this.ambDuck)
      this.ambDuck.gain.setTargetAtTime(level, this.ctx.currentTime, 0.25);
  }

  private apply(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.sfxBus || !this.ambBus) return;
    const t = ctx.currentTime;
    const masterLevel = this.settings.on ? (this.paused ? 0.25 : 1) : 0;
    this.master.gain.setTargetAtTime(masterLevel, t, 0.08);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx * 0.9, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.settings.ambient * 0.8, t, 0.05);
  }

  /** Голос для звука эффектов: своя панорама и громкость. */
  voice(
    pan: number,
    gain: number,
    pitch = 1,
    bus: 'sfx' | 'ambient' = 'sfx',
    delay = 0,
  ): Voice | null {
    const ctx = this.ctx;
    const target = bus === 'sfx' ? this.sfxBus : this.ambBus;
    if (!ctx || !target || !this.settings.on) return null;
    let out: AudioNode = target;
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(target);
      out = p;
      // Панорама живёт столько же, сколько звук; сборщик мусора уберёт её сам.
    }
    return { ctx, out, t: ctx.currentTime + 0.005 + delay, pitch, gain };
  }

  destroy(): void {
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }
}
