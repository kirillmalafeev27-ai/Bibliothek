/**
 * Редуктор игры (план, 13.3.2): состояние меняется только здесь.
 * reduce(state, action) возвращает новое состояние и список событий.
 */
import { balance } from '../config/balance';
import type { GameEvent } from './events';
import { inEarshot } from './hearing';
import type { Cell } from './library';
import { inBounds, isDoor, isFloor, sameCell } from './library';
import { act, emitSound } from './hero';
import { checkThrow } from './intent';
import { tickLibrarian } from './librarian';
import type { GameState } from './state';
import { STAY, cloneState, hasAllPages } from './state';

export type Action =
  /** Прошло dt секунд реального времени. */
  | { type: 'TICK'; dt: number }
  /** Игрок ответил на вопрос. */
  | { type: 'ANSWER'; correct: boolean; timeMs: number }
  /** Игрок задал намерение: идти, бросить словарь или стоять. */
  | { type: 'SET_INTENT'; kind: 'move' | 'throw' | 'stay'; cell?: Cell }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  /** Отладочная панель (13.7). */
  | { type: 'DEBUG'; op: DebugOp };

export type DebugOp =
  | { kind: 'deaf'; on: boolean }
  | { kind: 'infiniteCards'; on: boolean }
  | { kind: 'forceListen' }
  | { kind: 'sniffNow' };

export interface Reduced {
  state: GameState;
  events: GameEvent[];
}

function tick(s: GameState, rawDt: number, ev: GameEvent[]): void {
  if (s.paused) return;
  // Шаг времени кадра ограничен: подвисания не съедают секунды (2.7.3).
  const dt = Math.min(Math.max(rawDt, 0), balance.maxFrameDtSec);
  if (s.status === 'catchScene') {
    // Сцена поимки: часы мира стоят, но не дольше 1.5 с (2.6.3).
    s.sceneLeft -= dt;
    if (s.sceneLeft <= 0) {
      s.sceneLeft = 0;
      s.status = 'playing';
      ev.push({ type: 'SCENE_END' });
    }
    return;
  }
  if (s.status !== 'playing') return;
  s.time += dt;
  s.stats.timeSec += dt;
  for (const m of s.librarians) {
    if (s.status !== 'playing') break;
    tickLibrarian(s, m, dt, ev);
  }
  if (s.status === 'playing' && inEarshot(s)) s.questionTainted = true;
}

function answer(s: GameState, correct: boolean, timeMs: number, ev: GameEvent[]): void {
  if (s.paused || s.status !== 'playing') return;
  // При готовом действии кнопки ответов неактивны (2.2.4).
  if (s.hero.ready) return;
  const tainted = s.questionTainted || inEarshot(s);
  ev.push({ type: 'ANSWERED', correct, timeMs, paced: !tainted });
  s.questionTainted = false;
  if (correct) {
    s.stats.correct += 1;
    act(s, ev);
  } else {
    // Неправильный ответ: действие не выполняется, у героя громкий шум (2.2.5).
    s.stats.wrong += 1;
    emitSound(s, 'error', s.hero.cell, ev);
  }
  if (s.status === 'playing' && inEarshot(s)) s.questionTainted = true;
}

function setIntent(
  s: GameState,
  kind: 'move' | 'throw' | 'stay',
  cell: Cell | undefined,
  ev: GameEvent[],
): void {
  if (s.paused || s.status !== 'playing') return;
  const h = s.hero;
  if (kind === 'stay' || !cell) {
    h.intent = STAY;
    h.resume = null;
    return;
  }
  if (!inBounds(s.lib, cell.x, cell.y)) {
    ev.push({ type: 'DENIED', reason: 'blocked', cell });
    return;
  }
  if (kind === 'move') {
    if (sameCell(cell, h.cell)) {
      // Тап по герою — стоять (2.2.2).
      h.intent = STAY;
      h.resume = null;
      return;
    }
    const door = isDoor(s.lib, cell);
    if (!door && !isFloor(s.lib, cell.x, cell.y)) {
      ev.push({ type: 'DENIED', reason: 'blocked', cell });
      return;
    }
    if (door && !hasAllPages(s)) {
      ev.push({ type: 'DENIED', reason: 'blocked', cell });
      return;
    }
    h.intent = { kind: 'move', cell };
    h.resume = null;
  } else {
    const check = checkThrow(s, cell);
    if (check !== 'ok') {
      ev.push({ type: 'DENIED', reason: check, cell });
      return;
    }
    if (h.intent.kind === 'move') h.resume = h.intent.cell;
    h.intent = { kind: 'throw', cell };
  }
  // Готовое действие выполняется мгновенно, как только задано намерение (2.2.4).
  if (h.ready) {
    h.ready = false;
    ev.push({ type: 'READY_USED' });
    act(s, ev);
    if (s.status === 'playing' && inEarshot(s)) s.questionTainted = true;
  }
}

function debug(s: GameState, op: DebugOp, ev: GameEvent[]): void {
  switch (op.kind) {
    case 'deaf':
      s.debug.deaf = op.on;
      break;
    case 'infiniteCards':
      s.debug.infiniteCards = op.on;
      break;
    case 'forceListen':
      for (const m of s.librarians) {
        if (m.mode === 'walk') {
          m.mode = 'listen';
          m.timer = balance.listenA * s.unitA;
          m.stepDur = 0;
          m.from = null;
          m.atWaypoint = false;
          ev.push({ type: 'LISTEN_START', m: m.id });
        }
      }
      break;
    case 'sniffNow':
      for (const m of s.librarians) m.nextSniffAt = s.time;
      break;
  }
}

export function reduce(state: GameState, action: Action): Reduced {
  const s = cloneState(state);
  const events: GameEvent[] = [];
  switch (action.type) {
    case 'TICK':
      tick(s, action.dt, events);
      break;
    case 'ANSWER':
      answer(s, action.correct, action.timeMs, events);
      break;
    case 'SET_INTENT':
      setIntent(s, action.kind, action.cell, events);
      break;
    case 'PAUSE':
      if (!s.paused) {
        s.paused = true;
        events.push({ type: 'PAUSED' });
      }
      break;
    case 'RESUME':
      if (s.paused) {
        s.paused = false;
        events.push({ type: 'RESUMED' });
      }
      break;
    case 'DEBUG':
      debug(s, action.op, events);
      break;
  }
  return { state: s, events };
}

/** Журнал действий → итоговое состояние. Одинаковые сид и журнал дают одинаковый результат. */
export function replay(initial: GameState, actions: readonly Action[]): Reduced {
  let state = initial;
  const events: GameEvent[] = [];
  for (const a of actions) {
    const r = reduce(state, a);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}
