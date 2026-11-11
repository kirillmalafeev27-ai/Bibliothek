/**
 * Шум и слух (план, 2.4). Единственное место, где решается «услышит или нет»:
 * hears() используют логика, радиусы колец звука и подсказки (13.3.6).
 */
import { balance } from '../config/balance';
import type { LevelConfig } from '../config/levels';
import type { Cell } from './library';
import { distance } from './library';
import type { GameState, Librarian } from './state';

/**
 * step — тихий шаг героя; error — ошибка, у героя с полки падает книга;
 * squeak — шаг по скрипучей половице; book — брошенный словарь.
 */
export type SoundKind = 'step' | 'error' | 'squeak' | 'book';

export interface Sound {
  kind: SoundKind;
  cell: Cell;
}

/** Слушает ли библиотекарь сейчас: стоит с нимбом (слушает или ищет). */
export function isListening(m: Pick<Librarian, 'mode'>): boolean {
  return m.mode === 'listen' || m.mode === 'search';
}

/**
 * На каком расстоянии слышно звук (в клетках). Кольцо звука расходится ровно до этого
 * радиуса (правило 8.3). Словарь слышно везде — Infinity.
 */
export function soundRadius(kind: SoundKind, level: Pick<LevelConfig, 'loudR'>): number {
  switch (kind) {
    case 'step':
      return balance.hearR;
    case 'error':
    case 'squeak':
      return level.loudR;
    case 'book':
      return Infinity;
  }
}

/**
 * Услышит ли библиотекарь звук (2.4):
 * – тихий шаг — только когда слушает или ищет и клетка шага ближе hearR;
 * – ошибку и скрип — ближе loudR, в любом состоянии;
 * – брошенный словарь — всегда и везде.
 * Расстояние — между центрами клеток, сквозь стеллажи.
 */
export function hears(
  m: Pick<Librarian, 'cell' | 'mode'>,
  sound: Sound,
  level: Pick<LevelConfig, 'loudR'>,
): boolean {
  if (sound.kind === 'book') return true;
  if (sound.kind === 'step' && !isListening(m)) return false;
  return distance(m.cell, sound.cell) < soundRadius(sound.kind, level);
}

/** Внутри ли клетка нимба хотя бы одного слушающего библиотекаря. */
export function inHalo(s: Pick<GameState, 'librarians' | 'level'>, cell: Cell): boolean {
  return s.librarians.some((m) => hears(m, { kind: 'step', cell }, s.level));
}

/**
 * Внутри ли герой кольца громкого слуха хотя бы одного библиотекаря: здесь ошибку услышат.
 * Используют подсказки, звук и исключение ответов из T_med (13.3.6).
 */
export function inEarshot(s: Pick<GameState, 'librarians' | 'level' | 'hero'>): boolean {
  return s.librarians.some((m) => hears(m, { kind: 'error', cell: s.hero.cell }, s.level));
}

/** Расстояние от героя до ближайшего библиотекаря, в клетках. */
export function nearestLibrarianDistance(s: Pick<GameState, 'librarians' | 'hero'>): number {
  let best = Infinity;
  for (const m of s.librarians) best = Math.min(best, distance(m.cell, s.hero.cell));
  return best;
}
