import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import type { GameEvent, GameState } from '../src/core';
import {
  cellIndex,
  distance,
  distanceMap,
  librarianPath,
  manicules,
  reduce,
  sameCell,
  slipperPrints,
  stepsBetween,
} from '../src/core';
import {
  A,
  advance,
  advanceUntil,
  apply,
  correct,
  makeState,
  moveTo,
  ofType,
  throwTo,
  wrong,
} from './helpers';

/** Сравнение времён с допуском на шаг тика. */
const TICK_TOL = 0.11;
function expectNear(actual: number, expected: number, tol = TICK_TOL): void {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

/**
 * Клетка двери: библиотекарь на неё не заходит, поэтому герой здесь не мешает ему бродить
 * (в игре герой оказывается на двери только в момент победы).
 */
const DOOR = { x: 4, y: 10 };

/** Тикает и на каждом тике вызывает наблюдателя с прошлым и новым состоянием. */
function watch(
  state: GameState,
  seconds: number,
  fn: (prev: GameState, next: GameState, events: GameEvent[]) => void,
  step = 0.05,
): GameState {
  let s = state;
  for (let t = 0; t < seconds; t += step) {
    const r = reduce(s, { type: 'TICK', dt: step });
    fn(s, r.state, r.events);
    s = r.state;
  }
  return s;
}

describe('библиотекарь: ходит и слушает (2.3.1, 2.3.2, 2.3.10)', () => {
  it('начало ночи: 2 единицы слушает у стола, потом начинает ходить', () => {
    const s0 = makeState();
    expect(s0.librarians[0]!.mode).toBe('listen');
    const before = advance(s0, A(s0, balance.firstListenA) - 0.2).state;
    expect(before.librarians[0]!.mode).toBe('listen');
    expect(sameCell(before.librarians[0]!.cell, { x: 1, y: 1 })).toBe(true);
    const after = advance(before, 0.4);
    expect(after.state.librarians[0]!.mode).toBe('walk');
    expect(after.state.librarians[0]!.target).not.toBeNull();
    expect(ofType(after.events, 'LISTEN_END').length).toBe(1);
  });

  it('одна клетка за walkStepA', () => {
    const s0 = makeState({ librarians: [{ nextSniffAt: Infinity }], hero: DOOR });
    const stepTimes: number[] = [];
    watch(s0, A(s0, 30), (_p, n, ev) => {
      for (const e of ev) if (e.type === 'LIB_STEP') stepTimes.push(n.time);
    });
    expect(stepTimes.length).toBeGreaterThan(5);
    // Первый шаг — через 2 A слушания + walkStepA.
    expectNear(stepTimes[0]!, A(s0, 2 + s0.level.walkStepA));
    // Подряд идущие шаги внутри серии разделены ровно walkStepA.
    const gaps = stepTimes.slice(1).map((t, i) => t - stepTimes[i]!);
    const within = gaps.filter((g) => g < A(s0, s0.level.walkStepA + 0.5));
    expect(within.length).toBeGreaterThan(0);
    for (const g of within) expectNear(g, A(s0, s0.level.walkStepA));
  });

  it('останавливается послушать после каждых 3 клеток и по приходе в точку', () => {
    const s0 = makeState({ librarians: [{ nextSniffAt: Infinity }], hero: DOOR });
    let steps = 0;
    let listens = 0;
    let arrivals = 0;
    watch(s0, A(s0, 120), (prev, next, ev) => {
      for (const e of ev) {
        if (e.type === 'LIB_STEP') steps++;
        if (e.type === 'LISTEN_START') {
          const m = next.librarians[0]!;
          listens++;
          expect(steps).toBeGreaterThan(0);
          expect(steps).toBeLessThanOrEqual(balance.burst);
          if (steps < balance.burst) {
            // Меньше трёх клеток — значит, пришёл в точку маршрута.
            expect(m.atWaypoint).toBe(true);
          }
          if (m.atWaypoint) {
            arrivals++;
            expect(sameCell(m.cell, prev.librarians[0]!.target)).toBe(true);
          }
          steps = 0;
        }
      }
      expect(steps).toBeLessThanOrEqual(balance.burst);
    });
    expect(listens).toBeGreaterThan(8);
    expect(arrivals).toBeGreaterThan(2);
  });

  it('слушает listenA = 1.5 единицы, вокруг — нимб радиусом 2.25', () => {
    const s0 = makeState({ librarians: [{ nextSniffAt: Infinity }], hero: DOOR });
    const r = advanceUntil(s0, (_s, ev) => ev.some((e) => e.type === 'LISTEN_START'));
    const t0 = r.state.time;
    expect(r.state.librarians[0]!.mode).toBe('listen');
    const r2 = advanceUntil(r.state, (_s, ev) => ev.some((e) => e.type === 'LISTEN_END'));
    expectNear(r2.state.time - t0, A(s0, balance.listenA));
  });

  it('обычная точка маршрута — клетка пола в 4–10 шагах', () => {
    let s = makeState({ librarians: [{ nextSniffAt: Infinity }], hero: DOOR });
    let seen = 0;
    for (let t = 0; t < A(s, 200); t += 0.05) {
      const r = reduce(s, { type: 'TICK', dt: 0.05 });
      for (const e of r.events) {
        if (e.type !== 'WAYPOINT') continue;
        seen++;
        const from = s.librarians[0]!.cell;
        const d = stepsBetween(s.lib, from, e.target);
        expect(d).toBeGreaterThanOrEqual(balance.waypoint.minSteps);
        expect(d).toBeLessThanOrEqual(balance.waypoint.maxSteps);
      }
      s = r.state;
    }
    expect(seen).toBeGreaterThan(4);
  });

  it('путь всегда кратчайший, маникула никогда не врёт (2.3.7)', () => {
    const s0 = makeState({ level: 3, hero: DOOR });
    let checked = 0;
    watch(s0, A(s0, 150), (prev, next, ev) => {
      for (const e of ev) {
        if (e.type !== 'LIB_STEP') continue;
        const mPrev = prev.librarians[e.m]!;
        // Шаг сделан ровно на ту клетку, которую показывал путь до шага.
        const expected = librarianPath(prev, mPrev, 1)[0];
        expect(expected).toEqual(e.to);
        // Маникула стояла над его целью.
        const hand = manicules(prev).find((h) => h.m === e.m);
        expect(hand).toBeDefined();
        expect(sameCell(hand!.cell, mPrev.target)).toBe(true);
        // Шаг сокращает расстояние до цели ровно на 1.
        const before = stepsBetween(prev.lib, e.from, mPrev.target!);
        const after = stepsBetween(prev.lib, e.to, mPrev.target!);
        expect(after).toBe(before - 1);
        checked++;
      }
      void next;
    });
    expect(checked).toBeGreaterThan(20);
  });

  it('отпечатки тапочек — следующие 3 клетки его пути, только на уровнях с подсказкой', () => {
    const mk = (level: number) =>
      makeState({
        level,
        hero: { x: 7, y: 9 },
        librarians: [
          {
            cell: { x: 1, y: 1 },
            mode: 'walk',
            target: { x: 3, y: 3 },
            timer: 1e6,
            atWaypoint: false,
          },
        ],
      });
    expect(slipperPrints(mk(1), mk(1).librarians[0]!)).toEqual([
      { x: 1, y: 2 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
    ]);
    expect(slipperPrints(mk(4), mk(4).librarians[0]!)).toEqual([]);
  });
});

describe('нюх (2.3.5)', () => {
  it('раз в sniffA следующая точка маршрута — в пределах 2 клеток от героя', () => {
    const s0 = makeState({ hero: { x: 6, y: 7 }, librarians: [{ nextSniffAt: 0 }] });
    const r = advanceUntil(s0, (_s, ev) => ev.some((e) => e.type === 'SNIFF'));
    const sniff = ofType(r.events, 'SNIFF')[0]!;
    expect(distance(sniff.target, { x: 6, y: 7 })).toBeLessThanOrEqual(balance.sniffR);
    const m = r.state.librarians[0]!;
    expect(sameCell(m.target, sniff.target)).toBe(true);
    expect(m.sniffed).toBe(true);
    // Маникула золотая — учуял (2.8.3).
    expect(manicules(r.state)[0]!.tone).toBe('gold');
    // Следующий раз — не раньше чем через sniffA.
    expect(m.nextSniffAt).toBeCloseTo(r.state.time + A(s0, s0.level.sniffA), 5);
  });

  it('принюхивается не чаще раза в sniffA, обычные точки между ними — чернильные', () => {
    const s0 = makeState({ level: 3, hero: { x: 7, y: 9 } });
    let s: GameState = { ...s0, debug: { deaf: true, infiniteCards: true } };
    const sniffTimes: number[] = [];
    let waypoints = 0;
    const total = A(s, 80);
    for (let t = 0; t < total; t += 0.05) {
      const r = reduce(s, { type: 'TICK', dt: 0.05 });
      for (const e of r.events) {
        if (e.type === 'SNIFF') sniffTimes.push(r.state.time);
        if (e.type === 'WAYPOINT') {
          waypoints++;
          expect(manicules(r.state).find((h) => h.m === e.m)?.tone ?? 'ink').toBe('ink');
        }
      }
      s = r.state;
    }
    expect(sniffTimes.length).toBeGreaterThanOrEqual(3);
    expect(sniffTimes.length).toBeLessThanOrEqual(8);
    expect(waypoints).toBeGreaterThan(0);
    for (let i = 1; i < sniffTimes.length; i++) {
      expect(sniffTimes[i]! - sniffTimes[i - 1]!).toBeGreaterThanOrEqual(A(s, s.level.sniffA) - 1e-6);
    }
    expect(sniffTimes[0]!).toBeGreaterThanOrEqual(A(s, s.level.sniffA) - 1e-6);
  });
});

describe('бег на звук и поиск (2.3.3, 2.3.4)', () => {
  // Библиотекарь идёт в (1,1) → …; герой в (3,3): расстояние √8 ≈ 2.83 < loudR 3.0.
  const scene = (level = 1) =>
    makeState({
      level,
      hero: { x: 3, y: 3 },
      librarians: [
        {
          cell: { x: 1, y: 1 },
          mode: 'walk',
          timer: 1e6,
          stepDur: 1e6,
          target: { x: 7, y: 1 },
          atWaypoint: false,
          nextSniffAt: Infinity,
        },
      ],
    });

  it('услышав звук, сначала замирает на alertA, потом бежит к клетке звука', () => {
    const s0 = scene();
    const r = apply(s0, wrong);
    const m = r.state.librarians[0]!;
    expect(ofType(r.events, 'ALERT')).toEqual([{ type: 'ALERT', m: 0, cell: { x: 3, y: 3 } }]);
    expect(m.mode).toBe('alert');
    expect(m.timer).toBeCloseTo(A(s0, s0.level.alertA), 6);
    expect(sameCell(m.target, { x: 3, y: 3 })).toBe(true);
    // Маникула кармином — бежит на звук.
    expect(manicules(r.state)[0]).toMatchObject({ tone: 'alarm', cell: { x: 3, y: 3 } });

    // Пока «Wer da?» — стоит на месте.
    const still = advance(r.state, A(s0, s0.level.alertA) - 0.2);
    expect(still.state.librarians[0]!.mode).toBe('alert');
    expect(ofType(still.events, 'LIB_STEP').length).toBe(0);

    const run = advance(still.state, 0.4);
    expect(run.state.librarians[0]!.mode).toBe('run');
    expect(ofType(run.events, 'RUN').length).toBe(1);
  });

  it('бежит одну клетку за huntStepA и, добежав, ищет searchA = 2.5 единицы с нимбом', () => {
    const s0 = scene();
    // Герой ошибся и ушёл в сторону: (3,3) → (5,3).
    let s = apply(s0, wrong, moveTo(5, 3), correct, correct).state;
    expect(s.hero.cell).toEqual({ x: 5, y: 3 });
    const stepTimes: number[] = [];
    const r = advanceUntil(s, (n, ev) => {
      for (const e of ev) if (e.type === 'LIB_STEP') stepTimes.push(n.time);
      return ev.some((e) => e.type === 'SEARCH_START');
    });
    s = r.state;
    expect(stepTimes.length).toBe(4); // (1,2) (1,3) (2,3) (3,3)
    expectNear(stepTimes[0]!, A(s0, s0.level.alertA + s0.level.huntStepA));
    for (let i = 1; i < stepTimes.length; i++) {
      expectNear(stepTimes[i]! - stepTimes[i - 1]!, A(s0, s0.level.huntStepA));
    }
    const m = s.librarians[0]!;
    expect(m.mode).toBe('search');
    expect(sameCell(m.cell, { x: 3, y: 3 })).toBe(true);

    const t0 = s.time;
    const calm = advanceUntil(s, (_n, ev) => ev.some((e) => e.type === 'CALM'));
    expectNear(calm.state.time - t0, A(s0, balance.searchA));
    expect(calm.state.librarians[0]!.mode).toBe('walk');
    expect(calm.state.librarians[0]!.anger).toBe(0);
  });

  it('на бегу тихих шагов не слышит, но громкий звук или словарь меняют цель', () => {
    const s0 = makeState({
      level: 3,
      hero: { x: 3, y: 3 },
      heroBooks: 2,
      librarians: [
        {
          cell: { x: 1, y: 3 },
          mode: 'run',
          timer: 1e6,
          stepDur: 1e6,
          target: { x: 3, y: 3 },
          atWaypoint: false,
          cause: 'error',
        },
      ],
    });
    // Тихий шаг рядом с бегущим: не слышит.
    const quiet = apply(s0, moveTo(4, 3), correct);
    expect(ofType(quiet.events, 'SOUND')[0]!.heardBy).toEqual([]);
    expect(sameCell(quiet.state.librarians[0]!.target, { x: 3, y: 3 })).toBe(true);
    expect(quiet.state.stats.heard).toBe(0);
    // Словарь меняет цель и не злит.
    const book = apply(quiet.state, throwTo(7, 3), correct);
    expect(sameCell(book.state.librarians[0]!.target, { x: 7, y: 3 })).toBe(true);
    expect(book.state.librarians[0]!.anger).toBe(0);
    expect(book.state.librarians[0]!.mode).toBe('run');
    // Ошибка рядом меняет цель и злит.
    const err = apply(book.state, wrong);
    expect(sameCell(err.state.librarians[0]!.target, { x: 4, y: 3 })).toBe(true);
    expect(err.state.librarians[0]!.anger).toBe(1);
  });

  it('ищущий библиотекарь слышит тихий шаг в нимбе и бежит к нему', () => {
    const s0 = makeState({
      level: 4,
      hero: { x: 4, y: 7 },
      librarians: [{ cell: { x: 4, y: 5 }, mode: 'search', timer: 1e6, target: { x: 4, y: 5 } }],
    });
    const r = apply(s0, moveTo(5, 7), correct);
    expect(ofType(r.events, 'SOUND')[0]).toMatchObject({ kind: 'step', heardBy: [0] });
    const m = r.state.librarians[0]!;
    expect(m.mode).toBe('run');
    expect(sameCell(m.target, { x: 5, y: 7 })).toBe(true);
    expect(m.anger).toBe(1);
  });
});

describe('злость (2.3.6)', () => {
  const searching = (level: number) =>
    makeState({
      level,
      hero: { x: 4, y: 7 },
      heroBooks: 3,
      librarians: [{ cell: { x: 4, y: 5 }, mode: 'search', timer: 1e6, target: { x: 4, y: 5 } }],
    });

  it('растёт на 1, когда он слышит героя на бегу или в поиске, но не выше 2', () => {
    let s = searching(3);
    s = apply(s, wrong).state;
    expect(s.librarians[0]!.anger).toBe(1);
    expect(s.librarians[0]!.mode).toBe('run');
    s = apply(s, wrong).state;
    expect(s.librarians[0]!.anger).toBe(2);
    s = apply(s, wrong).state;
    expect(s.librarians[0]!.anger).toBe(balance.maxAnger);
    expect(s.stats.heard).toBe(3);
  });

  it('не растёт от звука, услышанного в спокойном состоянии или во время «Wer da?»', () => {
    let s = makeState({
      level: 3,
      hero: { x: 4, y: 7 },
      librarians: [{ cell: { x: 4, y: 5 }, mode: 'walk', timer: 1e6, target: { x: 1, y: 5 } }],
    });
    s = apply(s, wrong).state;
    expect(s.librarians[0]!.mode).toBe('alert');
    expect(s.librarians[0]!.anger).toBe(0);
    s = apply(s, wrong).state;
    expect(s.librarians[0]!.mode).toBe('alert');
    expect(s.librarians[0]!.anger).toBe(0);
  });

  it('шаг бега умножается на 0.75 при злости 1 и на 0.6 при злости 2', () => {
    for (const anger of [0, 1, 2]) {
      const s0 = makeState({
        level: 3,
        hero: { x: 7, y: 9 },
        librarians: [
          {
            cell: { x: 1, y: 1 },
            mode: 'alert',
            timer: 0.01,
            target: { x: 7, y: 1 },
            anger,
            atWaypoint: false,
          },
        ],
      });
      const times: number[] = [];
      advanceUntil(
        s0,
        (n, ev) => {
          for (const e of ev) if (e.type === 'LIB_STEP') times.push(n.time);
          return times.length >= 3;
        },
        200,
        0.01,
      );
      const mul = balance.angerMul[anger]!;
      expectNear(times[1]! - times[0]!, A(s0, s0.level.huntStepA * mul));
    }
    expect(balance.angerMul).toEqual([1, 0.75, 0.6]);
  });

  it('брошенный словарь не злит', () => {
    let s = searching(3);
    s = apply(s, throwTo(4, 3), correct).state;
    expect(s.librarians[0]!.anger).toBe(0);
    expect(s.librarians[0]!.mode).toBe('run');
    expect(s.stats.heard).toBe(0);
  });

  it('сбрасывается после спокойного поиска', () => {
    let s = searching(3);
    s = apply(s, wrong, wrong).state;
    expect(s.librarians[0]!.anger).toBe(2);
    // Герой уходит, библиотекарь добегает, ищет и успокаивается.
    s = { ...s, hero: { ...s.hero, cell: { x: 7, y: 9 } } };
    const r = advanceUntil(s, (_n, ev) => ev.some((e) => e.type === 'CALM'));
    expect(ofType(r.events, 'CALM').length).toBe(1);
    expect(r.state.librarians[0]!.anger).toBe(0);
  });

  it('на уровне 1 злости нет', () => {
    let s = searching(1);
    s = apply(s, wrong, wrong).state;
    expect(s.librarians[0]!.anger).toBe(0);
  });
});

describe('двое библиотекарей (2.3.9)', () => {
  it('действуют независимо и слышат каждый сам по себе', () => {
    const s0 = makeState({
      level: 6,
      hero: { x: 2, y: 3 },
      librarians: [
        { cell: { x: 1, y: 1 }, mode: 'walk', timer: 1e6, target: { x: 4, y: 1 } },
        { cell: { x: 7, y: 1 }, mode: 'walk', timer: 1e6, target: { x: 4, y: 1 } },
      ],
    });
    const r = apply(s0, wrong);
    // Первый в 2.24 клетки — слышит; второй в 5.4 — нет.
    expect(ofType(r.events, 'SOUND')[0]!.heardBy).toEqual([0]);
    expect(r.state.librarians[0]!.mode).toBe('alert');
    expect(r.state.librarians[1]!.mode).toBe('walk');
  });

  it('на одной клетке не стоят', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const base = makeState({ level: 6, seed, hero: { x: 4, y: 9 }, heroBooks: 3 });
      let s: GameState = {
        ...base,
        librarians: base.librarians.concat([
          { ...base.librarians[0]!, id: 1, cell: { x: 7, y: 1 }, desk: { x: 7, y: 1 } },
        ]),
        debug: { deaf: false, infiniteCards: true },
      };
      const throws = [
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 1, y: 7 },
        { x: 4, y: 8 },
        { x: 7, y: 7 },
      ];
      let k = 0;
      for (let t = 0; t < A(s, 150); t += 0.05) {
        const r = reduce(s, { type: 'TICK', dt: 0.05 });
        s = r.state;
        if (s.status === 'playing') {
          const [a, b] = s.librarians;
          expect(sameCell(a!.cell, b!.cell)).toBe(false);
        }
        // Время от времени оба бегут к одному словарю.
        if (Math.floor(t / A(s, 12)) > k && s.status === 'playing') {
          k++;
          const target = throws[k % throws.length]!;
          s = { ...s, hero: { ...s.hero, books: 3, ready: false } };
          s = apply(s, { type: 'SET_INTENT', kind: 'throw', cell: target }, correct).state;
        }
      }
      expect(k).toBeGreaterThan(5);
    }
  });
});

