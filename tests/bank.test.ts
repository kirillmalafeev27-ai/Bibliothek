import { describe, expect, it } from 'vitest';
import bankJson from '../src/shared/questions/bank.de.json';
import type { Question } from '../src/shared/questions/types';

/**
 * Задания банка на различение падежей (тема «Kasus unterscheiden», как в «Кострах до рассвета»,
 * но в библиотеке): верная форма — форма нужного падежа и рода, неверные — формы других падежей
 * того же слова, и среди них есть соседний падеж.
 */
const bank = bankJson as Question[];

describe('вопросы банка с пропуском', () => {
  it('пропуск в немецком задании есть везде, где вариант подставляется', () => {
    for (const q of bank.filter((x) => x.id.startsWith('kas-') || x.id.startsWith('prep-')))
      expect(q.prompt, q.id).toMatch(/___/);
  });
});

/** Формы артикля и притяжательного слова по падежам: Nom, Akk, Dat, Gen. */
type Gender = 'm' | 'f' | 'n';
const FORMS: Record<string, Record<Gender, readonly string[]>> = {
  def: {
    m: ['der', 'den', 'dem', 'des'],
    f: ['die', 'die', 'der', 'der'],
    n: ['das', 'das', 'dem', 'des'],
  },
  indef: {
    m: ['ein', 'einen', 'einem', 'eines'],
    f: ['eine', 'eine', 'einer', 'einer'],
    n: ['ein', 'ein', 'einem', 'eines'],
  },
  poss: {
    m: ['mein', 'meinen', 'meinem', 'meines'],
    f: ['meine', 'meine', 'meiner', 'meiner'],
    n: ['mein', 'mein', 'meinem', 'meines'],
  },
};
const CASES = ['Nom', 'Akk', 'Dat', 'Gen'] as const;

/** Что должно стоять в пропуске: слово, род, падеж по роли в предложении. */
const KASUS: Record<string, { type: string; gender: Gender; kasus: (typeof CASES)[number] }> = {
  'kas-001': { type: 'def', gender: 'm', kasus: 'Nom' }, // Der Bibliothekar hört — подлежащее
  'kas-002': { type: 'poss', gender: 'm', kasus: 'Nom' }, // Im Lesesaal wartet mein Freund — инверсия
  'kas-003': { type: 'def', gender: 'm', kasus: 'Akk' }, // sehen
  'kas-004': { type: 'indef', gender: 'm', kasus: 'Akk' }, // suchen
  'kas-005': { type: 'def', gender: 'm', kasus: 'Akk' }, // anrufen — по-русски дательный
  'kas-006': { type: 'def', gender: 'm', kasus: 'Dat' }, // helfen
  'kas-007': { type: 'def', gender: 'f', kasus: 'Dat' }, // gehören
  'kas-008': { type: 'def', gender: 'n', kasus: 'Dat' }, // schenken — кому
  'kas-009': { type: 'def', gender: 'm', kasus: 'Gen' }, // der Schlüssel des Bibliothekars
  'kas-010': { type: 'def', gender: 'f', kasus: 'Gen' }, // die Lampe der Leserin
  'kas-011': { type: 'def', gender: 'n', kasus: 'Akk' }, // legen … auf das Pult — wohin?
  'kas-012': { type: 'def', gender: 'n', kasus: 'Dat' }, // liegt auf dem Pult — wo?
};

describe('вопросы банка на различение падежей', () => {
  const kasus = bank.filter((q) => q.id.startsWith('kas-'));

  it('в банке ровно эти задания, и среди них есть все четыре падежа и оба вопроса «wohin / wo»', () => {
    expect(kasus.map((q) => q.id).sort()).toEqual(Object.keys(KASUS).sort());
    expect(new Set(Object.values(KASUS).map((k) => k.kasus))).toEqual(new Set(CASES));
  });

  it('верный вариант — форма нужного падежа и рода, а остальные — формы других падежей', () => {
    for (const q of kasus) {
      const want = KASUS[q.id]!;
      const row = FORMS[want.type]![want.gender];
      const right = row[CASES.indexOf(want.kasus)]!;
      expect(q.options[q.correctIndex]!.toLowerCase(), q.id).toBe(right);
      // Каждый вариант — настоящая форма того же слова (в каком-то роде и падеже), не выдумка.
      const all = new Set(Object.values(FORMS[want.type]!).flat());
      for (const option of q.options)
        expect(all.has(option.toLowerCase()), `${q.id}: ${option}`).toBe(true);
      // Верная форма не повторяется среди неверных: двух решений нет.
      expect(
        q.options.filter((o) => o.toLowerCase() === right),
        q.id,
      ).toHaveLength(1);
    }
  });

  it('есть соседний падеж в качестве отвлекающего варианта', () => {
    for (const q of kasus) {
      const want = KASUS[q.id]!;
      const row = FORMS[want.type]![want.gender];
      const right = row[CASES.indexOf(want.kasus)]!;
      const neighbours = row.filter((form) => form !== right);
      const present = q.options.filter((o) => neighbours.includes(o.toLowerCase()));
      expect(present.length, q.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('предложения — из мира игры: библиотека, книги, читатели', () => {
    const words = /Bibliothek|Buch|Lese|Leser|Pult|Schlüssel|Leuchter|Lampe/;
    const themed = kasus.filter((q) => words.test(q.prompt));
    expect(themed.length).toBeGreaterThanOrEqual(10);
  });
});
