/**
 * Поиск пути по библиотеке.
 * Библиотекарь всегда идёт кратчайшим путём; при равных путях направления
 * перебираются в фиксированном порядке: вверх, влево, вниз, вправо (план, 2.3.7).
 */
import type { Cell, Library } from './library';
import { DIRS, TILE, cellIndex, inBounds, sameCell } from './library';

export interface PathOptions {
  /** Индексы клеток, через которые идти нельзя (например, клетки библиотекарей). */
  blocked?: ReadonlySet<number>;
  /** Можно ли входить на клетку двери (только герою и только как конечная цель). */
  allowDoor?: boolean;
}

function passable(lib: Library, x: number, y: number, opts?: PathOptions): boolean {
  if (!inBounds(lib, x, y)) return false;
  const i = cellIndex(lib, x, y);
  const t = lib.tiles[i];
  if (t === TILE.shelf) return false;
  if (t === TILE.door && !opts?.allowDoor) return false;
  if (opts?.blocked?.has(i)) return false;
  return true;
}

/**
 * Карта расстояний (в шагах) от клетки `from` до всех достижимых клеток; −1 — недостижимо.
 * Сама клетка `from` считается проходимой, даже если она в `blocked`.
 */
export function distanceMap(lib: Library, from: Cell, opts?: PathOptions): Int16Array {
  const w = lib.w;
  const h = lib.h;
  const tiles = lib.tiles;
  const dist = new Int16Array(w * h).fill(-1);
  if (!inBounds(lib, from.x, from.y)) return dist;
  const blocked = opts?.blocked;
  const allowDoor = opts?.allowDoor === true;
  const queue = new Int16Array(w * h);
  let head = 0;
  let tail = 0;
  const start = from.y * w + from.x;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const cur = queue[head++] as number;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const d = (dist[cur] as number) + 1;
    for (let k = 0; k < 4; k++) {
      let ni: number;
      if (k === 0) {
        if (cy === 0) continue;
        ni = cur - w;
      } else if (k === 1) {
        if (cx === 0) continue;
        ni = cur - 1;
      } else if (k === 2) {
        if (cy === h - 1) continue;
        ni = cur + w;
      } else {
        if (cx === w - 1) continue;
        ni = cur + 1;
      }
      if (dist[ni] !== -1) continue;
      const t = tiles[ni];
      if (t === TILE.shelf) continue;
      if (t === TILE.door && !allowDoor) continue;
      if (blocked !== undefined && blocked.has(ni)) continue;
      dist[ni] = d;
      queue[tail++] = ni;
    }
  }
  return dist;
}

/** Число шагов между клетками или −1. */
export function stepsBetween(lib: Library, a: Cell, b: Cell, opts?: PathOptions): number {
  const map = distanceMap(lib, a, opts);
  return map[cellIndex(lib, b.x, b.y)] as number;
}

/**
 * Кратчайший путь из `from` в `to`: клетки пути без стартовой, с конечной.
 * При равных путях выбирается первое подходящее направление в порядке DIRS.
 * Возвращает null, если пути нет; пустой массив, если from === to.
 */
export function shortestPath(lib: Library, from: Cell, to: Cell, opts?: PathOptions): Cell[] | null {
  if (sameCell(from, to)) return [];
  if (!passable(lib, to.x, to.y, opts)) return null;
  const toTarget = distanceMap(lib, to, opts);
  const startD = toTarget[cellIndex(lib, from.x, from.y)] as number;
  if (startD < 0) return null;
  const path: Cell[] = [];
  let cur: Cell = from;
  let d = startD;
  while (d > 0) {
    let moved = false;
    for (const dir of DIRS) {
      const nx = cur.x + dir.x;
      const ny = cur.y + dir.y;
      if (!inBounds(lib, nx, ny)) continue;
      if (toTarget[cellIndex(lib, nx, ny)] === d - 1) {
        cur = { x: nx, y: ny };
        path.push(cur);
        d -= 1;
        moved = true;
        break;
      }
    }
    if (!moved) return null;
  }
  return path;
}

/** Больше половиц, чем на любом уровне, в маршруте не понадобится. */
const MAX_SQUEAKS_IN_ROUTE = 10;

/**
 * Маршрут героя (2.2.2): кратчайший; скрипучие половицы он обходит, если обход длиннее
 * не больше чем на `detourMax` шагов; через клетки `blocked` (библиотекари) не идёт.
 * Среди путей не длиннее «кратчайший + detourMax» выбирается путь с наименьшим числом
 * скрипучих половиц, затем самый короткий, затем — по порядку направлений.
 */