describe('библиотекарь не всезнающий (17.4)', () => {
  it('без звуков и нюха он не идёт к герою намеренно: точки маршрута не зависят от героя', () => {
    const run = (hero: { x: number; y: number }) => {
      let s = makeState({ hero, librarians: [{ nextSniffAt: Infinity }], seed: 7 });
      s = { ...s, debug: { deaf: true, infiniteCards: true } };
      const targets: string[] = [];
      for (let t = 0; t < A(s, 60); t += 0.05) {
        const r = reduce(s, { type: 'TICK', dt: 0.05 });
        // После поимки библиотекарь уходит к столу — дальше маршруты расходятся законно.
        if (r.events.some((e) => e.type === 'CAUGHT')) break;
        for (const e of r.events) if (e.type === 'WAYPOINT') targets.push(`${e.target.x},${e.target.y}`);
        s = r.state;
      }
      return targets;
    };
    const a = run({ x: 7, y: 9 });
    const b = run({ x: 1, y: 9 });
    const n = Math.min(a.length, b.length);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(a.slice(0, n)).toEqual(b.slice(0, n));
  });

  it('дистанции до точек считаются по карте расстояний', () => {
    const s = makeState();
    const map = distanceMap(s.lib, { x: 1, y: 1 });
    expect(map[cellIndex(s.lib, 3, 3)]).toBe(4);
  });
});
