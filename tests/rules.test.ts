import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { levels } from '../src/config/levels';
import type { Action, GameState } from '../src/core';
import {
  Rng,
  createState,
  floorCells,
  inEarshot,
  reduce,
  replay,
  sameCell,
  starsOf,
  unitSeconds,
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
  wrong,
} from './helpers';

const FAR = {
  cell: { x: 1, y: 1 },
  mode: 'walk' as const,
  timer: 1e6,
  stepDur: 1e6,
  target: { x: 7, y: 1 },
};

/** Библиотекарь в шаге от героя: следующим шагом войдёт на его клетку. */
const closing = (over: Partial<Parameters<typeof makeState>[0]> = {}) =>
  makeState({
    level: 3,
    hero: { x: 3, y: 3 },
    heroBooks: 2,
    heroPages: [0, 1],
    cards: 2,
    librarians: [
      {
        cell: { x: 2, y: 3 },
        desk: { x: 1, y: 1 },
        mode: 'run',
        timer: 0.5,
        stepDur: 1,
        target: { x: 3, y: 3 },
        anger: 2,
        atWaypoint: false,
        cause: 'error',
      },
    ],
    ...over,
  });

describe('поимка и билеты (2.3.8, 2.6.3, 2.6.4)', () => {
  it('поимка — библиотекарь вошёл на клетку героя', () => {
    const s0 = closing();
    const before = advance(s0, 0.4);
    expect(ofType(before.events, 'CAUGHT').length).toBe(0);
    const r = advance(before.state, 0.2);
    expect(ofType(r.events, 'CAUGHT')[0]).toMatchObject({
      m: 0,
      at: { x: 3, y: 3 },
      cause: 'error',
      last: false,
    });
    expect(r.state.stats.caught).toBe(1);
    expect(r.state.stats.caughtBy.error).toBe(1);
  });

  it('забирает билет, ставит героя у двери; листы и словари остаются, готовое действие сгорает', () => {
    const s0 = closing();
    const ready = apply(s0, correct).state;
    expect(ready.hero.ready).toBe(true);
    const r = advance(ready, 0.6);
    const s = r.state;
    expect(ofType(r.events, 'CARD_LOST')).toEqual([{ type: 'CARD_LOST', left: 1 }]);
    expect(s.hero.cards).toBe(1);
    expect(s.hero.cell).toEqual(s.lib.start);
    expect(s.hero.pages).toEqual([0, 1]);
    expect(s.hero.books).toBe(2);
    expect(s.hero.ready).toBe(false);
    expect(s.hero.intent).toEqual({ kind: 'stay' });
  });

  it('поймавший возвращается к столу и 4 единицы подшивает билет; злость сбрасывается', () => {
    const s0 = closing();
    const caught = advance(s0, 0.6).state;
    const m = caught.librarians[0]!;
    expect(m.cell).toEqual({ x: 1, y: 1 });
    expect(m.mode).toBe('file');
    expect(m.anger).toBe(0);
    expect(m.timer).toBeCloseTo(A(s0, balance.fileCardA), 6);
    expect(balance.fileCardA).toBe(4);
    // После сцены поимки он 4 единицы стоит у стола, потом идёт дальше.
    const afterScene = advance(caught, balance.catchSceneSec + 0.05).state;
    expect(afterScene.status).toBe('playing');
    const filing = advance(afterScene, A(s0, balance.fileCardA) - 0.5);
    expect(filing.state.librarians[0]!.mode).toBe('file');
    expect(ofType(filing.events, 'LIB_STEP').length).toBe(0);
    const done = advance(filing.state, 1);
    expect(ofType(done.events, 'FILE_END').length).toBe(1);
    expect(done.state.librarians[0]!.mode).toBe('walk');
  });

  it('сцена поимки останавливает часы мира не дольше 1.5 с', () => {
    const s0 = closing();
    const caught = advance(s0, 0.6).state;
    expect(caught.status).toBe('catchScene');
    expect(balance.catchSceneSec).toBeLessThanOrEqual(1.5);
    const t0 = caught.time;
    const timer0 = caught.librarians[0]!.timer;
    const mid = advance(caught, 1.0).state;
    expect(mid.status).toBe('catchScene');
    expect(mid.time).toBe(t0);
    expect(mid.librarians[0]!.timer).toBe(timer0);
    expect(mid.stats.timeSec).toBe(caught.stats.timeSec);
    // Ответы и намерения во время сцены не принимаются.
    expect(apply(mid, correct, moveTo(4, 7)).events).toEqual([]);
    const end = advance(mid, 0.55);
    expect(end.state.status).toBe('playing');
    expect(ofType(end.events, 'SCENE_END').length).toBe(1);
    // Дальше часы идут.
    expect(advance(end.state, 1).state.time).toBeGreaterThan(t0);
  });

  it('отдан последний билет — поражение', () => {
    const s0 = closing({ cards: 1 });
    const r = advance(s0, 0.6);
    expect(ofType(r.events, 'CAUGHT')[0]).toMatchObject({ last: true });
    expect(ofType(r.events, 'LOST').length).toBe(1);
    expect(r.state.status).toBe('lost');
    expect(r.state.hero.cards).toBe(0);
    expect(starsOf(r.state)).toBe(0);
    // После поражения мир стоит.
    const later = advance(r.state, 5);
    expect(later.events).toEqual([]);
    expect(later.state.time).toBe(r.state.time);
  });

  it('второй библиотекарь при поимке продолжает своё', () => {
    const s0 = makeState({
      level: 6,
      hero: { x: 3, y: 3 },
      librarians: [
        {
          cell: { x: 2, y: 3 },
          desk: { x: 1, y: 1 },
          mode: 'run',
          timer: 0.5,
          stepDur: 1,
          target: { x: 3, y: 3 },
          anger: 1,
        },
        {
          cell: { x: 7, y: 7 },
          desk: { x: 7, y: 1 },
          mode: 'run',
          timer: 30,
          stepDur: 40,
          target: { x: 5, y: 7 },
          anger: 2,
        },
      ],
    });
    const s = advance(s0, 0.6).state;
    expect(s.librarians[0]!.mode).toBe('file');
    expect(s.librarians[1]!.mode).toBe('run');
    expect(s.librarians[1]!.anger).toBe(2);
    expect(s.librarians[1]!.target).toEqual({ x: 5, y: 7 });
  });

  it('идущий библиотекарь тоже ловит: он слеп и идёт сквозь клетку героя', () => {
    const s0 = makeState({
      hero: { x: 3, y: 3 },
      librarians: [
        {
          cell: { x: 2, y: 3 },
          mode: 'walk',
          timer: 0.5,
          stepDur: 1,
          target: { x: 6, y: 3 },
          atWaypoint: false,
          cause: 'sniff',
        },
      ],
    });
    const r = advance(s0, 0.6);
    expect(ofType(r.events, 'CAUGHT')[0]).toMatchObject({ cause: 'sniff' });
    expect(r.state.stats.caughtBy.sniff).toBe(1);
  });
});

