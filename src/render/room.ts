/**
 * Комната глазами вида: клетки в экранных координатах, ряды стеллажей, стены, дверь.
 * Из этого описания запекается фон (пол и стены) и строятся спрайты стеллажей.
 */
import type { Cell, Library } from '../core';
import { TILE, cellIndex } from '../core';
import type { Mapper, Side } from './orientation';

export type ViewTile = 'floor' | 'squeak' | 'shelf' | 'wall' | 'door';

export interface ShelfRun {
  /** Ряд идёт по горизонтали или по вертикали экрана. */
  dir: 'h' | 'v';
  /** Левая верхняя клетка ряда на экране. */
  x: number;
  y: number;
  /** Длина в клетках. */
  len: number;
  /** Клетки ряда в координатах библиотеки. */
  cells: Cell[];
}

export interface RoomView {
  cols: number;
  rows: number;
  /** Тип каждой клетки экрана: tiles[y * cols + x]. */
  tiles: ViewTile[];
  door: Cell;
  doorSide: Side;
  farSide: Side;
  start: Cell;
  desks: Cell[];
  runs: ShelfRun[];
}

export function tileOf(room: RoomView, x: number, y: number): ViewTile {
  if (x < 0 || y < 0 || x >= room.cols || y >= room.rows) return 'wall';
  return room.tiles[y * room.cols + x] as ViewTile;
}

export function buildRoomView(lib: Library, mapper: Mapper): RoomView {
  const { cols, rows } = mapper;
  const tiles: ViewTile[] = new Array<ViewTile>(cols * rows).fill('wall');
  for (let y = 0; y < lib.h; y++) {
    for (let x = 0; x < lib.w; x++) {
      const t = lib.tiles[cellIndex(lib, x, y)];
      const v = mapper.toView({ x, y });
      const edge = x === 0 || y === 0 || x === lib.w - 1 || y === lib.h - 1;
      let kind: ViewTile;
      if (t === TILE.door) kind = 'door';
      else if (t === TILE.floor) kind = 'floor';
      else if (t === TILE.squeak) kind = 'squeak';
      else kind = edge ? 'wall' : 'shelf';
      tiles[v.y * cols + v.x] = kind;
    }
  }
  // Ряды стеллажей: подряд идущие клетки-стеллажи в одном ряду библиотеки.
  const runs: ShelfRun[] = [];
  for (let y = 1; y < lib.h - 1; y++) {
    let x = 1;
    while (x < lib.w - 1) {
      if (lib.tiles[cellIndex(lib, x, y)] !== TILE.shelf) {
        x++;
        continue;
      }
      const cells: Cell[] = [];
      while (x < lib.w - 1 && lib.tiles[cellIndex(lib, x, y)] === TILE.shelf) {
        cells.push({ x, y });
        x++;
      }
      const views = cells.map((c) => mapper.toView(c));
      const minX = Math.min(...views.map((v) => v.x));
      const minY = Math.min(...views.map((v) => v.y));
      runs.push({ dir: mapper.shelfDir, x: minX, y: minY, len: cells.length, cells });
    }
  }
  return {
    cols,
    rows,
    tiles,
    door: mapper.toView(lib.door),
    doorSide: mapper.doorSide,
    farSide: mapper.farSide,
    start: mapper.toView(lib.start),
    desks: lib.desks.map((d) => mapper.toView(d)),
    runs,
  };
}

/** Какая стена у клетки внешнего кольца (угловые клетки — без стороны). */
export function wallSideOf(room: RoomView, x: number, y: number): Side | 'corner' | null {
  const left = x === 0;
  const right = x === room.cols - 1;
  const top = y === 0;
  const bottom = y === room.rows - 1;
  const count = Number(left) + Number(right) + Number(top) + Number(bottom);
  if (count === 0) return null;
  if (count > 1) return 'corner';
  return left ? 'left' : right ? 'right' : top ? 'top' : 'bottom';
}
