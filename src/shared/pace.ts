/**
 * Учёт темпа игрока — общий для серии (план, раздел 3).
 * T_med — медиана времени ответа по последним 20 ответам; p — доля верных по последним 30.
 * Хранится между сессиями под общим ключом `series:pace`, фиксируется на старте раунда.
 */
import type { KeyValueStorage } from './storage';

export const PACE_KEY = 'series:pace';

export interface PaceConfig {
  defaultTmedSec: number;
  minTmedSec: number;
  maxTmedSec: number;
  tmedWindow: number;
  defaultP: number;
  minP: number;
  maxP: number;
  pWindow: number;
}

interface PaceData {
  /** Времена ответов, с (последние, от старых к новым). */
  times: number[];
  /** Верно ли отвечено (1 или 0), последние. */
  hits: number[];
}

/** Меньше стольких ответов — медиана ещё ненадёжна, используется значение по умолчанию. */
const MIN_SAMPLES = 5;

export class Pace {
  private data: PaceData = { times: [], hits: [] };

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly cfg: PaceConfig,
  ) {
    this.load();
  }

  private load(): void {
    const raw = this.storage.get(PACE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<PaceData>;
      const nums = (v: unknown): number[] =>
        Array.isArray(v)
          ? v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
          : [];
      this.data = {
        times: nums(parsed.times).slice(-this.cfg.tmedWindow),
        hits: nums(parsed.hits).slice(-this.cfg.pWindow),
      };
    } catch {
      this.data = { times: [], hits: [] };
    }
  }

  private save(): void {
    this.storage.set(PACE_KEY, JSON.stringify(this.data));
  }

  /**
   * Учитывает ответ. `paced = false` — вопрос был на экране, пока герой был в кольце
   * громкого слуха: такое время в T_med не идёт (игрок нарочно медлил), а в p — идёт.
   */
  record(correct: boolean, timeMs: number, paced: boolean): void {
    this.data.hits.push(correct ? 1 : 0);
    if (this.data.hits.length > this.cfg.pWindow) this.data.hits.shift();
    if (paced && Number.isFinite(timeMs) && timeMs > 0) {
      this.data.times.push(timeMs / 1000);
      if (this.data.times.length > this.cfg.tmedWindow) this.data.times.shift();
    }
    this.save();
  }

  /** Медиана времени ответа, с — в допустимых пределах. */
  tMedSec(): number {
    const t = this.data.times;
    if (t.length < MIN_SAMPLES) return this.cfg.defaultTmedSec;
    const sorted = t.slice().sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    const med =
      sorted.length % 2 === 1
        ? (sorted[mid] as number)
        : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
    return Math.min(this.cfg.maxTmedSec, Math.max(this.cfg.minTmedSec, med));
  }

  /** Доля верных ответов — в допустимых пределах. */
  accuracy(): number {
    const h = this.data.hits;
    if (h.length < MIN_SAMPLES) return this.cfg.defaultP;
    const p = h.reduce((a, b) => a + b, 0) / h.length;
    return Math.min(this.cfg.maxP, Math.max(this.cfg.minP, p));
  }

  samples(): number {
    return this.data.times.length;
  }
}