describe('победа и звёзды (2.6.2, 2.6.5)', () => {
  const atDoor = (patch: Partial<GameState['stats']> = {}) => {
    const s = makeState({ librarians: [FAR], heroPages: [0, 1, 2] });
    return { ...s, stats: { ...s.stats, ...patch } };
  };

  it('победа — герой вошёл на клетку двери со всеми тремя листами', () => {
    const r = apply(atDoor(), moveTo(4, 10), correct);
    expect(r.state.status).toBe('won');
    expect(ofType(r.events, 'EXIT')).toEqual([{ type: 'EXIT', near: false }]);
    expect(r.state.hero.cell).toEqual({ x: 4, y: 10 });
  });

  it('без всех листов дверь не пускает', () => {
    const s0 = makeState({ librarians: [FAR], heroPages: [0, 1] });
    const r = apply(s0, moveTo(4, 10), correct);
    expect(r.state.status).toBe('playing');
    expect(r.state.hero.cell).toEqual({ x: 4, y: 9 });
    expect(ofType(r.events, 'DENIED')[0]).toMatchObject({
      reason: 'blocked',
      cell: { x: 4, y: 10 },
    });
  });

  it('«Knapp!» — если библиотекарь был ближе 2 клеток', () => {
    const s0 = makeState({
      heroPages: [0, 1, 2],
      librarians: [
        { cell: { x: 5, y: 9 }, mode: 'walk', timer: 1e6, stepDur: 1e6, target: { x: 7, y: 9 } },
      ],
    });
    const r = apply(s0, moveTo(4, 10), correct);
    expect(ofType(r.events, 'EXIT')).toEqual([{ type: 'EXIT', near: true }]);
  });

  it('★ — вышел с картой; ★★ — ни разу не пойман; ★★★ — ни разу не услышан', () => {
    const win = (patch: Partial<GameState['stats']>) =>
      apply(atDoor(patch), moveTo(4, 10), correct).state;
    expect(starsOf(win({}))).toBe(3);
    expect(starsOf(win({ throws: 5 }))).toBe(3); // словари не считаются
    expect(starsOf(win({ heard: 1 }))).toBe(2);
    expect(starsOf(win({ caught: 1 }))).toBe(1);
    expect(starsOf(win({ caught: 1, heard: 4 }))).toBe(1);
    expect(starsOf(atDoor())).toBe(0); // ещё не вышел
  });
});

