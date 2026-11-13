import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { Rng } from '../src/core';
import bank from '../src/shared/questions/bank.de.json';
import { LocalBankProvider, shuffleOptions } from '../src/shared/questions/LocalBankProvider';
import type { Question } from '../src/shared/questions/types';
import { Pace, PACE_KEY } from '../src/shared/pace';
import { memoryStorage } from '../src/shared/storage';

const questions = bank as Question[];

describe('банк вопросов (12.1)', () => {
  it('60 вопросов пяти видов, у каждого 2–4 разных варианта и верный индекс', () => {
    expect(questions.length).toBe(60);
    const ids = new Set(questions.map((q) => q.id));
    expect(ids.size).toBe(60);
    const kinds = new Map<string, number>();
    for (const q of questions) {
      const kind = q.id.split('-')[0]!;
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(4);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.options.length);
      expect(q.prompt.trim().length).toBeGreaterThan(0);
      expect(['de', 'ru']).toContain(q.promptLang);
      expect(['de', 'ru']).toContain(q.optionsLang);
    }
    expect([...kinds.keys()].sort()).toEqual(['art', 'pl', 'prep', 'tr', 'verb']);
    for (const n of kinds.values()) expect(n).toBe(12);
  });

  it('немецкий текст не набран капслоком (11.2.3)', () => {
    for (const q of questions) {
      const texts = [...(q.optionsLang === 'de' ? q.options : []), ...(q.promptLang === 'de' ? [q.prompt] : [])];
      for (const t of texts) {
        const letters = t.replace(/[^A-Za-zÄÖÜäöüß]/g, '');
        if (letters.length > 2) expect(letters).not.toBe(letters.toUpperCase());
      }
    }
  });

  it('у вопросов на артикль варианты — только der, die, das', () => {
    for (const q of questions.filter((x) => x.id.startsWith('art-'))) {
      expect(q.options.slice().sort()).toEqual(['das', 'der', 'die']);
    }
  });
});

describe('LocalBankProvider (12.2, 12.3)', () => {
  it('вопрос не повторяется раньше чем через 10 показов', async () => {
    const rng = new Rng(5);
    const p = new LocalBankProvider(questions, { random: () => rng.next() });
    const seen: string[] = [];
    for (let i = 0; i < 600; i++) {
      const q = await p.next();
      const last = seen.slice(-balance.questions.noRepeatWithin);
      expect(last).not.toContain(q.id);
      seen.push(q.id);
      p.report({ id: q.id, correct: true, timeMs: 1000 });
    }
    // За 600 показов встречаются все вопросы.
    expect(new Set(seen).size).toBe(60);
  });

  it('вопрос с ошибкой возвращается через 4–6 вопросов', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = new Rng(seed);
      const p = new LocalBankProvider(questions, { random: () => rng.next() });
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const q = await p.next();
        ids.push(q.id);
        p.report({ id: q.id, correct: true, timeMs: 1000 });
      }
      const failed = await p.next();
      ids.push(failed.id);
      p.report({ id: failed.id, correct: false, timeMs: 1000 });
      let gap = -1;
      for (let i = 1; i <= 8; i++) {
        const q = await p.next();
        ids.push(q.id);
        if (q.id === failed.id) {
          gap = i;
          p.report({ id: q.id, correct: true, timeMs: 1000 });
          break;
        }
        p.report({ id: q.id, correct: true, timeMs: 1000 });
      }
      // Между ошибкой и возвращением — от 4 до 6 других вопросов.
      expect(gap - 1).toBeGreaterThanOrEqual(balance.questions.wrongReturnMin);
      expect(gap - 1).toBeLessThanOrEqual(balance.questions.wrongReturnMax);
    }
  });

  it('следующий вопрос можно запросить заранее, до отчёта о текущем (12.4)', async () => {
    const rng = new Rng(9);
    const p = new LocalBankProvider(questions, { random: () => rng.next() });
    let current = await p.next();
    let preloaded = p.next();
    const failedId = current.id;
    p.report({ id: current.id, correct: false, timeMs: 900 });
    const after: string[] = [];
    for (let i = 0; i < 9; i++) {
      current = await preloaded;
      preloaded = p.next();
      after.push(current.id);
      p.report({ id: current.id, correct: true, timeMs: 900 });
    }
    const at = after.indexOf(failedId);
    expect(at).toBeGreaterThanOrEqual(3);
    expect(at).toBeLessThanOrEqual(6);
  });

  it('варианты перемешиваются, correctIndex пересчитывается', () => {
    const rng = new Rng(3);
    const orders = new Set<string>();
    for (const q of questions) {
      const answer = q.options[q.correctIndex];
      for (let i = 0; i < 6; i++) {
        const s = shuffleOptions(q, () => rng.next());
        expect(s.options[s.correctIndex]).toBe(answer);
        expect(s.options.slice().sort()).toEqual(q.options.slice().sort());
        orders.add(`${q.id}:${s.correctIndex}`);
      }
    }
    // Верный ответ оказывается на разных местах.
    expect(orders.size).toBeGreaterThan(120);
  });
});

