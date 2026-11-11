import { describe, expect, it } from 'vitest';
import { cellIndex, distanceMap, heroRoute, shortestPath, stepsBetween } from '../src/core';
import { PLAIN_MAP, parseMap } from './helpers';

describe('поиск пути (2.1.4, 2.3.7, 2.2.2)', () => {
  const lib = parseMap(PLAIN_MAP);

  it('ходить можно в 4 направлениях, стеллажи непроходимы', () => {
    const path = shortestPath(lib, { x: 1, y: 1 }, { x: 3, y: 3 })!;
    expect(path).toEqual([
      { x: 1, y: 2 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ]);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
    }
  });

  it('путь всегда кратчайший', () => {
    const map = distanceMap(lib, { x: 4, y: 9 });
    for (let y = 1; y < 10; y++) {
      for (let x = 1; x < 8; x++) {
        const d = map[cellIndex(lib, x, y)]!;
        if (d < 0) continue;
        const path = shortestPath(lib, { x: 4, y: 9 }, { x, y })!;
        expect(path.length).toBe(d);
      }
    }
  });

  it('при равных путях направления перебираются: вверх, влево, вниз, вправо', () => {
    // Из (2,3) в (3,5) два пути по 5 шагов: через проход (1,4) и через (4,4).
    expect(stepsBetween(lib, { x: 2, y: 3 }, { x: 3, y: 5 })).toBe(5);
    const path = shortestPath(lib, { x: 2, y: 3 }, { x: 3, y: 5 })!;
    // Вверх — стеллаж, поэтому первым подходит «влево».
    expect(path[0]).toEqual({ x: 1, y: 3 });
    expect(path).toEqual([
      { x: 1, y: 3 },
      { x: 1, y: 4 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
    ]);
    // Из (4,5) в (4,3): «вверх» подходит сразу.
    expect(shortestPath(lib, { x: 4, y: 5 }, { x: 4, y: 3 })![0]).toEqual({ x: 4, y: 4 });
  });

  it('на дверь библиотекарь не заходит', () => {
    expect(shortestPath(lib, { x: 4, y: 9 }, { x: 4, y: 10 })).toBeNull();
    expect(shortestPath(lib, { x: 4, y: 9 }, { x: 4, y: 10 }, { allowDoor: true })).toEqual([
      { x: 4, y: 10 },
    ]);
  });

  it('пути нет — null; та же клетка — пустой путь', () => {
    expect(shortestPath(lib, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
    expect(shortestPath(lib, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });
});

describe('маршрут героя обходит скрипучие половицы (2.2.2)', () => {
  it('обход не длиннее чем на 2 шага — половица обходится', () => {
    // Половица в проходе (4,8); соседний проход (3,8) даёт обход на 2 шага длиннее.
    const lib = parseMap([
      '#########',
      '#.......#',
      '#.##.##.#',
      '#.......#',
      '#.##.##.#',
      '#.......#',
      '#.##.##.#',
      '#.......#',
      '#.#.~##.#',
      '#.......#',
      '####D####',
    ]);
    const path = heroRoute(lib, { x: 4, y: 9 }, { x: 4, y: 7 }, 2)!;
    expect(path.length).toBe(4);
    expect(path.some((c) => c.x === 4 && c.y === 8)).toBe(false);
    expect(path).toEqual([
      { x: 3, y: 9 },
      { x: 3, y: 8 },
      { x: 3, y: 7 },
      { x: 4, y: 7 },
    ]);
  });

  it('обход длиннее чем на 2 шага — герой идёт по половице', () => {
    // Ближайший тихий проход — (1,8): обход 8 шагов против 2.
    const lib = parseMap([
      '#########',
      '#.......#',
      '#.##.##.#',
      '#.......#',
      '#.##.##.#',
      '#.......#',
      '#.##.##.#',
      '#.......#',
      '#.##~##.#',
      '#.......#',
      '####D####',
    ]);
    const path = heroRoute(lib, { x: 4, y: 9 }, { x: 4, y: 7 }, 2)!;
    expect(path).toEqual([
      { x: 4, y: 8 },
      { x: 4, y: 7 },
    ]);
  });

  it('из нескольких половиц выбирает путь с наименьшим их числом', () => {
    const lib = parseMap([
      '#########',
      '#.......#',
      '#.##.##.#',
      '#.......#',
      '#.##.##.#',
      '#.......#',
      '#.##.##.#',
      '#...~...#',
      '#.##~##.#',
      '#..~....#',
      '####D####',
    ]);
    // До (4,6)… цель (4,7) скрипит сама, проход (4,8) тоже: тихого пути в пределах +2 нет,
    // но путь через (4,8) наступает на 2 половицы — столько же, сколько любой другой короткий.
    const path = heroRoute(lib, { x: 4, y: 9 }, { x: 4, y: 7 }, 2)!;
    expect(path.length).toBe(2);
    // Клетка (3,9) скрипит, но маршрут до (2,9) её обходит только если обход ≤ 2 шагов: его нет.
    const row = heroRoute(lib, { x: 4, y: 9 }, { x: 2, y: 9 }, 2)!;
    expect(row).toEqual([
      { x: 3, y: 9 },
      { x: 2, y: 9 },
    ]);
  });

  it('через клетку библиотекаря не идёт', () => {
    const lib = parseMap(PLAIN_MAP);
    const blocked = new Set([cellIndex(lib, 4, 8)]);
    const path = heroRoute(lib, { x: 4, y: 9 }, { x: 4, y: 7 }, 2, { blocked })!;
    expect(path.some((c) => c.x === 4 && c.y === 8)).toBe(false);
    expect(path.length).toBe(8);
    expect(heroRoute(lib, { x: 4, y: 9 }, { x: 4, y: 8 }, 2, { blocked })).toBeNull();
  });

  it('на дверь — только как на конечную цель', () => {
    const lib = parseMap(PLAIN_MAP);
    expect(heroRoute(lib, { x: 4, y: 9 }, { x: 4, y: 10 }, 2)).toBeNull();
    expect(heroRoute(lib, { x: 3, y: 9 }, { x: 4, y: 10 }, 2, { allowDoor: true })).toEqual([
      { x: 4, y: 9 },
      { x: 4, y: 10 },
    ]);
  });
});
