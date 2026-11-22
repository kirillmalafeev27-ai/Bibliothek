/**
 * Генерация уровня (план, раздел 5). Детерминирована сидом.
 */
import { balance } from '../config/balance';
import type { LevelConfig } from '../config/levels';
import type { Cell, Library, Tile } from './library';
import { TILE, cellIndex, sameCell } from './library';
import { allFloorConnected, distanceMap, squeaksAvoidable } from './pathfinding';
import { Rng, mixSeed } from './rng';

export interface LevelLayout {
  lib: Library;
  /** Три листа карты: клетки пола. */
  pages: Cell[];
  /** Словари на полу. */
  books: Cell[];
  /** Длина кратчайшего обхода «старт → все листы → дверь», шагов. */
  tour: number;
  /** Сколько попыток понадобилось. */
  attempts: number;
  /** Предупреждения генератора (например, расширение диапазона обхода). */
  warnings: string[];
}

const SQUEAK_REROLLS = 30;
const PAGE_REROLLS = 12;

interface Draft {
  tiles: Tile[];
  door: Cell;
  start: Cell;
}

function buildRoom(rng: Rng, level: LevelConfig): Draft {
  const { w, h } = balance.grid;
  const tiles: Tile[] = new Array<Tile>(w * h).fill(TILE.shelf);
  const set = (x: number, y: number, t: Tile): void => {
    tiles[y * w + x] = t;
  };
  // Проходы во всю ширину — между рядами стеллажей (2.1.2).
  for (let y = 1; y < h - 1; y++) {
    if ((balance.shelfRows as readonly number[]).includes(y)) continue;
    for (let x = 1; x < w - 1; x++) set(x, y, TILE.floor);
  }
  // В каждом ряду стеллажей 2–3 прохода в случайных колонках.
  for (const y of balance.shelfRows) {
    const count = rng.range(balance.gapsPerRow.min, balance.gapsPerRow.max);
    const cols: number[] = [];
    for (let x = 1; x < w - 1; x++) {
      // Столы двух библиотекарей стоят в дальних углах: проход прямо под столом не делаем,
      // чтобы библиотекарь не выходил «сквозь» конторку (см. DECISIONS.md).
      if (level.librarians === 2 && y === balance.shelfRows[0] && (x === 1 || x === w - 2))
        continue;
      cols.push(x);
    }
    rng.shuffle(cols);
    for (const x of cols.slice(0, count)) set(x, y, TILE.floor);
  }
  const door: Cell = { x: Math.floor(w / 2), y: h - 1 };
  const start: Cell = { x: door.x, y: door.y - 1 };
  set(door.x, door.y, TILE.door);
  return { tiles, door, start };
}

function pickDesks(draft: Draft, level: LevelConfig): Cell[] {
  const { w, h } = balance.grid;
  if (level.librarians === 2) {
    return [
      { x: 1, y: 1 },
      { x: w - 2, y: 1 },
    ];
  }
  const probe: Library = {
    w,
    h,
    tiles: draft.tiles,
    door: draft.door,
    start: draft.start,
    desks: [],
  };
  const dist = distanceMap(probe, draft.start);
  // Самая далёкая по пути от старта клетка ряда 1 (раздел 5, пункт 3). Клетки прямо над
  // проходом не берём: стол у стены не должен стоять в проёме.
  let best: Cell | null = null;
  let bestD = -1;
  for (const strict of [true, false]) {
    for (let x = 1; x < w - 1; x++) {
      if (strict && draft.tiles[2 * w + x] !== TILE.shelf) continue;
      const d = dist[1 * w + x] as number;
      if (d > bestD) {
        bestD = d;
        best = { x, y: 1 };
      }
    }
    if (best) break;
  }
  return [best ?? { x: 1, y: 1 }];
}

type MapOf = (c: Cell) => Int16Array;

/** Карты расстояний с кэшем по клетке: в одной комнате они нужны много раз. */
function mapCache(lib: Library): MapOf {
  const cache = new Map<number, Int16Array>();
  return (c) => {
    const key = cellIndex(lib, c.x, c.y);
    let map = cache.get(key);
    if (!map) {
      map = distanceMap(lib, c);
      cache.set(key, map);
    }
    return map;
  };
}

const ORDERS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

