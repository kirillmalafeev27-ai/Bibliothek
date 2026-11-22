import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { checkThrow, sameCell, stepHint, throwPreview, throwTargets } from '../src/core';
import {
  advance,
  apply,
  correct,
  makeState,
  moveTo,
  ofType,
  stay,
  throwTo,
  wrong,
} from './helpers';

/** Библиотекарь далеко и занят: в сценах про героя он не мешает. */
const FAR = {
  cell: { x: 1, y: 1 },
  mode: 'walk' as const,
  timer: 1e6,
  stepDur: 1e6,
  target: { x: 7, y: 1 },
};

describe('действия и намерение (2.2)', () => {
  it('каждый правильный ответ — один шаг на соседнюю клетку по маршруту', () => {
    const s0 = makeState({ librarians: [FAR] });
    const a = apply(s0, moveTo(4, 7), correct);
    expect(a.state.hero.cell).toEqual({ x: 4, y: 8 });
    expect(ofType(a.events, 'STEP')).toEqual([
      { type: 'STEP', from: { x: 4, y: 9 }, to: { x: 4, y: 8 }, squeak: false },
    ]);
    expect(a.state.hero.intent).toEqual({ kind: 'move', cell: { x: 4, y: 7 } });
    const b = apply(a.state, correct);
    expect(b.state.hero.cell).toEqual({ x: 4, y: 7 });
    // Дошёл — намерения больше нет.
    expect(b.state.hero.intent).toEqual({ kind: 'stay' });
    expect(b.state.stats.steps).toBe(2);
    expect(b.state.stats.correct).toBe(2);
  });

  it('готовое действие: верный ответ без намерения копится, но не больше одного', () => {
    const s0 = makeState({ librarians: [FAR] });
    const a = apply(s0, correct);
    expect(a.state.hero.ready).toBe(true);
    expect(a.state.hero.cell).toEqual({ x: 4, y: 9 });
    expect(ofType(a.events, 'READY').length).toBe(1);
    // Пока действие готово, ответы не принимаются: второе не копится.
    const b = apply(a.state, correct, correct);
    expect(b.events).toEqual([]);
    expect(b.state.stats.correct).toBe(1);
    expect(b.state.hero.ready).toBe(true);
    // Ошибиться в это время тоже нельзя.
    const c = apply(a.state, wrong);
    expect(c.events).toEqual([]);
    expect(c.state.stats.wrong).toBe(0);
  });

  it('как только задано намерение, готовое действие выполняется мгновенно', () => {
    const s0 = makeState({ librarians: [FAR], heroBooks: 1 });
    const ready = apply(s0, correct).state;
    const walk = apply(ready, moveTo(4, 7));
    expect(walk.state.hero.cell).toEqual({ x: 4, y: 8 });
    expect(walk.state.hero.ready).toBe(false);
    expect(ofType(walk.events, 'READY_USED').length).toBe(1);
    const thrown = apply(ready, throwTo(4, 6));
    expect(thrown.state.hero.books).toBe(0);
    expect(thrown.state.hero.ready).toBe(false);
    expect(ofType(thrown.events, 'THROW').length).toBe(1);
    // «Стоять» готовое действие не тратит.
    expect(apply(ready, stay).state.hero.ready).toBe(true);
  });

  it('неправильный ответ: действие не выполняется, у героя громкий шум', () => {
    const s0 = makeState({ librarians: [FAR] });
    const r = apply(s0, moveTo(4, 7), wrong);
    expect(r.state.hero.cell).toEqual({ x: 4, y: 9 });
    expect(r.state.stats.wrong).toBe(1);
    expect(r.state.stats.steps).toBe(0);
    const sound = ofType(r.events, 'SOUND')[0]!;
    expect(sound).toMatchObject({ kind: 'error', cell: { x: 4, y: 9 }, radius: s0.level.loudR });
    // Библиотекарь далеко — не услышал.
    expect(sound.heardBy).toEqual([]);
    expect(r.state.stats.heard).toBe(0);
  });

  it('ошибка ничего не даёт игроку (2.4.5)', () => {
    const s0 = makeState({ librarians: [FAR], heroBooks: 1 });
    const r = apply(s0, wrong);
    expect(r.state.hero.books).toBe(1);
    expect(r.state.books).toEqual([]);
    expect(r.state.hero.ready).toBe(false);
    expect(r.state.hero.pages).toEqual([]);
  });

  it('шагнуть на клетку библиотекаря нельзя: действие становится готовым', () => {
    const s0 = makeState({
      librarians: [
        { cell: { x: 4, y: 8 }, mode: 'walk', timer: 1e6, stepDur: 1e6, target: { x: 4, y: 7 } },
      ],
    });
    const r = apply(s0, moveTo(4, 8), correct);
    expect(r.state.hero.cell).toEqual({ x: 4, y: 9 });
    expect(r.state.hero.ready).toBe(true);
    expect(ofType(r.events, 'DENIED')[0]).toMatchObject({ reason: 'blocked' });
    // Маршрут к другой клетке обходит библиотекаря, а не идёт сквозь него.
    const around = apply(s0, moveTo(4, 7), correct);
    expect(sameCell(around.state.hero.cell, { x: 4, y: 8 })).toBe(false);
    expect(around.state.hero.cell).toEqual({ x: 3, y: 9 });
  });

  it('осторожный шаг (уровни 1–3): в нимб слушающего герой не шагает', () => {
    for (const level of [1, 2, 3]) {
      const s0 = makeState({
        level,
        librarians: [{ cell: { x: 4, y: 7 }, mode: 'listen', timer: 1e6, atWaypoint: false }],
      });
      const r = apply(s0, moveTo(4, 8), correct);
      expect(r.state.hero.cell).toEqual({ x: 4, y: 9 });
      expect(r.state.hero.ready).toBe(true);
      expect(ofType(r.events, 'DENIED')[0]).toMatchObject({ reason: 'halo', cell: { x: 4, y: 8 } });
      expect(r.state.stats.heard).toBe(0);
      // Из нимба выйти можно: шаг, который заканчивается вне нимба, разрешён.
      const inside = makeState({
        level,
        hero: { x: 3, y: 9 },
        librarians: [{ cell: { x: 4, y: 7 }, mode: 'listen', timer: 1e6, atWaypoint: false }],
      });
      const out = apply(inside, moveTo(1, 9), correct);
      expect(out.state.hero.cell).toEqual({ x: 2, y: 9 });
      expect(out.state.stats.heard).toBe(0);
    }
  });

  it('с уровня 4 шаг в нимб выполняется, но след заранее красный', () => {
    for (const level of [4, 5, 6]) {
      const s0 = makeState({
        level,
        librarians: [{ cell: { x: 4, y: 7 }, mode: 'listen', timer: 1e6, atWaypoint: false }],
      });
      const aimed = apply(s0, moveTo(4, 8)).state;
      expect(stepHint(aimed)).toMatchObject({ cell: { x: 4, y: 8 }, halo: true, red: true });
      const r = apply(aimed, correct);
      expect(r.state.hero.cell).toEqual({ x: 4, y: 8 });
      expect(ofType(r.events, 'SOUND')[0]).toMatchObject({ kind: 'step', heardBy: [0] });
      expect(r.state.stats.heard).toBe(1);
      expect(r.state.stats.heardBy.step).toBe(1);
      expect(r.state.librarians[0]!.mode).toBe('alert');
    }
    // На уровне ∞ подсказки нет: след не краснеет, хотя шаг так же опасен.
    const inf = makeState({
      level: 7,
      librarians: [{ cell: { x: 4, y: 7 }, mode: 'listen', timer: 1e6, atWaypoint: false }],
    });
    expect(stepHint(apply(inf, moveTo(4, 8)).state)).toMatchObject({ halo: true, red: false });
  });

  it('след краснеет и перед скрипучей половицей', () => {
    const s0 = makeState({
      level: 2,
      map: [
        '#########',
        '#.......#',
        '#.##.##.#',
        '#.......#',
        '#.##.##.#',
        '#.......#',
        '#.##.##.#',
        '#.......#',
        '#.##.##.#',
        '#..~....#',
        '####D####',
      ],
      librarians: [FAR],
    });
    const aimed = apply(s0, moveTo(3, 9)).state;
    expect(stepHint(aimed)).toMatchObject({ cell: { x: 3, y: 9 }, squeak: true, red: true });
  });

  it('можно просто не отвечать: вопрос ждёт, библиотекарь ходит', () => {
    const s0 = makeState();
    const r = advance(s0, s0.unitA * 10);
    expect(r.state.stats.correct + r.state.stats.wrong).toBe(0);
    expect(ofType(r.events, 'LIB_STEP').length).toBeGreaterThan(0);
  });

  it('тап по герою или «Стоять» — стоять', () => {
    const s0 = makeState({ librarians: [FAR] });
    const walking = apply(s0, moveTo(4, 7)).state;
    expect(apply(walking, moveTo(4, 9)).state.hero.intent).toEqual({ kind: 'stay' });
    expect(apply(walking, stay).state.hero.intent).toEqual({ kind: 'stay' });
  });

  it('на стеллаж идти нельзя', () => {
    const s0 = makeState({ librarians: [FAR] });
    const r = apply(s0, moveTo(2, 8));
    expect(ofType(r.events, 'DENIED')[0]).toMatchObject({ reason: 'blocked' });
    expect(r.state.hero.intent).toEqual({ kind: 'stay' });
  });
});

