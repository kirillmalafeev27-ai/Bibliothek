/**
 * Ориентация библиотеки на экране (план, 2.1.6, раздел 5.8).
 * В ландшафте готовая карта поворачивается на 90°: дверь оказывается сбоку.
 * Логика об этом ничего не знает — пересчёт координат живёт только здесь.
 */
import { CELL } from '../art/manifest';
import type { Cell } from '../core';

/** portrait — дверь снизу; left / right — библиотека повёрнута, дверь слева или справа. */
export type Orient = 'portrait' | 'left' | 'right';
export type Side = 'top' | 'bottom' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export class Mapper {
  /** Клеток на экране по ширине и высоте. */
  readonly cols: number;
  readonly rows: number;

  constructor(
    readonly orient: Orient,
    readonly libW: number,
    readonly libH: number,
  ) {
    this.cols = orient === 'portrait' ? libW : libH;
    this.rows = orient === 'portrait' ? libH : libW;
  }

  /** Клетка библиотеки → клетка на экране. */
  toView(c: Cell): Cell {
    switch (this.orient) {
      case 'portrait':
        return { x: c.x, y: c.y };
      case 'left':
        return { x: this.libH - 1 - c.y, y: c.x };
      case 'right':
        return { x: c.y, y: this.libW - 1 - c.x };
    }
  }

  /** Клетка на экране → клетка библиотеки. */
  toLogic(v: Cell): Cell {
    switch (this.orient) {
      case 'portrait':
        return { x: v.x, y: v.y };
      case 'left':
        return { x: v.y, y: this.libH - 1 - v.x };
      case 'right':
        return { x: this.libW - 1 - v.y, y: v.x };
    }
  }

  /** Направление в библиотеке → направление на экране. */
  dirToView(d: Cell): Cell {
    switch (this.orient) {
      case 'portrait':
        return { x: d.x, y: d.y };
      case 'left':
        return { x: -d.y, y: d.x };
      case 'right':
        return { x: d.y, y: -d.x };
    }
  }

  /** Направление на экране (стрелка клавиатуры) → направление в библиотеке. */
  dirToLogic(d: Cell): Cell {
    switch (this.orient) {
      case 'portrait':
        return { x: d.x, y: d.y };
      case 'left':
        return { x: d.y, y: -d.x };
      case 'right':
        return { x: -d.y, y: d.x };
    }
  }

  /** Центр клетки библиотеки в единицах мира. */
  center(c: Cell): Point {
    const v = this.toView(c);
    return { x: (v.x + 0.5) * CELL, y: (v.y + 0.5) * CELL };
  }

  /** Точка внутри клетки: fx, fy — доли клетки на экране (0..1). */
  at(c: Cell, fx: number, fy: number): Point {
    const v = this.toView(c);
    return { x: (v.x + fx) * CELL, y: (v.y + fy) * CELL };
  }

  /** Дробная клетка библиотеки (между центрами клеток) → точка мира; fy — где ноги. */
  lerp(a: Cell, b: Cell, t: number, fx: number, fy: number): Point {
    const pa = this.at(a, fx, fy);
    const pb = this.at(b, fx, fy);
    return { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t };
  }

  /** Точка мира → клетка библиотеки (или null за пределами поля). */
  cellAt(wx: number, wy: number): Cell | null {
    const vx = Math.floor(wx / CELL);
    const vy = Math.floor(wy / CELL);
    if (vx < 0 || vy < 0 || vx >= this.cols || vy >= this.rows) return null;
    return this.toLogic({ x: vx, y: vy });
  }

  /** С какой стороны экрана дверь и дальняя стена. */
  get doorSide(): Side {
    return this.orient === 'portrait' ? 'bottom' : this.orient === 'left' ? 'left' : 'right';
  }

  get farSide(): Side {
    return this.orient === 'portrait' ? 'top' : this.orient === 'left' ? 'right' : 'left';
  }

  /** Ряды стеллажей идут по горизонтали экрана (портрет) или по вертикали (ландшафт). */
  get shelfDir(): 'h' | 'v' {
    return this.orient === 'portrait' ? 'h' : 'v';
  }

  get width(): number {
    return this.cols * CELL;
  }

  get height(): number {
    return this.rows * CELL;
  }
}

/** Угол поворота «развёрнутой наружу» стены: её основание смотрит в комнату. */
export function sideAngle(side: Side): number {
  switch (side) {
    case 'top':
      return 0;
    case 'right':
      return Math.PI / 2;
    case 'bottom':
      return Math.PI;
    case 'left':
      return -Math.PI / 2;
  }
}
