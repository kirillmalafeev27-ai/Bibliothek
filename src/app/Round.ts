/**
 * Раунд: состояние игры, отправка действий в редуктор и рассылка событий подписчикам —
 * сцене, интерфейсу, звуку. Сам ничего не рисует и о Phaser не знает.
 */
import type { LevelConfig } from '../config/levels';
import type { Action, Cell, CreateOptions, GameEvent, GameState } from '../core';
import { checkThrow, createState, inBounds, isFloor, reduce, sameCell } from '../core';

export type RoundListener = (events: GameEvent[], state: GameState, prev: GameState) => void;

export class Round {
  state: GameState;
  /** Игрок целится: следующий тап по клетке — бросок (11.4). */
  aiming = false;
  /** Клетка под прицелом (мышь или стрелки клавиатуры). */
  aimCell: Cell | null = null;
  private listeners = new Set<RoundListener>();
  private uiListeners = new Set<() => void>();

  constructor(
    readonly level: LevelConfig,
    readonly seed: number,
    opts: CreateOptions = {},
  ) {
    this.state = createState(level, seed, opts);
  }

  dispatch(action: Action): GameEvent[] {
    const prev = this.state;
    const r = reduce(prev, action);
    this.state = r.state;
    if (r.events.length > 0) {
      for (const e of r.events) {
        // Бросок сделан или сорвался — прицеливание закончено.
        if (e.type === 'THROW' || e.type === 'CAUGHT' || e.type === 'EXIT' || e.type === 'LOST') this.endAim();
      }
      for (const fn of this.listeners) fn(r.events, r.state, prev);
    }
    return r.events;
  }

  subscribe(fn: RoundListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Подписка на изменения прицеливания (кнопка «Бросить», прицел в сцене). */
  onUi(fn: () => void): () => void {
    this.uiListeners.add(fn);
    return () => this.uiListeners.delete(fn);
  }

  private emitUi(): void {
    for (const fn of this.uiListeners) fn();
  }

  get playing(): boolean {
    return this.state.status === 'playing' && !this.state.paused;
  }

  tick(dt: number): GameEvent[] {
    return this.dispatch({ type: 'TICK', dt });
  }

  answer(correct: boolean, timeMs: number): GameEvent[] {
    return this.dispatch({ type: 'ANSWER', correct, timeMs });
  }

  /** Тап по клетке: идти туда, а если игрок целится — бросить туда словарь. */
  tap(cell: Cell): GameEvent[] {
    if (!this.playing) return [];
    if (this.aiming) {
      const events = this.dispatch({ type: 'SET_INTENT', kind: 'throw', cell });
      // Намерение принято — прицеливание окончено; отказ оставляет прицел включённым.
      if (!events.some((e) => e.type === 'DENIED')) this.endAim();
      else this.setAimCell(cell);
      return events;
    }
    if (sameCell(cell, this.state.hero.cell)) return this.stay();
    return this.dispatch({ type: 'SET_INTENT', kind: 'move', cell });
  }

  /** Стрелка клавиатуры: соседняя клетка (или прицел, если игрок целится). */
  arrow(dir: Cell): GameEvent[] {
    if (!this.playing) return [];
    if (this.aiming) {
      const from = this.aimCell ?? this.state.hero.cell;
      const next = { x: from.x + dir.x, y: from.y + dir.y };
      if (inBounds(this.state.lib, next.x, next.y)) this.setAimCell(next);
      return [];
    }
    const h = this.state.hero.cell;
    return this.dispatch({ type: 'SET_INTENT', kind: 'move', cell: { x: h.x + dir.x, y: h.y + dir.y } });
  }

  stay(): GameEvent[] {
    this.endAim();
    return this.dispatch({ type: 'SET_INTENT', kind: 'stay' });
  }

  /** Кнопка «Бросить» или клавиша T. Возвращает false, если словарей нет. */
  toggleAim(): boolean {
    if (!this.playing) return false;
    if (this.aiming) {
      this.endAim();
      return true;
    }
    if (this.state.hero.books <= 0) return false;
    this.aiming = true;
    this.aimCell = this.defaultAimCell();
    this.emitUi();
    return true;
  }

  /** Enter: бросить в клетку под прицелом. */
  confirmAim(): GameEvent[] {
    if (!this.aiming || !this.aimCell) return [];
    return this.tap(this.aimCell);
  }

  endAim(): void {
    if (!this.aiming && !this.aimCell) return;
    this.aiming = false;
    this.aimCell = null;
    this.emitUi();
  }

  setAimCell(cell: Cell | null): void {
    if (sameCell(cell, this.aimCell) || (!cell && !this.aimCell)) return;
    this.aimCell = cell;
    this.emitUi();
  }

  /** Прицел по умолчанию: ближайшая подходящая клетка в ту сторону, куда герой смотрит. */
  private defaultAimCell(): Cell | null {
    const s = this.state;
    const h = s.hero;
    const dirs: Cell[] = [
      { x: 0, y: h.faceY },
      { x: h.faceX, y: 0 },
      { x: 0, y: -h.faceY },
      { x: -h.faceX, y: 0 },
    ];
    for (const d of dirs) {
      for (let k = 2; k >= 1; k--) {
        const c = { x: h.cell.x + d.x * k, y: h.cell.y + d.y * k };
        if (isFloor(s.lib, c.x, c.y) && checkThrow(s, c) === 'ok') return c;
      }
    }
    return null;
  }
}