describe('пауза и честность времени (2.7)', () => {
  it('на паузе стоят библиотекари и все таймеры', () => {
    const s0 = makeState();
    const running = advance(s0, 3).state;
    const paused = apply(running, { type: 'PAUSE' });
    expect(ofType(paused.events, 'PAUSED').length).toBe(1);
    const later = advance(paused.state, 60);
    expect(later.events).toEqual([]);
    expect(later.state.time).toBe(running.time);
    expect(later.state.librarians).toEqual(running.librarians);
    expect(later.state.stats.timeSec).toBe(running.stats.timeSec);
    // Ответы и намерения на паузе не принимаются.
    const ignored = apply(paused.state, correct, wrong, moveTo(4, 7));
    expect(ignored.events).toEqual([]);
    expect(ignored.state.hero).toEqual(paused.state.hero);
    const resumed = apply(paused.state, { type: 'RESUME' });
    expect(ofType(resumed.events, 'RESUMED').length).toBe(1);
    expect(advance(resumed.state, 1).state.time).toBeGreaterThan(running.time);
  });

  it('шаг времени кадра ограничен 100 мс', () => {
    const s0 = makeState();
    const r = reduce(s0, { type: 'TICK', dt: 5 });
    expect(r.state.time).toBeCloseTo(0.1, 9);
    expect(balance.maxFrameDtSec).toBe(0.1);
    expect(reduce(s0, { type: 'TICK', dt: -1 }).state.time).toBe(0);
  });
});

describe('темп игрока (раздел 3)', () => {
  it('A = T_med + 0.45 с; медиана ограничена 3–10 с', () => {
    expect(unitSeconds(5)).toBeCloseTo(5.45, 9);
    expect(unitSeconds(1)).toBeCloseTo(3.45, 9);
    expect(unitSeconds(60)).toBeCloseTo(10.45, 9);
    expect(createState(levels[0]!, 1, { tMedSec: 8 }).unitA).toBeCloseTo(8.45, 9);
    expect(createState(levels[0]!, 1).unitA).toBeCloseTo(5.45, 9);
  });

  it('ответы, данные в кольце громкого слуха, в T_med не попадают', () => {
    const near = makeState({
      level: 3,
      hero: { x: 4, y: 7 },
      librarians: [
        { cell: { x: 4, y: 5 }, mode: 'walk', timer: 1e6, stepDur: 1e6, target: { x: 1, y: 5 } },
      ],
    });
    expect(inEarshot(near)).toBe(true);
    expect(ofType(apply(near, correct).events, 'ANSWERED')[0]).toMatchObject({ paced: false });

    const far = makeState({ librarians: [FAR] });
    expect(inEarshot(far)).toBe(false);
    expect(ofType(apply(far, correct).events, 'ANSWERED')[0]).toMatchObject({ paced: true });
  });

  it('вопрос, побывавший на экране в кольце громкого слуха, не учитывается, даже если герой уже вышел', () => {
    const near = makeState({
      level: 3,
      hero: { x: 4, y: 7 },
      librarians: [
        { cell: { x: 4, y: 5 }, mode: 'walk', timer: 1e6, stepDur: 1e6, target: { x: 1, y: 5 } },
      ],
    });
    const ticked = advance(near, 0.1).state;
    expect(ticked.questionTainted).toBe(true);
    // Библиотекарь ушёл далеко, вопрос тот же.
    const gone: GameState = {
      ...ticked,
      librarians: ticked.librarians.map((m) => ({ ...m, cell: { x: 1, y: 1 } })),
    };
    expect(inEarshot(gone)).toBe(false);
    const first = apply(gone, correct);
    expect(ofType(first.events, 'ANSWERED')[0]).toMatchObject({ paced: false });
    // Следующий вопрос — уже чистый.
    const second = apply(first.state, moveTo(4, 9), correct);
    expect(ofType(second.events, 'ANSWERED')[0]).toMatchObject({ paced: true });
  });
});

