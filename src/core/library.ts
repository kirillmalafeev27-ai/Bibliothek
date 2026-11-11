/**
 * Библиотека: сетка 9 × 11 в координатах библиотеки (план, 2.1).
 * Ряд 0 — дальняя стена, ряд 10 — ближняя стена с дверью посередине.
 */

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export const TILE = {
  floor: 0,
  /** Скрипучая половица — пол, который скрипит. */
  squeak: 1,
  shelf: 2,
  door: 3,
} as const;

export type Tile = (typeof TILE)[keyof typeof TILE];

export interface Library {
  readonly w: number;
  readonly h: number;
  readonly tiles: readonly Tile[];
  readonly door: Cell;
  /** Клетка за дверью, где герой начинает и куда возвращается после поимки. */
  readonly start: Cell;
  /** Столы библиотекарей (2.1.5). */
  readonly desks: readonly Cell[];
}

/** Порядок перебора направлений библиотекарем: вверх, влево, вниз, вправо (2.3.7). */
export const DIRS: readonly Cell[] = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
];

export function cellIndex(lib: { w: number }, x: number, y: number): number {
  return y * lib.w + x;
}

export function cellOf(lib: { w: number }, index: number): Cell {
  return { x: index % lib.w, y: Math.floor(index / lib.w) };
}

export function inBounds(lib: { w: number; h: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < lib.w && y < lib.h;
}

export function tileAt(lib: Library, x: number, y: number): Tile {
  if (!inBounds(lib, x, y)) return TILE.shelf;
  return lib.tiles[cellIndex(lib, x, y)] as Tile;
}

/** Пол или скрипучая половица: клетка, по которой ходят и герой, и библиотекарь. */
export function isFloor(lib: Library, x: number, y: number): boolean {
  const t = tileAt(lib, x, y);
  return t === TILE.floor || t === TILE.squeak;
}

export function isSqueak(lib: Library, x: number, y: number): boolean {
  return tileAt(lib, x, y) === TILE.squeak;
}

export function isDoor(lib: Library, c: Cell): boolean {
  return c.x === lib.door.x && c.y === lib.door.y;
}

export function sameCell(a: Cell | null | undefined, b: Cell | null | undefined): boolean {
  return !!a && !!b && a.x === b.x && a.y === b.y;
}

/** Расстояние между центрами клеток — им меряется слух и бросок (2.4.1). */
export function distance(a: Cell, b: Cell): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function floorCells(lib: Library): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < lib.h; y++) {
    for (let x = 0; x < lib.w; x++) {
      if (isFloor(lib, x, y)) out.push({ x, y });
    }
  }
  return out;
}

export function neighbours(c: Cell): Cell[] {
  return DIRS.map((d) => ({ x: c.x + d.x, y: c.y + d.y }));
}

/** Текстовый вид карты — для тестов и отладки. */
export function libraryToString(lib: Library, marks?: Record<string, Cell[]>): string {
  const rows: string[] = [];
  for (let y = 0; y < lib.h; y++) {
    let row = '';
    for (let x = 0; x < lib.w; x++) {
      const t = tileAt(lib, x, y);
      let ch = t === TILE.shelf ? '#' : t === TILE.door ? 'D' : t === TILE.squeak ? '~' : '.';
      if (marks) {
        for (const [mark, cells] of Object.entries(marks)) {
          if (cells.some((c) => c.x === x && c.y === y)) ch = mark;
        }
      }
      row += ch;
    }
    rows.push(row);
  }
  return rows.join('\n');
}
