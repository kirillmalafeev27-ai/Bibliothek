/**
 * Темп раунда по виду вопросов (план, раздел 3): банк — общий учёт серии, задания ИИ-генератора —
 * свой учёт на каждый уровень A1–C1, свои наборы слов — свой, со своими значениями по умолчанию и
 * пределами. Этим пользуются игра (GameApp) и тесты — чтобы считали одинаково.
 */
import { balance } from '../config/balance';
import type { PaceConfig } from '../shared/pace';
import { PACE_KEY } from '../shared/pace';

export type QuestionKind = 'bank' | 'generated';

/** Настройки учёта темпа для вида вопросов; vocab — выбраны только свои наборы слов. */
export function paceConfigFor(kind: QuestionKind, cefr = 'B1', vocab = false): PaceConfig {
  if (kind === 'bank') return balance.pace;
  const g = balance.paceGenerated;
  return {
    ...balance.pace,
    defaultTmedSec: vocab
      ? g.defaultTmedVocabSec
      : (g.defaultTmedByLevel[cefr] ?? g.defaultTmedSec),
    minTmedSec: g.minTmedSec,
    maxTmedSec: g.maxTmedSec,
    defaultP: g.defaultP,
  };
}

/**
 * Ключ хранения: банк — общий ключ серии, генератор — свой на каждый уровень A1–C1, свои наборы
 * слов — свой: их задания вдвое короче предложений генератора и от уровня не зависят. С общим
 * учётом первый раунд после смены был бы то пустым, то непосильным (игра думает 5 с, а ученик
 * читает предложение 12 с).
 */
export function paceKeyFor(kind: QuestionKind, cefr = 'B1', vocab = false): string {
  if (kind === 'bank') return PACE_KEY;
  return `${PACE_KEY}:gen:${vocab ? 'vocab' : cefr}`;
}

/** Пределы T_med для единицы A (core/state.ts, unitSeconds). */
export function tMedRangeFor(kind: QuestionKind): readonly [number, number] {
  const c = kind === 'bank' ? balance.pace : balance.paceGenerated;
  return [c.minTmedSec, c.maxTmedSec];
}

/**
 * T_med для единицы A раунда: у заданий генератора — с запасом на разброс времени ответа
 * (balance.paceGenerated.allowance), у банка — как есть.
 */
export function roundTmed(kind: QuestionKind, tMedSec: number): number {
  return kind === 'generated' ? tMedSec * balance.paceGenerated.allowance : tMedSec;
}
