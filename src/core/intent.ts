/**
 * Намерение героя и его маршрут (план, 2.2.2).
 */
import { balance } from '../config/balance';
import type { Cell } from './library';
import { cellIndex, distance, isDoor, isFloor, sameCell } from './library';
import { heroRoute } from './pathfinding';
import type { GameState } from './state';
import { hasAllPages } from './state';

/** Можно ли герою идти на эту клетку: пол, либо дверь — когда собраны все листы. */
export function canWalkTo(s: GameState, cell: Cell): boolean {
  if (isDoor(s.lib, cell)) return hasAllPages(s);
  return isFloor(s.lib, cell.x, cell.y);
}

/**
 * Маршрут героя к клетке: кратчайший, с обходом скрипучих половиц (не длиннее чем
 * на 2 шага), не через клетки библиотекарей. null — пути нет.
 */
export function heroPath(s: GameState, to: Cell): Cell[] | null {
  if (!canWalkTo(s, to)) return null;
  const blocked = new Set<number>();
  for (const m of s.librarians) blocked.add(cellIndex(s.lib, m.cell.x, m.cell.y));
  return heroRoute(s.lib, s.hero.cell, to, balance.squeakDetourMax, {
    blocked,
    allowDoor: isDoor(s.lib, to),
  });
}

/** Маршрут по текущему намерению «идти». */
export function plannedPath(s: GameState): Cell[] | null {
  const it = s.hero.intent;
  if (it.kind !== 'move') return null;
  return heroPath(s, it.cell);
}

/** Клетка следующего шага героя или null. */
export function nextStep(s: GameState): Cell | null {
  const path = plannedPath(s);
  return path?.[0] ?? null;
}

export type ThrowCheck = 'ok' | 'noBooks' | 'outOfRange';

/**
 * Можно ли бросить словарь на клетку (2.5.2): любая клетка пола ближе throwR к герою,
 * через стеллажи; не дверь и не клетка героя.
 */
export function checkThrow(s: GameState, cell: Cell): ThrowCheck {
  if (s.hero.books <= 0) return 'noBooks';
  if (!isFloor(s.lib, cell.x, cell.y)) return 'outOfRange';
  if (sameCell(cell, s.hero.cell)) return 'outOfRange';
  if (distance(cell, s.hero.cell) >= balance.throwR) return 'outOfRange';
  return 'ok';
}

/** Все клетки, куда сейчас можно бросить словарь. */
export function throwTargets(s: GameState): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < s.lib.h; y++) {
    for (let x = 0; x < s.lib.w; x++) {
      const c = { x, y };
      if (
        isFloor(s.lib, x, y) &&
        !sameCell(c, s.hero.cell) &&
        distance(c, s.hero.cell) < balance.throwR
      ) {
        out.push(c);
      }
    }
  }
  return out;
}