/** Кратчайший обход «старт → все листы в лучшем порядке → дверь» (перебор 6 порядков). */
export function tourLength(
  lib: Library,
  pages: readonly Cell[],
  mapOf: MapOf = mapCache(lib),
): number {
  const fromStart = mapOf(lib.start);
  const at = (map: Int16Array, c: Cell): number => map[cellIndex(lib, c.x, c.y)] as number;
  let best = Infinity;
  for (const [i, j, k] of ORDERS) {
    const a = pages[i] as Cell;
    const b = pages[j] as Cell;
    const c = pages[k] as Cell;
    // Дверь примыкает только к стартовой клетке: до двери — путь до старта плюс шаг.
    const len = at(fromStart, a) + at(mapOf(a), b) + at(mapOf(b), c) + at(fromStart, c) + 1;
    if (len < best) best = len;
  }
  return best;
}

function placePages(rng: Rng, lib: Library, tourMin: number, tourMax: number): Cell[] | null {
  const { w, h } = balance.grid;
  const mapOf = mapCache(lib);
  const fromStart = mapOf(lib.start);
  const candidates: Cell[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const t = lib.tiles[y * w + x];
      if (t !== TILE.floor) continue;
      if ((fromStart[y * w + x] as number) < balance.pageMinSteps) continue;
      if (lib.desks.some((dk) => dk.x === x && dk.y === y)) continue;
      candidates.push({ x, y });
    }
  }
  for (let attempt = 0; attempt < PAGE_REROLLS; attempt++) {
    const picked: Cell[] = [];
    let pool = candidates;
    for (let k = 0; k < balance.pages && pool.length > 0; k++) {
      const p = rng.pick(pool);
      picked.push(p);
      const map = mapOf(p);
      pool = pool.filter((c) => (map[cellIndex(lib, c.x, c.y)] as number) >= balance.pageMinSteps);
    }
    if (picked.length < balance.pages) continue;
    const tour = tourLength(lib, picked, mapOf);
    if (tour >= tourMin && tour <= tourMax) return picked;
  }
  return null;
}

function placeItems(
  rng: Rng,
  draft: Draft,
  level: LevelConfig,
  pages: readonly Cell[],
): Cell[] | null {
  const { w, h } = balance.grid;
  const free: Cell[] = [];
  for (let y = 2; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (draft.tiles[y * w + x] !== TILE.floor) continue;
      const c = { x, y };
      if (sameCell(c, draft.start)) continue;
      if (pages.some((p) => sameCell(p, c))) continue;
      free.push(c);
    }
  }
  if (free.length < level.floorBooks + level.squeaks) return null;
  rng.shuffle(free);
  return free;
}

/**
 * Собирает уровень. До 200 попыток; потом диапазон обхода расширяется на 2 шага
 * в обе стороны, а в предупреждения пишется запись (раздел 5, пункт 7).
 */
export function generateLevel(level: LevelConfig, seed: number): LevelLayout {
  const { w, h } = balance.grid;
  const rng = new Rng(mixSeed(seed, level.id));
  const warnings: string[] = [];
  let tourMin: number = balance.tour.min;
  let tourMax: number = balance.tour.max;
  let attempts = 0;
  for (let round = 0; round < 6; round++) {
    for (let i = 0; i < balance.genAttempts; i++) {
      attempts++;
      const draft = buildRoom(rng, level);
      const desks = pickDesks(draft, level);
      const base: Library = {
        w,
        h,
        tiles: draft.tiles,
        door: draft.door,
        start: draft.start,
        desks,
      };
      if (!allFloorConnected(base)) continue;
      const pages = placePages(rng, base, tourMin, tourMax);
      if (!pages) continue;

      let done: { tiles: Tile[]; books: Cell[] } | null = null;
      for (let k = 0; k < SQUEAK_REROLLS && !done; k++) {
        const free = placeItems(rng, draft, level, pages);
        if (!free) break;
        const books = free.slice(0, level.floorBooks);
        const squeaks = free.slice(level.floorBooks, level.floorBooks + level.squeaks);
        const tiles = draft.tiles.slice();
        for (const c of squeaks) tiles[c.y * w + c.x] = TILE.squeak;
        const probe: Library = { ...base, tiles };
        // Половицы всегда можно обойти (раздел 5, пункт 6); если нет — перекладываем.
        if (squeaksAvoidable(probe)) done = { tiles, books };
      }
      if (!done) continue;

      const lib: Library = { ...base, tiles: done.tiles };
      return { lib, pages, books: done.books, tour: tourLength(lib, pages), attempts, warnings };
    }
    tourMin -= balance.genWiden;
    tourMax += balance.genWiden;
    warnings.push(
      `levelGen: уровень ${level.id}, сид ${seed}: за ${attempts} попыток обход не уложился, ` +
        `диапазон расширен до ${tourMin}–${tourMax}`,
    );
  }
  throw new Error(`levelGen: не удалось собрать уровень ${level.id} (сид ${seed})`);
}
