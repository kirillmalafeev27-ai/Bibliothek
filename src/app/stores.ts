/**
 * Настройки и прогресс игрока. Хранятся с префиксом `library:` (план, 13.4).
 */
import type { HintSet } from '../config/levels';
import { LEVEL_COUNT } from '../config/levels';
import type { SfxLang } from '../i18n/sfx.de';
import type { MotionPref, QualityLevel } from '../shared/quality';
import type { KeyValueStorage } from '../shared/storage';
import { readJson, writeJson } from '../shared/storage';

export const STORAGE_PREFIX = 'library:';

export type TutorialKey = 'move' | 'listen' | 'earshot' | 'throw' | 'caught';

export interface SettingsData {
  sound: boolean;
  sfx: number;
  ambient: number;
  motion: MotionPref;
  quality: QualityLevel;
  /** Игра сама снизила качество — тихая пометка в настройках (13.6.4). */
  qualityAuto: boolean;
  /** Подсказки, выключенные игроком (false — выключена). */
  hintsOff: Partial<HintSet>;
  sfxLang: SfxLang;
  /** Какие подсказки обучения уже показаны (каждая — один раз). */
  tutorial: Partial<Record<TutorialKey, boolean>>;
}

const DEFAULT_SETTINGS: SettingsData = {
  sound: true,
  sfx: 0.8,
  ambient: 0.6,
  motion: 'auto',
  quality: 'high',
  qualityAuto: false,
  hintsOff: {},
  sfxLang: 'de',
  tutorial: {},
};

type Listener = () => void;

export class Settings {
  data: SettingsData;
  private listeners = new Set<Listener>();

  constructor(private readonly storage: KeyValueStorage) {
    const raw = readJson<SettingsData>(storage, 'settings', DEFAULT_SETTINGS);
    this.data = {
      ...DEFAULT_SETTINGS,
      ...raw,
      hintsOff: { ...(raw.hintsOff ?? {}) },
      tutorial: { ...(raw.tutorial ?? {}) },
    };
  }

  update(patch: Partial<SettingsData>): void {
    this.data = { ...this.data, ...patch };
    writeJson(this.storage, 'settings', this.data);
    for (const fn of this.listeners) fn();
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  tutorialSeen(key: TutorialKey): boolean {
    return this.data.tutorial[key] === true;
  }

  markTutorial(key: TutorialKey): void {
    this.update({ tutorial: { ...this.data.tutorial, [key]: true } });
  }

  resetTutorial(): void {
    this.update({ tutorial: {} });
  }
}

export interface LevelRecord {
  stars: number;
  /** Лучшее время победы, с. */
  timeSec: number;
  wins: number;
}

export interface ProgressData {
  /** Наибольший открытый уровень. */
  unlocked: number;
  records: Record<string, LevelRecord>;
}

export class Progress {
  data: ProgressData;

  constructor(private readonly storage: KeyValueStorage) {
    const raw = readJson<ProgressData>(storage, 'progress', { unlocked: 1, records: {} });
    this.data = {
      unlocked: Math.min(LEVEL_COUNT, Math.max(1, Math.floor(Number(raw.unlocked) || 1))),
      records: { ...(raw.records ?? {}) },
    };
  }

  isUnlocked(level: number): boolean {
    return level <= this.data.unlocked;
  }

  record(level: number): LevelRecord | null {
    return this.data.records[String(level)] ?? null;
  }

  /**
   * Запоминает итог раунда. Следующий уровень открывается после победы с любым числом
   * звёзд (раздел 4.4). Возвращает true, если поставлен новый рекорд.
   */
  save(level: number, won: boolean, stars: number, timeSec: number): boolean {
    if (!won) return false;
    const prev = this.record(level);
    const better = !prev || stars > prev.stars || (stars === prev.stars && timeSec < prev.timeSec);
    this.data.records[String(level)] = {
      stars: Math.max(stars, prev?.stars ?? 0),
      timeSec: better ? timeSec : (prev?.timeSec ?? timeSec),
      wins: (prev?.wins ?? 0) + 1,
    };
    if (level >= this.data.unlocked && level < LEVEL_COUNT) this.data.unlocked = level + 1;
    writeJson(this.storage, 'progress', this.data);
    return better;
  }
}