describe('листы и словари (2.2.1, 2.5, 2.6)', () => {
  it('лист подбирается сам, когда герой входит на клетку', () => {
    const s0 = makeState({
      librarians: [FAR],
      pages: [
        { x: 4, y: 8 },
        { x: 1, y: 5 },
        { x: 7, y: 5 },
      ],
    });
    const r = apply(s0, moveTo(4, 8), correct);
    expect(r.state.hero.pages).toEqual([0]);
    expect(r.state.pages.map((p) => p.id)).toEqual([1, 2]);
    expect(ofType(r.events, 'PICKUP')[0]).toMatchObject({ item: 'page', pageId: 0 });
  });

  it('словарь подбирается сам, но в руках не больше трёх', () => {
    const two = makeState({ librarians: [FAR], heroBooks: 2, books: [{ x: 4, y: 8 }] });
    const a = apply(two, moveTo(4, 8), correct);
    expect(a.state.hero.books).toBe(3);
    expect(a.state.books).toEqual([]);
    const three = makeState({ librarians: [FAR], heroBooks: 3, books: [{ x: 4, y: 8 }] });
    const b = apply(three, moveTo(4, 8), correct);
    expect(b.state.hero.books).toBe(balance.maxBooks);
    expect(b.state.books).toEqual([{ x: 4, y: 8 }]);
  });

  it('бросок стоит одного верного ответа; словарь падает сразу и остаётся лежать', () => {
    const s0 = makeState({ librarians: [FAR], heroBooks: 1 });
    const aimed = apply(s0, throwTo(4, 5));
    expect(aimed.state.hero.intent).toEqual({ kind: 'throw', cell: { x: 4, y: 5 } });
    expect(aimed.state.hero.books).toBe(1);
    const r = apply(aimed.state, correct);
    expect(r.state.hero.books).toBe(0);
    expect(r.state.books).toEqual([{ x: 4, y: 5 }]);
    expect(r.state.stats.throws).toBe(1);
    expect(ofType(r.events, 'THROW')[0]).toMatchObject({ cell: { x: 4, y: 5 } });
    // Грохот слышат все библиотекари в любой точке библиотеки и бегут туда.
    const sound = ofType(r.events, 'SOUND')[0]!;
    expect(sound).toMatchObject({ kind: 'book', radius: Infinity, heardBy: [0] });
    expect(r.state.librarians[0]!.mode).toBe('alert');
    expect(r.state.librarians[0]!.target).toEqual({ x: 4, y: 5 });
    // Брошенные словари в «услышан» не считаются.
    expect(r.state.stats.heard).toBe(0);
    expect(r.state.hero.intent).toEqual({ kind: 'stay' });
  });

  it('брошенный словарь можно подобрать снова', () => {
    const s0 = makeState({ librarians: [FAR], heroBooks: 1 });
    let s = apply(s0, throwTo(4, 8), correct).state;
    expect(s.hero.books).toBe(0);
    s = apply(s, moveTo(4, 8), correct).state;
    expect(s.hero.books).toBe(1);
    expect(s.books).toEqual([]);
  });

  it('после броска герой возвращается к прежней цели ходьбы', () => {
    const s0 = makeState({ librarians: [FAR], heroBooks: 1 });
    let s = apply(s0, moveTo(4, 5), correct).state;
    s = apply(s, throwTo(1, 9), correct).state;
    expect(s.hero.intent).toEqual({ kind: 'move', cell: { x: 4, y: 5 } });
  });

  it('цель броска — клетка пола ближе 5 клеток, через стеллажи; не дверь и не клетка героя', () => {
    const s0 = makeState({ librarians: [FAR], heroBooks: 1 });
    expect(balance.throwR).toBe(5);
    expect(checkThrow(s0, { x: 4, y: 5 })).toBe('ok'); // 4 клетки, сквозь два ряда стеллажей
    expect(checkThrow(s0, { x: 1, y: 6 })).toBe('ok'); // √18 ≈ 4.24
    expect(checkThrow(s0, { x: 4, y: 4 })).toBe('outOfRange'); // ровно 5 — уже далеко
    expect(checkThrow(s0, { x: 1, y: 5 })).toBe('outOfRange'); // 5
    expect(checkThrow(s0, { x: 4, y: 10 })).toBe('outOfRange'); // дверь
    expect(checkThrow(s0, { x: 4, y: 9 })).toBe('outOfRange'); // клетка героя
    expect(checkThrow(s0, { x: 2, y: 8 })).toBe('outOfRange'); // стеллаж
    expect(checkThrow(makeState({ librarians: [FAR], heroBooks: 0 }), { x: 4, y: 5 })).toBe(
      'noBooks',
    );
    for (const c of throwTargets(s0)) expect(checkThrow(s0, c)).toBe('ok');
    expect(throwTargets(s0).length).toBeGreaterThan(10);

    const far = apply(s0, throwTo(4, 4));
    expect(ofType(far.events, 'DENIED')[0]).toMatchObject({ reason: 'outOfRange' });
    expect(far.state.hero.intent).toEqual({ kind: 'stay' });
    const none = apply(makeState({ librarians: [FAR], heroBooks: 0 }), throwTo(4, 5));
    expect(ofType(none.events, 'DENIED')[0]).toMatchObject({ reason: 'noBooks' });
  });

  it('путь броска: куда побежит библиотекарь, и опасен ли этот путь (2.8.6)', () => {
    const s0 = makeState({
      hero: { x: 3, y: 3 },
      heroBooks: 1,
      librarians: [
        { cell: { x: 1, y: 3 }, mode: 'walk', timer: 1e6, stepDur: 1e6, target: { x: 1, y: 1 } },
      ],
    });
    // Словарь за спину героя: библиотекарь побежит через его клетку — кармин.
    const through = throwPreview(s0, { x: 6, y: 3 });
    expect(through.paths[0]!.path.at(-1)).toEqual({ x: 6, y: 3 });
    expect(through.paths[0]!.danger).toBe(true);
    // Словарь в дальний проход: путь уводит библиотекаря прочь.
    const away = throwPreview(s0, { x: 1, y: 7 });
    expect(away.paths[0]!.path[0]).toEqual({ x: 1, y: 4 });
    expect(away.paths[0]!.danger).toBe(false);
  });
});
