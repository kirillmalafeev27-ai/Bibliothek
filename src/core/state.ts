/**
 * GameState — чистые данные раунда (план, 13.3.1).
 * Состояние меняется только через reduce(state, action) из rules.ts.
 */
import { balance } from '../config/balance';
import type { HintSet, LevelConfig } from '../config/levels';
import { effectiveHints } from '../config/levels';
import type { Cell, Library } from './library';
import type { SoundKind } from './hearing';
import { generateLevel } from './levelGen';
import { mixSeed } from './rng';

/** Состояния библиотекаря (2.3). */
export type LibrarianMode =
  /** Стоит и слушает, вокруг нимб. */
  | 'listen'
  /** Шаркает к точке маршрута. */
  | 'walk'
  /** «Wer da?» — замер перед бегом. */
  | 'alert'
  /** Бежит на звук. */
  | 'run'
  /** Добежал и слушает, снова с нимбом. */
  | 'search'
  /** Подшивает отобранный билет у стола. */
  | 'file';

/** Что привело библиотекаря к герою — для статистики причин поимки (раздел 14.4). */
export type HuntCause = SoundKind | 'sniff' | null;

export interface Librarian {
  id: number;
  cell: Cell;
  /** Клетка, с которой он только что пришёл (для плавной отрисовки); null — стоит. */
  from: Cell | null;
  mode: LibrarianMode;
  /** Секунд до конца текущего состояния или до следующего шага. */
  timer: number;
  /** Полная длительность текущего шага, с (0 — стоит). */
  stepDur: number;
  /** Цель: точка маршрута или клетка звука. Её показывает маникула (2.8.3). */
  target: Cell | null;
  /** Точка маршрута выбрана нюхом — маникула золотая. */
  sniffed: boolean;
  /** Слушает в точке маршрута: после остановки выберет новую точку. */
  atWaypoint: boolean;
  /** Сколько клеток осталось до остановки послушать. */
  burstLeft: number;
  anger: number;
  /** Время мира, когда он принюхается в следующий раз. */
  nextSniffAt: number;
  desk: Cell;
  cause: HuntCause;
}

export type Intent =
  { kind: 'stay' } | { kind: 'move'; cell: Cell } | { kind: 'throw'; cell: Cell };

export const STAY: Intent = { kind: 'stay' };

export interface Hero {
  cell: Cell;
  /** Куда герой смотрит: −1 влево, 1 вправо (по x библиотеки) и −1 вверх, 1 вниз по y. */
  faceX: number;
  faceY: number;
  /** Словари в руках. */
  books: number;
  /** Собранные части карты (номера 0–2). */
  pages: number[];
  /** Читательские билеты. */
  cards: number;
  intent: Intent;
  /** Цель ходьбы, к которой герой вернётся после броска. */
  resume: Cell | null;
  /** Готовое действие: верный ответ без намерения копится, но не больше одного (2.2.4). */
  ready: boolean;
}

export interface FloorPage {
  cell: Cell;
  /** Номер части карты, 0–2. */
  id: number;
}

export interface Stats {
  correct: number;
  wrong: number;
  steps: number;
  /** Сколько раз героя услышали: ошибка, скрип, шаг (словари не считаются). */
  heard: number;
  heardBy: Record<Exclude<SoundKind, 'book'>, number>;
  throws: number;
  caught: number;
  caughtBy: Record<'error' | 'squeak' | 'step' | 'sniff' | 'other', number>;
  /** Игровое время раунда, с (без пауз и сцен поимки). */
  timeSec: number;
}

export type Status = 'playing' | 'catchScene' | 'won' | 'lost';

export interface DebugFlags {
  /** Библиотекари ничего не слышат. */
  deaf: boolean;
  /** Билеты не отбираются. */
  infiniteCards: boolean;
}