describe('темп игрока (раздел 3)', () => {
  const mk = () => new Pace(memoryStorage(), balance.pace);

  it('по умолчанию T_med = 5.0 с и p = 0.8', () => {
    const pace = mk();
    expect(pace.tMedSec()).toBe(5);
    expect(pace.accuracy()).toBe(0.8);
  });

  it('T_med — медиана по последним 20 ответам, в пределах 3–10 с', () => {
    const pace = mk();
    for (let i = 0; i < 30; i++) pace.record(true, 20000, true);
    expect(pace.tMedSec()).toBe(10);
    for (let i = 0; i < 20; i++) pace.record(true, 1000, true);
    expect(pace.tMedSec()).toBe(3);
    const mid = mk();
    for (const t of [4000, 6000, 5000, 7000, 3500, 6500, 5500]) mid.record(true, t, true);
    expect(mid.tMedSec()).toBe(5.5);
    // Окно — 20 последних: старые ответы вытесняются.
    for (let i = 0; i < 20; i++) mid.record(true, 8000, true);
    expect(mid.tMedSec()).toBe(8);
  });

  it('ответы в кольце громкого слуха в T_med не идут, а в p — идут', () => {
    const pace = mk();
    for (let i = 0; i < 10; i++) pace.record(true, 4000, true);
    for (let i = 0; i < 10; i++) pace.record(false, 30000, false);
    expect(pace.tMedSec()).toBe(4);
    expect(pace.accuracy()).toBe(0.5);
  });

  it('p — доля верных по последним 30 ответам, в пределах 0.5–1', () => {
    const pace = mk();
    for (let i = 0; i < 30; i++) pace.record(false, 4000, true);
    expect(pace.accuracy()).toBe(0.5);
    for (let i = 0; i < 30; i++) pace.record(true, 4000, true);
    expect(pace.accuracy()).toBe(1);
    for (let i = 0; i < 6; i++) pace.record(false, 4000, true);
    expect(pace.accuracy()).toBeCloseTo(0.8, 9);
  });

  it('хранится между сессиями под общим для серии ключом', () => {
    const storage = memoryStorage();
    const a = new Pace(storage, balance.pace);
    for (let i = 0; i < 8; i++) a.record(i % 4 !== 0, 7000, true);
    expect(storage.get(PACE_KEY)).not.toBeNull();
    expect(PACE_KEY).toBe('series:pace');
    const b = new Pace(storage, balance.pace);
    expect(b.tMedSec()).toBe(7);
    expect(b.accuracy()).toBe(0.75);
    // Мусор в хранилище не ломает игру.
    storage.set(PACE_KEY, '{oops');
    expect(new Pace(storage, balance.pace).tMedSec()).toBe(5);
  });
});
