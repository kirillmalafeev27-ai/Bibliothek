import { describe, expect, it } from 'vitest';
import { paceConfigFor, paceKeyFor, roundTmed, tMedRangeFor } from '../src/app/pacing';
import { balance } from '../src/config/balance';
import { levels } from '../src/config/levels';
import { createState, unitSeconds } from '../src/core';
import { Pace, PACE_KEY } from '../src/shared/pace';
import { memoryStorage } from '../src/shared/storage';

/**
 * Темп по видам вопросов (раздел 3, src/app/pacing.ts): вопросы банка и задания ИИ-генератора
 * читаются с разной скоростью, поэтому учёт у них раздельный, а единица A растягивается вместе
 * с T_med — раунд в единицах A остаётся тем же.
 */
describe('учёт темпа по видам вопросов', () => {
  it('банк — общий ключ серии, 5 с по умолчанию, пределы 3–10 с', () => {
    expect(paceKeyFor('bank')).toBe(PACE_KEY);
    expect(paceConfigFor('bank')).toBe(balance.pace);
    expect(tMedRangeFor('bank')).toEqual([3, 10]);
    expect(new Pace(memoryStorage(), paceConfigFor('bank')).tMedSec()).toBe(5);
  });

  it('задания генератора: свой ключ и своё значение по умолчанию на каждый уровень A1–C1', () => {
    expect(paceKeyFor('generated', 'B1')).toBe('series:pace:gen:B1');
    expect(paceKeyFor('generated', 'C1')).toBe('series:pace:gen:C1');
    const storage = memoryStorage();
    const at = (cefr: string) =>
      new Pace(storage, paceConfigFor('generated', cefr), paceKeyFor('generated', cefr));
    expect(at('A1').tMedSec()).toBe(11);
    expect(at('B1').tMedSec()).toBe(12);
    expect(at('C1').tMedSec()).toBe(14);
    expect(paceConfigFor('generated', 'B1').defaultP).toBe(0.7);
    expect(tMedRangeFor('generated')).toEqual([4, 30]);
  });

  it('свои наборы слов — один учёт на все уровни, по умолчанию 7 с, а не 12', () => {
    expect(paceKeyFor('generated', 'A2', true)).toBe('series:pace:gen:vocab');
    expect(paceKeyFor('generated', 'C1', true)).toBe('series:pace:gen:vocab');
    expect(new Pace(memoryStorage(), paceConfigFor('generated', 'B1', true)).tMedSec()).toBe(7);
  });

  it('банк и генератор хранятся отдельно и не смешиваются', () => {
    const storage = memoryStorage();
    const bank = new Pace(storage, paceConfigFor('bank'), paceKeyFor('bank'));
    const gen = new Pace(storage, paceConfigFor('generated', 'B1'), paceKeyFor('generated', 'B1'));
    for (let i = 0; i < 10; i++) gen.record(true, 18_000, true);
    expect(gen.tMedSec()).toBe(18);
    expect(bank.tMedSec()).toBe(5);
    for (let i = 0; i < 10; i++) bank.record(true, 4000, true);
    // После перезагрузки — те же значения: каждый вид под своим ключом.
    expect(new Pace(storage, paceConfigFor('bank'), paceKeyFor('bank')).tMedSec()).toBe(4);
    expect(
      new Pace(storage, paceConfigFor('generated', 'B1'), paceKeyFor('generated', 'B1')).tMedSec(),
    ).toBe(18);
  });

  it('потолок медианы: 10 с у банка, 30 с у заданий генератора', () => {
    const bank = new Pace(memoryStorage(), paceConfigFor('bank'));
    const gen = new Pace(memoryStorage(), paceConfigFor('generated', 'B1'));
    for (let i = 0; i < 20; i++) {
      bank.record(true, 60_000, true);
      gen.record(true, 60_000, true);
    }
    expect(bank.tMedSec()).toBe(10);
    expect(gen.tMedSec()).toBe(30);
  });

  it('known(): своя медиана — с пяти ответов', () => {
    const pace = new Pace(memoryStorage(), paceConfigFor('generated', 'B2'));
    for (let i = 0; i < 4; i++) pace.record(true, 9000, true);
    expect(pace.known()).toBe(false);
    expect(pace.tMedSec()).toBe(13);
    pace.record(true, 9000, true);
    expect(pace.known()).toBe(true);
    expect(pace.tMedSec()).toBe(9);
  });
});

describe('единица A под вид вопросов', () => {
  it('у заданий генератора единица A не обрезается потолком банка', () => {
    expect(unitSeconds(20)).toBeCloseTo(10 + balance.unitOverheadSec, 9);
    expect(unitSeconds(20, tMedRangeFor('generated'))).toBeCloseTo(20 + balance.unitOverheadSec, 9);
    expect(unitSeconds(2, tMedRangeFor('generated'))).toBeCloseTo(4 + balance.unitOverheadSec, 9);
  });

  it('раунд в единицах A тот же: таймеры библиотекаря растут вместе с A', () => {
    const level = levels[0]!;
    const bank = createState(level, 11, { tMedSec: 5 });
    const gen = createState(level, 11, { tMedSec: 12, tMedRange: tMedRangeFor('generated') });
    expect(gen.unitA).toBeCloseTo(12 + balance.unitOverheadSec, 9);
    const timer = (s: typeof bank) => (s.librarians[0]?.timer ?? 0) / s.unitA;
    expect(timer(gen)).toBeCloseTo(timer(bank), 9);
    expect(timer(bank)).toBeCloseTo(balance.firstListenA, 9);
  });

  it('у заданий генератора — запас на разброс времени ответа, у банка — медиана как есть', () => {
    expect(roundTmed('bank', 5)).toBe(5);
    const a = balance.paceGenerated.allowance;
    expect(a).toBeGreaterThan(1);
    expect(a).toBeLessThan(1.3);
    expect(roundTmed('generated', 12)).toBeCloseTo(12 * a, 9);
    // Запас не выводит единицу A за пределы генератора.
    expect(unitSeconds(roundTmed('generated', 30), tMedRangeFor('generated'))).toBeCloseTo(
      30 + balance.unitOverheadSec,
      9,
    );
  });

  it('показ ошибки в задании генератора в единицах A не дольше, чем у банка', () => {
    const bankA = balance.wrongFeedbackMs / 1000 / unitSeconds(balance.pace.defaultTmedSec);
    const genA =
      balance.wrongFeedbackGeneratedMs /
      1000 /
      unitSeconds(balance.paceGenerated.defaultTmedSec, tMedRangeFor('generated'));
    expect(genA).toBeLessThan(bankA);
  });
});