export interface GameState {
  readonly level: LevelConfig;
  readonly hints: HintSet;
  readonly seed: number;
  readonly lib: Library;
  /** Длительность единицы A в секундах, зафиксирована на раунд (раздел 3). */
  readonly unitA: number;
  /** Состояние сидированного генератора (точки маршрута библиотекарей). */
  rng: number;
  /** Время мира, с. Стоит на паузе и в сцене поимки. */
  time: number;
  pages: FloorPage[];
  /** Словари на полу; на одной клетке их может лежать несколько. */
  books: Cell[];
  hero: Hero;
  librarians: Librarian[];
  stats: Stats;
  status: Status;
  /** Сколько секунд осталось стоять часам мира в сцене поимки (2.6.3). */
  sceneLeft: number;
  paused: boolean;
  /**
   * Текущий вопрос был на экране, пока герой был в кольце громкого слуха:
   * такой ответ не учитывается в T_med (раздел 3.2).
   */
  questionTainted: boolean;
  debug: DebugFlags;
}

export interface CreateOptions {
  /** Медиана времени ответа игрока, с. */
  tMedSec?: number;
  /** Подсказки, выключенные игроком в настройках. */
  hintsOff?: Partial<HintSet>;
}

export function unitSeconds(tMedSec: number): number {
  const t = Math.min(balance.pace.maxTmedSec, Math.max(balance.pace.minTmedSec, tMedSec));
  return t + balance.unitOverheadSec;
}

export function createState(level: LevelConfig, seed: number, opts: CreateOptions = {}): GameState {
  const layout = generateLevel(level, seed);
  const unitA = unitSeconds(opts.tMedSec ?? balance.pace.defaultTmedSec);
  const librarians: Librarian[] = layout.lib.desks.map((desk, id) => ({
    id,
    cell: desk,
    from: null,
    mode: 'listen',
    // Начало ночи: 2 единицы слушает у стола, потом начинает ходить (2.3.10).
    timer: balance.firstListenA * unitA,
    stepDur: 0,
    target: null,
    sniffed: false,
    atWaypoint: true,
    burstLeft: balance.burst,
    anger: 0,
    // Второй библиотекарь принюхивается со сдвигом в полпериода: к герою приходят волнами.
    nextSniffAt: level.sniffA * unitA * (1 + id * 0.5),
    desk,
    cause: null,
  }));
  return {
    level,
    hints: effectiveHints(level, opts.hintsOff),
    seed,
    lib: layout.lib,
    unitA,
    rng: mixSeed(seed, 0x51b),
    time: 0,
    pages: layout.pages.map((cell, id) => ({ cell, id })),
    books: layout.books.slice(),
    hero: {
      cell: layout.lib.start,
      faceX: 1,
      faceY: -1,
      books: level.startBooks,
      pages: [],
      cards: level.cards,
      intent: STAY,
      resume: null,
      ready: false,
    },
    librarians,
    stats: {
      correct: 0,
      wrong: 0,
      steps: 0,
      heard: 0,
      heardBy: { error: 0, squeak: 0, step: 0 },
      throws: 0,
      caught: 0,
      caughtBy: { error: 0, squeak: 0, step: 0, sniff: 0, other: 0 },
      timeSec: 0,
    },
    status: 'playing',
    sceneLeft: 0,
    paused: false,
    questionTainted: false,
    debug: { deaf: false, infiniteCards: false },
  };
}

/** Неглубокая копия с копиями всего, что редуктор меняет. Карта неизменна и общая. */
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    pages: s.pages.slice(),
    books: s.books.slice(),
    hero: { ...s.hero, pages: s.hero.pages.slice() },
    librarians: s.librarians.map((m) => ({ ...m })),
    stats: { ...s.stats, heardBy: { ...s.stats.heardBy }, caughtBy: { ...s.stats.caughtBy } },
    debug: { ...s.debug },
  };
}

/** Звёзды (2.6.5): ★ вышел с картой, ★★ не пойман, ★★★ ни разу не услышан. */
export function starsOf(s: GameState): 0 | 1 | 2 | 3 {
  if (s.status !== 'won') return 0;
  if (s.stats.caught > 0) return 1;
  if (s.stats.heard > 0) return 2;
  return 3;
}

export function hasAllPages(s: GameState): boolean {
  return s.hero.pages.length >= balance.pages;
}
