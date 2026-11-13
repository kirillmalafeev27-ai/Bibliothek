/**
 * Переключатель качества — общий для серии (план, 13.6).
 * Два уровня. Низкое: текстуры 64 px на клетку, без блика золота, половина частиц,
 * маргиналии неподвижны. Если средний FPS три секунды подряд ниже 45, игра один раз
 * за сессию сама переходит на низкое качество и тихо отмечает это в настройках.
 */
export type QualityLevel = 'high' | 'low';
export type MotionPref = 'auto' | 'reduced' | 'full';

export interface QualityConfig {
  lowFpsThreshold: number;
  lowFpsSeconds: number;
}

type Listener = () => void;

export class Quality {
  private _level: QualityLevel;
  private _motion: MotionPref;
  private autoLowered = false;
  private belowFor = 0;
  private frames = 0;
  private windowSec = 0;
  private listeners = new Set<Listener>();
  private media: MediaQueryList | null = null;
  private readonly onMedia = (): void => this.emit();

  constructor(
    private readonly cfg: QualityConfig,
    level: QualityLevel = 'high',
    motion: MotionPref = 'auto',
  ) {
    this._level = level;
    this._motion = motion;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.media = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.media.addEventListener?.('change', this.onMedia);
    }
  }

  get level(): QualityLevel {
    return this._level;
  }

  get low(): boolean {
    return this._level === 'low';
  }

  get motionPref(): MotionPref {
    return this._motion;
  }

  /**
   * «Меньше движения» включается сам по prefers-reduced-motion или вручную (11.6.1):
   * без тряски, зума, блика золота и пульсаций.
   */
  get reducedMotion(): boolean {
    if (this._motion === 'reduced') return true;
    if (this._motion === 'full') return false;
    return this.media?.matches ?? false;
  }

  /** Игра сама снизила качество в этой сессии. */
  get wasAutoLowered(): boolean {
    return this.autoLowered;
  }

  /** Блик золота: только на высоком качестве и без «меньше движения» (8.5). */
  get goldGlint(): boolean {
    return !this.low && !this.reducedMotion;
  }

  /** Множитель числа частиц. */
  get particleScale(): number {
    return this.low ? 0.5 : 1;
  }

  setLevel(level: QualityLevel): void {
    if (this._level === level) return;
    this._level = level;
    this.emit();
  }

  setMotion(pref: MotionPref): void {
    if (this._motion === pref) return;
    this._motion = pref;
    this.emit();
  }

  /**
   * Учитывает кадр. Возвращает true в тот момент, когда качество автоматически снижено.
   * Срабатывает один раз за сессию.
   */
  frame(dtSec: number): boolean {
    if (this.autoLowered || this.low || dtSec <= 0) return false;
    this.frames += 1;
    this.windowSec += dtSec;
    if (this.windowSec < 0.5) return false;
    const fps = this.frames / this.windowSec;
    this.belowFor = fps < this.cfg.lowFpsThreshold ? this.belowFor + this.windowSec : 0;
    this.frames = 0;
    this.windowSec = 0;
    if (this.belowFor >= this.cfg.lowFpsSeconds) {
      this.autoLowered = true;
      this._level = 'low';
      this.emit();
      return true;
    }
    return false;
  }

  /** Вкладка была скрыта или игра стояла на паузе: замер начинается заново. */
  resetMeter(): void {
    this.belowFor = 0;
    this.frames = 0;
    this.windowSec = 0;
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  destroy(): void {
    this.media?.removeEventListener?.('change', this.onMedia);
    this.listeners.clear();
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}
