/**
 * Подсказки (план, 2.8): всё, что вид показывает о слухе и путях, вычисляется здесь
 * из тех же функций, что и логика, — поэтому подсказки никогда не врут.
 */
import { balance } from '../config/balance';
import { hears, inHalo, isListening } from './hearing';
import type { Cell } from './library';
import { distance, isSqueak, sameCell } from './library';
import { nextStep, plannedPath } from './intent';
import { librarianPath, pathToSound } from './librarian';
import type { GameState, Librarian } from './state';

export type ManiculeTone = 'ink' | 'gold' | 'alarm';

export interface ManiculeHint {
  m: number;
  cell: Cell;
  /** Чернильная — бродит, золотая — учуял, кармином — бежит на звук (2.8.3). */
  tone: ManiculeTone;
  /** При злости маникула крупнее. */
  anger: number;
}

/** Маникула над клеткой, куда идёт библиотекарь. Видна всегда. */
export function manicules(s: GameState): ManiculeHint[] {
  const out: ManiculeHint[] = [];
  for (const m of s.librarians) {
    if (!m.target) continue;
    if (m.mode === 'file') continue;
    if (m.mode === 'listen' && m.atWaypoint) continue;
    const hunting = m.mode === 'alert' || m.mode === 'run' || m.mode === 'search';
    const tone: ManiculeTone = hunting ? 'alarm' : m.sniffed ? 'gold' : 'ink';
    out.push({ m: m.id, cell: m.target, tone, anger: m.anger });
  }
  return out;
}

export interface StepHint {
  cell: Cell;
  /** Шаг закончится в нимбе слушающего библиотекаря. */
  halo: boolean;
  /** Шаг закончится на скрипучей половице. */
  squeak: boolean;
  /** След кармином (2.8.5): только на уровнях с подсказкой «красный след». */
  red: boolean;
}

/** След следующего шага героя. */
export function stepHint(s: GameState): StepHint | null {
  const cell = nextStep(s);
  if (!cell) return null;
  const halo = inHalo(s, cell);
  const squeak = isSqueak(s.lib, cell.x, cell.y);
  return { cell, halo, squeak, red: s.hints.redStep && (halo || squeak) };
}

/** Весь маршрут героя к цели (тихий пунктир до точки назначения). */
export function routeHint(s: GameState): Cell[] {
  return plannedPath(s) ?? [];
}

/** Отпечатки тапочек: следующие клетки пути библиотекаря (2.8.4). */
export function slipperPrints(s: GameState, m: Librarian): Cell[] {
  if (!s.hints.librarianPath) return [];
  return librarianPath(s, m, balance.view.slipperPrints);
}

export interface ThrowPreview {
  cell: Cell;
  /** Путь каждого библиотекаря к клетке броска. */
  paths: { m: number; path: Cell[]; danger: boolean }[];
}

/**
 * Путь, которым библиотекари побегут к клетке броска (2.8.6). Опасный путь —
 * тот, что проходит через героя или вплотную к нему.
 */
export function throwPreview(s: GameState, cell: Cell): ThrowPreview {
  const paths = s.librarians.map((m) => {
    const path = pathToSound(s, m, cell);
    const danger = path.some(
      (c) => sameCell(c, s.hero.cell) || distance(c, s.hero.cell) < balance.throwDangerR,
    );
    return { m: m.id, path, danger };
  });
  return { cell, paths };
}

export interface HaloHint {
  m: number;
  cell: Cell;
  radius: number;
}

/** Нимбы слушающих и ищущих библиотекарей (2.8.1). */
export function halos(s: GameState): HaloHint[] {
  return s.librarians
    .filter((m) => isListening(m))
    .map((m) => ({ m: m.id, cell: m.cell, radius: balance.hearR }));
}

/** Услышит ли этот библиотекарь ошибку героя прямо сейчас. */
export function wouldHearError(s: GameState, m: Librarian): boolean {
  return hears(m, { kind: 'error', cell: s.hero.cell }, s.level);
}