describe('детерминизм (13.3.5)', () => {
  function scriptedRun(level: number, seed: number): { state: GameState; log: Action[] } {
    let s = createState(levels[level - 1]!, seed);
    const rng = new Rng(seed * 7919 + level);
    const cells = floorCells(s.lib);
    const log: Action[] = [];
    const push = (a: Action): void => {
      log.push(a);
      s = reduce(s, a).state;
    };
    for (let i = 0; i < 400 && (s.status === 'playing' || s.status === 'catchScene'); i++) {
      const roll = rng.next();
      if (roll < 0.3) push({ type: 'SET_INTENT', kind: 'move', cell: rng.pick(cells) });
      else if (roll < 0.36) push({ type: 'SET_INTENT', kind: 'throw', cell: rng.pick(cells) });
      else if (roll < 0.4) push({ type: 'SET_INTENT', kind: 'stay' });
      else if (roll < 0.75)
        push({ type: 'ANSWER', correct: rng.chance(0.8), timeMs: 2000 + rng.int(4000) });
      for (let k = rng.range(5, 80); k > 0; k--)
        push({ type: 'TICK', dt: 0.016 + rng.next() * 0.05 });
    }
    return { state: s, log };
  }

  it('одинаковые сид и журнал действий дают одинаковый результат', () => {
    for (const level of [1, 3, 6, 7]) {
      for (const seed of [11, 22, 33]) {
        const a = scriptedRun(level, seed);
        const b = scriptedRun(level, seed);
        expect(b.state).toEqual(a.state);
        const again = replay(createState(levels[level - 1]!, seed), a.log);
        expect(again.state).toEqual(a.state);
      }
    }
  });

  it('редуктор не меняет переданное состояние', () => {
    const s0 = createState(levels[2]!, 5);
    const snapshot = JSON.stringify(s0);
    let s = s0;
    const first = reduce(s, moveTo(4, 7));
    expect(JSON.stringify(s0)).toBe(snapshot);
    s = first.state;
    const frozen = JSON.stringify(s);
    reduce(s, correct);
    reduce(s, wrong);
    reduce(s, { type: 'TICK', dt: 0.05 });
    advanceUntil(s, (n) => n.time > 30);
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it('полный раунд можно пройти: собрать три листа и выйти', () => {
    // Библиотекарь оглушён и не ходит рядом: проверяется только путь героя.
    const base = createState(levels[0]!, 2024);
    let s: GameState = {
      ...base,
      debug: { deaf: true, infiniteCards: true },
      librarians: base.librarians.map((m) => ({ ...m, timer: 1e9 })),
    };
    for (const page of base.pages) {
      s = reduce(s, { type: 'SET_INTENT', kind: 'move', cell: page.cell }).state;
      for (let i = 0; i < 40 && !sameCell(s.hero.cell, page.cell); i++)
        s = reduce(s, correct).state;
      expect(s.hero.cell).toEqual(page.cell);
    }
    expect(s.hero.pages.length).toBe(3);
    s = reduce(s, { type: 'SET_INTENT', kind: 'move', cell: s.lib.door }).state;
    for (let i = 0; i < 40 && s.status === 'playing'; i++) s = reduce(s, correct).state;
    expect(s.status).toBe('won');
    expect(starsOf(s)).toBe(3);
    expect(s.stats.steps).toBeGreaterThanOrEqual(balance.tour.min);
  });
});
