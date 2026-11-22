/**
 * Таблица уровней (план, раздел 4). Числа стартовые из плана; подстройка — по итогам
 * симуляции (раздел 14), с записью в DECISIONS.md.
 */

export interface HintSet {
  /** Отпечатки тапочек — следующие клетки пути библиотекаря (2.8.4). */
  librarianPath: boolean;
  /** Кольцо громкого слуха и строка «Тихо: ошибку услышит» (2.8.2). */
  loudRing: boolean;
  /** Красный след следующего шага (2.8.5). */
  redStep: boolean;
  /** Круг броска с путём библиотекаря (2.8.6). */
  throwCircle: boolean;
  /** Осторожный шаг: герой не шагает в нимб (2.2.8). */
  cautiousStep: boolean;
}

export type HintPreset = 'all' | 'ringStepCircle' | 'step' | 'none';

export const hintPresets: Record<HintPreset, HintSet> = {
  all: {
    librarianPath: true,
    loudRing: true,
    redStep: true,
    throwCircle: true,
    cautiousStep: true,
  },
  ringStepCircle: {
    librarianPath: false,
    loudRing: true,
    redStep: true,
    throwCircle: true,
    cautiousStep: false,
  },
  step: {
    librarianPath: false,
    loudRing: false,
    redStep: true,
    throwCircle: false,
    cautiousStep: false,
  },
  none: {
    librarianPath: false,
    loudRing: false,
    redStep: false,
    throwCircle: false,
    cautiousStep: false,
  },
};

export interface LevelConfig {
  /** 1–6, бесконечный уровень — 7. */
  id: number;
  endless: boolean;
  /** Читательские билеты (2.6.3). */
  cards: number;
  librarians: 1 | 2;
  /** Радиус громкого слуха, клеток (2.4.2). */
  loudR: number;
  /** Бег на звук: A на клетку (2.3.3). */
  huntStepA: number;
  /** Ходьба: A на клетку (2.3.1). */
  walkStepA: number;
  /** «Wer da?»: сколько A он стоит, прежде чем побежать (2.3.3). */
  alertA: number;
  /** Нюх раз в столько A (2.3.5). */
  sniffA: number;
  /** Растёт ли злость (2.3.6). */
  anger: boolean;
  /** Словари: с собой и на полу (2.5.1). */
  startBooks: number;
  floorBooks: number;
  /** Скрипучих половиц (2.1.3). */
  squeaks: number;
  hintPreset: HintPreset;
}

export const levels: readonly LevelConfig[] = [
  {
    id: 1,
    endless: false,
    cards: 2,
    librarians: 1,
    loudR: 3.0,
    huntStepA: 1.8,
    walkStepA: 1.8,
    alertA: 1.2,
    sniffA: 16,
    anger: false,
    startBooks: 3,
    floorBooks: 2,
    squeaks: 0,
    hintPreset: 'all',
  },
  {
    id: 2,
    endless: false,
    cards: 2,
    librarians: 1,
    loudR: 3.0,
    huntStepA: 1.6,
    walkStepA: 1.7,
    alertA: 1.0,
    sniffA: 14,
    anger: true,
    startBooks: 2,
    floorBooks: 2,
    squeaks: 3,
    hintPreset: 'all',
  },
  {
    id: 3,
    endless: false,
    cards: 2,
    librarians: 1,
    loudR: 3.5,
    huntStepA: 1.4,
    walkStepA: 1.5,
    alertA: 0.8,
    sniffA: 10,
    anger: true,
    startBooks: 2,
    floorBooks: 2,
    squeaks: 6,
    hintPreset: 'all',
  },
  {
    id: 4,
    endless: false,
    cards: 2,
    librarians: 1,
    loudR: 4.0,
    huntStepA: 1.25,
    walkStepA: 1.45,
    alertA: 0.8,
    sniffA: 9,
    anger: true,
    startBooks: 2,
    floorBooks: 1,
    squeaks: 7,
    hintPreset: 'ringStepCircle',
  },
  {
    id: 5,
    endless: false,
    cards: 2,
    librarians: 1,
    loudR: 4.0,
    huntStepA: 1.15,
    walkStepA: 1.4,
    alertA: 0.7,
    sniffA: 8,
    anger: true,
    startBooks: 1,
    floorBooks: 2,
    squeaks: 8,
    hintPreset: 'ringStepCircle',
  },
  {
    id: 6,
    endless: false,
    cards: 2,
    librarians: 2,
    loudR: 3.5,
    huntStepA: 1.5,
    walkStepA: 1.7,
    alertA: 0.8,
    sniffA: 14,
    anger: true,
    startBooks: 2,
    floorBooks: 2,
    squeaks: 5,
    hintPreset: 'step',
  },
  {
    id: 7,
    endless: true,
    cards: 1,
    librarians: 2,
    loudR: 3.5,
    huntStepA: 1.5,
    walkStepA: 1.7,
    alertA: 0.8,
    sniffA: 14,
    anger: true,
    startBooks: 2,
    floorBooks: 2,
    squeaks: 5,
    hintPreset: 'none',
  },
];

export const LEVEL_COUNT = levels.length;

export function levelById(id: number): LevelConfig {
  const lvl = levels.find((l) => l.id === id);
  if (!lvl) throw new Error(`Unknown level ${id}`);
  return lvl;
}

/** Подсказки уровня с учётом настроек игрока: выключить можно, включить сверх уровня — нет (11.5.6). */
export function effectiveHints(level: LevelConfig, userOff?: Partial<HintSet>): HintSet {
  const base = hintPresets[level.hintPreset];
  if (!userOff) return { ...base };
  return {
    librarianPath: base.librarianPath && userOff.librarianPath !== false,
    loudRing: base.loudRing && userOff.loudRing !== false,
    redStep: base.redStep && userOff.redStep !== false,
    throwCircle: base.throwCircle && userOff.throwCircle !== false,
    cautiousStep: base.cautiousStep && userOff.cautiousStep !== false,
  };
}
