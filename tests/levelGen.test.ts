import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { levels } from '../src/config/levels';
import {
  TILE,
  allFloorConnected,
  distanceMap,
  cellIndex,
  generateLevel,
  sameCell,
  squeaksAvoidable,
  tourLength,
} from '../src/core';

const SEEDS = 1000;

describe('генератор уровня (раздел 5)', () => {
  it('одинаковый сид даёт одинаковую библиотеку', () => {
    for (const level of levels) {
      const a = generateLevel(level, 12345);
      const b = generateLevel(level, 12345);
      expect(a.lib.tiles).toEqual(b.lib.tiles);
      expect(a.pages).toEqual(b.pages);
      expect(a.books).toEqual(b.books);
      expect(a.lib.desks).toEqual(b.lib.desks);
    }
  });

  it('разные сиды дают разные библиотеки', () => {
    const level = levels[2]!;
    const seen = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) seen.add(generateLevel(level, seed).lib.tiles.join(''));
    expect(seen.size).toBeGreaterThan(40);
  });

  for (const level of levels) {
    it(
      `уровень ${level.id}: ${SEEDS} сидов — связно, обход нужной длины, половицы обходимы`,
      { timeout: 120_000 },
      () => {
        let widened = 0;
        for (let seed = 1; seed <= SEEDS; seed++) {
          const g = generateLevel(level, seed);
          const { lib } = g;
          const { w, h } = balance.grid;
          expect(lib.w).toBe(w);
          expect(lib.h).toBe(h);

          // Внешнее кольцо — стеллажи, дверь посередине ближней стены, старт над ней.
          for (let x = 0; x < w; x++) {
            expect(lib.tiles[x]).toBe(TILE.shelf);
            if (x !== 4) expect(lib.tiles[(h - 1) * w + x]).toBe(TILE.shelf);
          }
          for (let y = 0; y < h; y++) {
            expect(lib.tiles[y * w]).toBe(TILE.shelf);
            expect(lib.tiles[y * w + w - 1]).toBe(TILE.shelf);
          }
          expect(lib.door).toEqual({ x: 4, y: 10 });
          expect(lib.start).toEqual({ x: 4, y: 9 });
          expect(lib.tiles[10 * w + 4]).toBe(TILE.door);

          // Ряды стеллажей с 2–3 проходами; между рядами проходы во всю ширину.
          for (let y = 1; y < h - 1; y++) {
            let floor = 0;
            for (let x = 1; x < w - 1; x++) if (lib.tiles[y * w + x] !== TILE.shelf) floor++;
            if ((balance.shelfRows as readonly number[]).includes(y)) {
              expect(floor).toBeGreaterThanOrEqual(balance.gapsPerRow.min);
              expect(floor).toBeLessThanOrEqual(balance.gapsPerRow.max);
            } else {
              expect(floor).toBe(w - 2);
            }
          }

          expect(allFloorConnected(lib)).toBe(true);
          expect(squeaksAvoidable(lib)).toBe(true);

          // Столы: один — на самой далёкой клетке ряда 1; два — в дальних углах.
          expect(lib.desks.length).toBe(level.librarians);
          for (const d of lib.desks) expect(d.y).toBe(1);
          if (level.librarians === 2) {
            expect(lib.desks).toEqual([
              { x: 1, y: 1 },
              { x: 7, y: 1 },
            ]);
          } else {
            const dist = distanceMap(lib, lib.start);
            const desk = lib.desks[0]!;
            const dDesk = dist[cellIndex(lib, desk.x, desk.y)]!;
            for (let x = 1; x < w - 1; x++) {
              // Клетки прямо над проходом стол не занимает; среди остальных он самый далёкий.
              if (lib.tiles[2 * w + x] !== TILE.shelf) continue;
              expect(dDesk).toBeGreaterThanOrEqual(dist[cellIndex(lib, x, 1)]!);
            }
            expect(lib.tiles[2 * w + desk.x]).toBe(TILE.shelf);
          }

          // Листы: 3 клетки пола, не ближе 4 шагов к старту и друг к другу, не на столе.
          expect(g.pages.length).toBe(3);
          const fromStart = distanceMap(lib, lib.start);
          for (const p of g.pages) {
            expect(lib.tiles[cellIndex(lib, p.x, p.y)]).toBe(TILE.floor);
            expect(fromStart[cellIndex(lib, p.x, p.y)]!).toBeGreaterThanOrEqual(4);
            expect(lib.desks.some((d) => sameCell(d, p))).toBe(false);
            const fromPage = distanceMap(lib, p);
            for (const q of g.pages) {
              if (q === p) continue;
              expect(fromPage[cellIndex(lib, q.x, q.y)]!).toBeGreaterThanOrEqual(4);
            }
          }

          // Обход «старт → все листы → дверь» — 16–22 шага (или расширен с предупреждением).
          const tour = tourLength(lib, g.pages);
          expect(tour).toBe(g.tour);
          if (g.warnings.length === 0) {
            expect(tour).toBeGreaterThanOrEqual(balance.tour.min);
            expect(tour).toBeLessThanOrEqual(balance.tour.max);
          } else {
            widened++;
          }

          // Словари: не в ряду 1, не на листах и не на старте.
          expect(g.books.length).toBe(level.floorBooks);
          for (const b of g.books) {
            expect(b.y).not.toBe(1);
            expect(lib.tiles[cellIndex(lib, b.x, b.y)]).toBe(TILE.floor);
            expect(sameCell(b, lib.start)).toBe(false);
            expect(g.pages.some((p) => sameCell(p, b))).toBe(false);
          }

          // Скрипучие половицы: нужное число, не в ряду 1, не старт, не листы, не словари.
          let squeaks = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if (lib.tiles[y * w + x] !== TILE.squeak) continue;
              squeaks++;
              expect(y).not.toBe(1);
              const c = { x, y };
              expect(sameCell(c, lib.start)).toBe(false);
              expect(g.pages.some((p) => sameCell(p, c))).toBe(false);
              expect(g.books.some((b) => sameCell(b, c))).toBe(false);
            }
          }
          expect(squeaks).toBe(level.squeaks);
        }
        // Расширять диапазон обхода приходится редко.
        expect(widened).toBeLessThan(SEEDS * 0.01);
      },
    );
  }
});
