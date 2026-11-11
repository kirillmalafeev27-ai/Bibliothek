import { balance } from '../src/config/balance';
import type { LevelConfig } from '../src/config/levels';
import { effectiveHints, levelById } from '../src/config/levels';
import type { Action, Cell, GameEvent, GameState, Librarian, Library, Tile } from '../src/core';
import { STAY, TILE, createState, reduce } from '../src/core';

/** Стандартная тестовая библиотека: по два прохода в ряду, без скрипучих половиц. */
export const PLAIN_MAP = [
  '#########',
  '#.......#',
  '#.##.##.#',
  '#.......#',
  '#.##.##.#',
  '#.......#',
  '#.##.##.#',
  '#.......#',
  '#.##.##.#',
  '#.......#',
  '####D####',
];

export function parseMap(rows: readonly string[], desks: Cell[] = [{ x: 1, y: 1 }]): Library {
  const h = rows.length;
  const w = (rows[0] as string).length;
  const tiles: Tile[] = [];
  let door: Cell = { x: 4, y: h - 1 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = (rows[y] as string)[x];
      if (ch === '#') tiles.push(TILE.shelf);
      else if (ch === '~') tiles.push(TILE.squeak);
      else if (ch === 'D') {
        tiles.push(TILE.door);
        door = { x, y };
      } else tiles.push(TILE.floor);
    }
  }
  return { w, h, tiles, door, start: { x: door.x, y: door.y - 1 }, desks };
}

export interface StateSpec {
  level?: number | LevelConfig;
  levelPatch?: Partial<LevelConfig>;
  map?: readonly string[];
  hero?: Cell;
  heroBooks?: number;
  cards?: number;
  pages?: Cell[];
  heroPages?: number[];
  books?: Cell[];
  librarians?: Partial<Librarian>[];
  seed?: number;
}

/** Собирает состояние с заданной вручную расстановкой. */
export function makeState(spec: StateSpec = {}): GameState {
  const baseLevel = typeof spec.level === 'object' ? spec.level : levelById(spec.level ?? 1);
  const level: LevelConfig = { ...baseLevel, ...spec.levelPatch };
  const base = createState(level, spec.seed ?? 1);
  const libs = spec.librarians ?? [{}];
  const desks = libs.map((l, i) => l.desk ?? l.cell ?? ({ x: i === 0 ? 1 : 7, y: 1 } as Cell));
  const lib = parseMap(spec.map ?? PLAIN_MAP, desks);
  const librarians: Librarian[] = libs.map((l, id) => ({
    id,
    cell: desks[id] as Cell,
    from: null,
    mode: 'listen',
    timer: balance.firstListenA * base.unitA,
    stepDur: 0,
    target: null,
    sniffed: false,
    atWaypoint: true,
    burstLeft: balance.burst,
    anger: 0,
    nextSniffAt: level.sniffA * base.unitA,
    desk: desks[id] as Cell,
    cause: null,
    ...l,
  }));
  return {
    ...base,
    level,
    hints: effectiveHints(level),
    lib,
    pages: (spec.pages ?? []).map((cell, id) => ({ cell, id })),
    books: spec.books ?? [],
    hero: {
      cell: spec.hero ?? lib.start,
      faceX: 1,
      faceY: -1,
      books: spec.heroBooks ?? level.startBooks,
      pages: spec.heroPages ?? [],
      cards: spec.cards ?? level.cards,
      intent: STAY,
      resume: null,
      ready: false,
    },
    librarians,
  };
}

export interface Run {
  state: GameState;
  events: GameEvent[];
}

export function apply(state: GameState, ...actions: Action[]): Run {
  let s = state;
  const events: GameEvent[] = [];
  for (const a of actions) {
    const r = reduce(s, a);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

/** Продвигает время мира на `seconds` мелкими тиками. */
export function advance(state: GameState, seconds: number, step = 0.05): Run {
  let s = state;
  const events: GameEvent[] = [];
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    const r = reduce(s, { type: 'TICK', dt });
    s = r.state;
    events.push(...r.events);
    left -= dt;
  }
  return { state: s, events };
}

/** Тикает, пока не выполнится условие (или не выйдет время). */
export function advanceUntil(
  state: GameState,
  pred: (s: GameState, events: GameEvent[]) => boolean,
  maxSeconds = 600,
  step = 0.05,
): Run {
  let s = state;
  const events: GameEvent[] = [];
  let t = 0;
  while (t < maxSeconds) {
    const r = reduce(s, { type: 'TICK', dt: step });
    s = r.state;
    events.push(...r.events);
    t += step;
    if (pred(s, r.events)) break;
  }
  return { state: s, events };
}

export const A = (s: GameState, units: number): number => units * s.unitA;

export function ofType<T extends GameEvent['type']>(
  events: GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}

export const correct: Action = { type: 'ANSWER', correct: true, timeMs: 3000 };
export const wrong: Action = { type: 'ANSWER', correct: false, timeMs: 3000 };
export const moveTo = (x: number, y: number): Action => ({
  type: 'SET_INTENT',
  kind: 'move',
  cell: { x, y },
});
export const throwTo = (x: number, y: number): Action => ({
  type: 'SET_INTENT',
  kind: 'throw',
  cell: { x, y },
});
export const stay: Action = { type: 'SET_INTENT', kind: 'stay' };
