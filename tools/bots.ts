/**
 * Боты для симуляции (план, 14.3). Играют на настоящем движке правил:
 * видят то же состояние, что и игрок, и шлют те же действия.
 */
import { balance } from '../src/config/balance';
import type { Cell, GameState, Librarian } from '../src/core';
import {
  DIRS,
  cellIndex,
  distance,
  distanceMap,
  hasAllPages,
  inHalo,
  isFloor,
  isListening,
  isSqueak,
  librarianPath,
  pathToSound,
  sameCell,
  throwTargets,
} from '../src/core';

export type BotKind = 'cautious' | 'impatient' | 'nobooks' | 'rusher';

export const BOT_NAMES: Record<BotKind, string> = {
  cautious: 'осторожный',
  impatient: 'без выдержки',
  nobooks: 'без книг',
  rusher: 'напролом',
};

export type Plan =
  | { kind: 'move'; cell: Cell; urgent: boolean }
  | { kind: 'throw'; cell: Cell; urgent: boolean }
  | { kind: 'wait' };

export interface BotTraits {
  /**
   * Выдержка: в кольце громкого слуха не отвечает, если не нужно действовать прямо сейчас.
   * Ждёт не вечно — до стольких единиц A на вопрос (внимательный игрок пережидает,
   * пока библиотекарь пройдёт мимо, но не сидит минутами). 0 — отвечает всегда.
   */
  patienceA: number;
  /** Бросает словари. */
  books: boolean;
  /** Обходит библиотекаря (иначе — идёт напролом кратчайшим путём). */
  careful: boolean;
}

export const TRAITS: Record<BotKind, BotTraits> = {
  cautious: { patienceA: 1.5, books: true, careful: true },
  impatient: { patienceA: 0, books: true, careful: true },
  nobooks: { patienceA: 1.5, books: false, careful: true },
  rusher: { patienceA: 0, books: false, careful: false },
};

/** Цены клеток для осторожного маршрута (14.3). */
const COST = {
  squeak: 6,
  onPath: 8,
  halo: 5,
  nearWalking: 2,
  loudRing: 0.7,
  pathAhead: 4,
};
/** Не шагает на столько следующих клеток пути библиотекаря. */
const NO_STEP_AHEAD = 2;
/** Угроза: путь библиотекаря на столько шагов вперёд проходит через героя. */
const THREAT_AHEAD = 3;
/** Словарь бросает не ближе этого к себе… */
const THROW_MIN_R = 2.5;
/** …и так, чтобы путь библиотекаря держался не ближе этого к герою. */
const THROW_KEEP_R = 1.5;

/** Следующая цель героя: ближайший по шагам лист, потом дверь. */
export function nextGoal(s: GameState): Cell {
  if (hasAllPages(s) || s.pages.length === 0) return s.lib.door;
  const dist = distanceMap(s.lib, s.hero.cell);
  let best = s.pages[0]!.cell;
  let bestD = Infinity;
  for (const p of s.pages) {
    const d = dist[cellIndex(s.lib, p.cell.x, p.cell.y)] as number;
    if (d >= 0 && d < bestD) {
      bestD = d;
      best = p.cell;
    }
  }
  return best;
}

function threats(s: GameState): Librarian[] {
  return s.librarians.filter(
    (m) =>
      (m.mode !== 'file' && sameCell(m.target, s.hero.cell)) ||
      librarianPath(s, m, THREAT_AHEAD).some((c) => sameCell(c, s.hero.cell)),
  );
}

