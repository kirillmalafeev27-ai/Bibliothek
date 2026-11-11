import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { levels } from '../src/config/levels';
import type { LibrarianMode, SoundKind } from '../src/core';
import { distance, floorCells, hears, inEarshot, inHalo, soundRadius } from '../src/core';
import { apply, correct, makeState, moveTo, ofType, throwTo, wrong } from './helpers';

const MODES: LibrarianMode[] = ['listen', 'walk', 'alert', 'run', 'search', 'file'];

describe('шум и слух (2.4)', () => {
  it('тихий шаг слышит только слушающий или ищущий библиотекарь и только ближе 2.25 клетки', () => {
    const level = levels[0]!;
    for (const mode of MODES) {
      const m = { cell: { x: 4, y: 5 }, mode };
      const listening = mode === 'listen' || mode === 'search';
      // (5,7): √5 ≈ 2.236 < 2.25 — внутри; (6,7): √8 ≈ 2.83 — снаружи; (4,8): 3 — снаружи.
      expect(hears(m, { kind: 'step', cell: { x: 5, y: 7 } }, level)).toBe(listening);
      expect(hears(m, { kind: 'step', cell: { x: 4, y: 7 } }, level)).toBe(listening);
      expect(hears(m, { kind: 'step', cell: { x: 6, y: 7 } }, level)).toBe(false);
      expect(hears(m, { kind: 'step', cell: { x: 4, y: 8 } }, level)).toBe(false);
    }
    expect(balance.hearR).toBe(2.25);
  });

  it('ошибку и скрип слышно ближе loudR в любом состоянии', () => {
    for (const level of levels) {
      for (const mode of MODES) {
        const m = { cell: { x: 4, y: 5 }, mode };
        for (const kind of ['error', 'squeak'] as const) {
          for (let y = 1; y < 10; y++) {
            for (let x = 1; x < 8; x++) {
              const cell = { x, y };
              expect(hears(m, { kind, cell }, level)).toBe(distance(m.cell, cell) < level.loudR);
            }
          }
        }
      }
    }
  });

  it('брошенный словарь слышат все и везде', () => {
    for (const level of levels) {
      for (const mode of MODES) {
        const m = { cell: { x: 1, y: 1 }, mode };
        expect(hears(m, { kind: 'book', cell: { x: 7, y: 9 } }, level)).toBe(true);
      }
    }
    expect(soundRadius('book', levels[0]!)).toBe(Infinity);
  });

  it('радиус кольца звука совпадает с радиусом, на котором hears() отвечает «да» (8.3)', { timeout: 120_000 }, () => {
    // Для каждого уровня, вида звука и положения библиотекаря: услышал ⇔ расстояние < radius
    // из события SOUND — того самого, до которого расходится кольцо.
    for (const level of levels) {
      const probe = makeState({ level });
      for (const cell of floorCells(probe.lib)) {
        for (const mode of ['listen', 'walk'] as const) {
          const hero = { x: 4, y: 5 };
          if (cell.x === hero.x && cell.y === hero.y) continue;
          const mk = (heroBooks = 1) =>
            makeState({
              level,
              hero,
              heroBooks,
              librarians: [{ cell, mode, timer: 1e6, stepDur: 0 }],
              levelPatch: { hintPreset: 'none' },
            });

          const check = (kind: SoundKind, events: ReturnType<typeof apply>['events']): void => {
            const sound = ofType(events, 'SOUND').find((e) => e.kind === kind);
            expect(sound).toBeDefined();
            if (!sound) return;
            expect(sound.radius).toBe(soundRadius(kind, level));
            const d = distance(cell, sound.cell);
            const canHearKind = kind !== 'step' || mode === 'listen';
            expect(sound.heardBy.includes(0)).toBe(canHearKind && d < sound.radius);
          };

          check('error', apply(mk(), wrong).events);
          check('book', apply(mk(), throwTo(4, 3), correct).events);
          // Тихий шаг: на (4,4) — если клетка свободна.
          if (!(cell.x === 4 && cell.y === 4)) {
            check('step', apply(mk(), moveTo(4, 4), correct).events);
          }
        }
      }
    }
  });

  it('inHalo и inEarshot считаются той же функцией hears()', () => {
    const s = makeState({
      level: 3,
      hero: { x: 4, y: 7 },
      librarians: [{ cell: { x: 4, y: 5 }, mode: 'listen', timer: 1e6 }],
    });
    expect(inHalo(s, { x: 4, y: 7 })).toBe(true);
    expect(inHalo(s, { x: 4, y: 8 })).toBe(false);
    expect(inEarshot(s)).toBe(true); // расстояние 2 < loudR 3.5
    const far = makeState({
      level: 3,
      hero: { x: 4, y: 9 },
      librarians: [{ cell: { x: 4, y: 5 }, mode: 'walk', timer: 1e6 }],
    });
    expect(inEarshot(far)).toBe(false); // расстояние 4 ≥ 3.5
    expect(inHalo(far, { x: 4, y: 6 })).toBe(false); // на ходу нимба нет
  });

  it('скрипучая половица — громкий звук радиусом loudR', () => {
    const s = makeState({
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
      librarians: [{ cell: { x: 1, y: 9 }, mode: 'walk', timer: 1e6 }],
    });
    const r = apply(s, moveTo(3, 9), correct);
    const sound = ofType(r.events, 'SOUND')[0]!;
    expect(sound.kind).toBe('squeak');
    expect(sound.radius).toBe(3.0);
    // Библиотекарь на ходу, в 2 клетках: громкий звук он слышит.
    expect(sound.heardBy).toEqual([0]);
    expect(r.state.stats.heard).toBe(1);
    expect(r.state.stats.heardBy.squeak).toBe(1);
    expect(r.state.librarians[0]!.mode).toBe('alert');
  });
});
