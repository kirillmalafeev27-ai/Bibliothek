import { describe, expect, it } from 'vitest';
import { buildExercisePrompt } from '../server/generation/exercisePrompt.ts';
import { buildAudioPrompt } from '../server/generation/audioTasks.ts';
import {
  BASE_LEXICAL_TOPICS,
  EXTRA_LEXICAL_TOPICS,
  LEXICAL_TOPICS,
  MAX_GRAMMAR_TOPICS,
  sanitizeQuizConfig,
} from '../src/shared/questions/topics';

/**
 * Лексические темы: базовые — как в Morskoy и «Кострах», дополнительные — из мира библиотеки и
 * для уровней повыше. Тема уходит генератору как есть, поэтому от неё требуется одно: короткая
 * немецкая строка, которую сервер примет и вставит в промпт.
 */
describe('лексические темы', () => {
  it('19 базовых и 25 дополнительных, без повторов и пересечений', () => {
    expect(BASE_LEXICAL_TOPICS).toHaveLength(19);
    expect(EXTRA_LEXICAL_TOPICS).toHaveLength(25);
    expect(LEXICAL_TOPICS).toEqual([...BASE_LEXICAL_TOPICS, ...EXTRA_LEXICAL_TOPICS]);
    expect(new Set(LEXICAL_TOPICS.map((t) => t.toLowerCase())).size).toBe(LEXICAL_TOPICS.length);
  });

  it('среди дополнительных — темы мира игры: библиотека, книги, сказки, средневековье', () => {
    for (const t of ['Bibliothek und Bücher', 'Lesen und Literatur', 'Märchen und Sagen'])
      expect(EXTRA_LEXICAL_TOPICS).toContain(t);
    expect(EXTRA_LEXICAL_TOPICS).toContain('Mittelalter und Burgen');
  });

  it('каждая тема — короткая немецкая строка без кириллицы (сервер принимает до 80 знаков)', () => {
    for (const t of LEXICAL_TOPICS) {
      expect(t.trim(), t).toBe(t);
      expect(t.length, t).toBeGreaterThan(2);
      expect(t.length, t).toBeLessThanOrEqual(40);
      expect(t, t).not.toMatch(/[А-Яа-яЁё]/);
      // Немецкое существительное — с заглавной буквы.
      expect(t[0], t).toBe(t[0]!.toUpperCase());
    }
  });

  it('дополнительная тема доходит до промпта генератора — и обычного, и аудирования', () => {
    for (const lexicalTopic of EXTRA_LEXICAL_TOPICS) {
      const prompt = buildExercisePrompt({ level: 'B1', grammarTopic: 'Dativ', lexicalTopic });
      expect(prompt).toContain(`WORTSCHATZTHEMA: ${lexicalTopic}.`);
    }
    const audio = buildAudioPrompt({
      level: 'A2',
      lexicalTopic: 'Schatzsuche und Abenteuer',
      questionsCount: 5,
    });
    expect(audio).toContain('Lexical topic: Schatzsuche und Abenteuer.');
  });

  it('сохранённые настройки: дополнительная тема сохраняется, неизвестная — сбрасывается', () => {
    const base = { level: 'B2', grammarTopics: ['Passiv'], wortstellung: false, listening: false };
    expect(sanitizeQuizConfig({ ...base, lexicalTopic: 'Nacht und Träume' })?.lexicalTopic).toBe(
      'Nacht und Träume',
    );
    expect(sanitizeQuizConfig({ ...base, lexicalTopic: 'Weltraum' })?.lexicalTopic).toBeNull();
    // Темы — не больше пяти, без дублей; без тем и без аудирования настроек нет.
    const many = sanitizeQuizConfig({
      ...base,
      grammarTopics: ['Dativ', 'Dativ', 'Passiv', 'Perfekt', 'Genitiv', 'Präsens', 'Futur I'],
    });
    expect(many?.grammarTopics).toEqual(['Dativ', 'Passiv', 'Perfekt', 'Genitiv', 'Präsens']);
    expect(many?.grammarTopics).toHaveLength(MAX_GRAMMAR_TOPICS);
    expect(sanitizeQuizConfig({ ...base, grammarTopics: [] })).toBeNull();
  });
});