export function heroRoute(
  lib: Library,
  from: Cell,
  to: Cell,
  detourMax: number,
  opts?: PathOptions,
): Cell[] | null {
  if (sameCell(from, to)) return [];
  if (!passable(lib, to.x, to.y, opts)) return null;
  const n = lib.w * lib.h;
  const K = MAX_SQUEAKS_IN_ROUTE + 1;
  // rdist[s * n + i] — минимум шагов от клетки i до цели, если по дороге (включая цель,
  // не считая саму i) наступить ровно на s скрипучих половиц.
  const rdist = new Int16Array(K * n).fill(-1);
  const queue = new Int32Array(K * n);
  let head = 0;
  let tail = 0;
  const ti = cellIndex(lib, to.x, to.y);
  rdist[ti] = 0;
  queue[tail++] = ti;
  const fromIdx = cellIndex(lib, from.x, from.y);
  while (head < tail) {
    const cur = queue[head++] as number;
    const s = Math.floor(cur / n);
    const j = cur - s * n;
    const jx = j % lib.w;
    const jy = (j - jx) / lib.w;
    const d = rdist[cur] as number;
    // Вход в клетку j стоит одну половицу, если она скрипит.
    const s2 = s + (lib.tiles[j] === TILE.squeak ? 1 : 0);
    if (s2 >= K) continue;
    for (const dir of DIRS) {
      const ix = jx + dir.x;
      const iy = jy + dir.y;
      if (!inBounds(lib, ix, iy)) continue;
      const i = cellIndex(lib, ix, iy);
      // Дверь — только как цель; стартовая клетка проходима всегда.
      if (i !== fromIdx && !passable(lib, ix, iy, { blocked: opts?.blocked })) continue;
      if (i === fromIdx && lib.tiles[i] === TILE.shelf) continue;
      const key = s2 * n + i;
      if (rdist[key] !== -1) continue;
      rdist[key] = d + 1;
      queue[tail++] = key;
    }
  }
  let best = -1;
  for (let s = 0; s < K; s++) {
    const d = rdist[s * n + fromIdx] as number;
    if (d >= 0 && (best < 0 || d < best)) best = d;
  }
  if (best < 0) return null;
  let sStar = -1;
  for (let s = 0; s < K; s++) {
    const d = rdist[s * n + fromIdx] as number;
    if (d >= 0 && d <= best + detourMax) {
      sStar = s;
      break;
    }
  }
  if (sStar < 0) return null;
  const path: Cell[] = [];
  let cur: Cell = from;
  let s = sStar;
  let d = rdist[s * n + fromIdx] as number;
  while (d > 0) {
    let moved = false;
    for (const dir of DIRS) {
      const nx = cur.x + dir.x;
      const ny = cur.y + dir.y;
      if (!inBounds(lib, nx, ny)) continue;
      const ni = cellIndex(lib, nx, ny);
      const sn = s - (lib.tiles[ni] === TILE.squeak ? 1 : 0);
      if (sn < 0) continue;
      if (rdist[sn * n + ni] === d - 1) {
        cur = { x: nx, y: ny };
        path.push(cur);
        s = sn;
        d -= 1;
        moved = true;
        break;
      }
    }
    if (!moved) return null;
  }
  return path;
}

/** Все ли клетки пола связаны (раздел 5, проверка BFS). */
export function allFloorConnected(lib: Library): boolean {
  const map = distanceMap(lib, lib.start);
  for (let i = 0; i < lib.tiles.length; i++) {
    const t = lib.tiles[i];
    if ((t === TILE.floor || t === TILE.squeak) && map[i] === -1) return false;
  }
  return true;
}

/**
 * До каждой клетки пола можно дойти от старта, не наступив ни на одну скрипучую половицу:
 * половицы всегда можно обойти (раздел 5, пункт 6).
 */
export function squeaksAvoidable(lib: Library): boolean {
  const blocked = new Set<number>();
  for (let i = 0; i < lib.tiles.length; i++) {
    if (lib.tiles[i] === TILE.squeak) blocked.add(i);
  }
  const map = distanceMap(lib, lib.start, { blocked });
  for (let i = 0; i < lib.tiles.length; i++) {
    if (lib.tiles[i] === TILE.floor && map[i] === -1) return false;
  }
  return true;
}