function bestThrowCell(s: GameState, goal: Cell): Cell | null {
  const toGoal = distanceMap(s.lib, sameCell(goal, s.lib.door) ? s.lib.start : goal);
  let best: Cell | null = null;
  let bestScore = -Infinity;
  for (const c of throwTargets(s)) {
    if (distance(c, s.hero.cell) < THROW_MIN_R) continue;
    // Все библиотекари побегут к словарю: ни один путь не должен идти вплотную к герою.
    const safe = s.librarians.every((m) =>
      pathToSound(s, m, c).every((p) => distance(p, s.hero.cell) >= THROW_KEEP_R),
    );
    if (!safe) continue;
    // Чем дальше словарь от следующей цели, тем лучше он уводит библиотекаря.
    const away = toGoal[cellIndex(s.lib, c.x, c.y)] as number;
    const score = away + distance(c, s.hero.cell) * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function escapeStep(s: GameState, danger: Librarian[]): Cell | null {
  const pathCells: Cell[] = [];
  for (const m of danger) pathCells.push(...librarianPath(s, m, THREAT_AHEAD + 1));
  let best: Cell | null = null;
  let bestScore = -Infinity;
  for (const d of DIRS) {
    const c = { x: s.hero.cell.x + d.x, y: s.hero.cell.y + d.y };
    if (!isFloor(s.lib, c.x, c.y)) continue;
    if (s.librarians.some((m) => sameCell(m.cell, c))) continue;
    if (pathCells.some((p) => sameCell(p, c))) continue;
    let score = 0;
    for (const m of danger) {
      const dist = distanceMap(s.lib, m.cell);
      score += dist[cellIndex(s.lib, c.x, c.y)] as number;
    }
    if (isSqueak(s.lib, c.x, c.y)) score -= 3;
    if (inHalo(s, c)) score -= 6;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** Маршрут с ценами клеток (Дейкстра на крошечной сетке). Возвращает первый шаг. */
function costlyFirstStep(s: GameState, goal: Cell): Cell | null {
  const lib = s.lib;
  const n = lib.w * lib.h;
  const extra = new Float64Array(n);
  const banned = new Uint8Array(n);
  for (const m of s.librarians) {
    banned[cellIndex(lib, m.cell.x, m.cell.y)] = 1;
    const ahead = librarianPath(s, m, COST.pathAhead);
    for (const c of ahead) extra[cellIndex(lib, c.x, c.y)]! += COST.onPath;
  }
  for (let y = 0; y < lib.h; y++) {
    for (let x = 0; x < lib.w; x++) {
      if (!isFloor(lib, x, y)) continue;
      const i = cellIndex(lib, x, y);
      const c = { x, y };
      if (isSqueak(lib, x, y)) extra[i]! += COST.squeak;
      for (const m of s.librarians) {
        const d = distance(m.cell, c);
        if (isListening(m)) {
          if (d < balance.hearR) extra[i]! += COST.halo;
        } else if (d < balance.hearR) {
          extra[i]! += COST.nearWalking;
        }
        if (d < s.level.loudR) extra[i]! += COST.loudRing;
      }
    }
  }
  const door = sameCell(goal, lib.door);
  const gi = cellIndex(lib, goal.x, goal.y);
  const si = cellIndex(lib, s.hero.cell.x, s.hero.cell.y);
  // Дейкстра от цели к герою: тогда первый шаг героя читается прямо из карты.
  const cost = new Float64Array(n).fill(Infinity);
  const done = new Uint8Array(n);
  cost[gi] = 0;
  for (;;) {
    let cur = -1;
    let curC = Infinity;
    for (let i = 0; i < n; i++) {
      if (!done[i] && cost[i]! < curC) {
        curC = cost[i]!;
        cur = i;
      }
    }
    if (cur < 0) break;
    done[cur] = 1;
    if (cur === si) break;
    const cx = cur % lib.w;
    const cy = (cur - cx) / lib.w;
    // Вход в клетку cur стоит 1 + её надбавку.
    const enter = 1 + (cur === gi && door ? 0 : extra[cur]!);
    for (const d of DIRS) {
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (nx < 0 || ny < 0 || nx >= lib.w || ny >= lib.h) continue;
      const ni = cellIndex(lib, nx, ny);
      if (ni !== si) {
        if (!isFloor(lib, nx, ny)) continue;
        if (banned[ni]) continue;
      }
      const nc = curC + enter;
      if (nc < cost[ni]!) cost[ni] = nc;
    }
  }
  if (!Number.isFinite(cost[si]!)) return null;
  let best: Cell | null = null;
  let bestC = Infinity;
  for (const d of DIRS) {
    const nx = s.hero.cell.x + d.x;
    const ny = s.hero.cell.y + d.y;
    if (nx < 0 || ny < 0 || nx >= lib.w || ny >= lib.h) continue;
    const ni = cellIndex(lib, nx, ny);
    const isGoalDoor = door && ni === gi;
    if (!isGoalDoor && (!isFloor(lib, nx, ny) || banned[ni])) continue;
    const total = cost[ni]! + 1 + (isGoalDoor ? 0 : extra[ni]!);
    if (total < bestC - 1e-9) {
      bestC = total;
      best = { x: nx, y: ny };
    }
  }
  return best;
}

/** Что бот хочет сделать прямо сейчас. */
export function planFor(kind: BotKind, s: GameState): Plan {
  const traits = TRAITS[kind];
  const goal = nextGoal(s);
  if (!traits.careful) {
    // Напролом: кратчайший путь, библиотекаря игнорирует.
    return { kind: 'move', cell: goal, urgent: true };
  }
  const danger = threats(s);
  if (danger.length > 0) {
    if (traits.books && s.hero.books > 0) {
      const cell = bestThrowCell(s, goal);
      if (cell) return { kind: 'throw', cell, urgent: true };
    }
    // Словаря нет — уходит с клетки, даже без выигрыша в расстоянии.
    const step = escapeStep(s, danger);
    if (step) return { kind: 'move', cell: step, urgent: true };
    return { kind: 'wait' };
  }
  const next = costlyFirstStep(s, goal);
  if (!next) return { kind: 'wait' };
  // Не шагает в нимб слушающего и на две следующие клетки пути библиотекаря.
  if (!sameCell(next, s.lib.door)) {
    if (inHalo(s, next)) return { kind: 'wait' };
    for (const m of s.librarians) {
      if (librarianPath(s, m, NO_STEP_AHEAD).some((c) => sameCell(c, next))) return { kind: 'wait' };
    }
  }
  return { kind: 'move', cell: next, urgent: false };
}
