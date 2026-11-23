/**
 * Автономная страница игры. Вопросы — от ИИ-генератора на сервере игры (движок Morskoy,
 * docs/GENERATION.md); пока генерации нет, — из встроенного банка. Параметры адреса:
 *   ?q=bank          — только встроенный банк, без выбора тем;
 *   ?art=gray        — серый прототип вместо рукописного арта (dev);
 *   ?level=N         — сразу в игру на уровне N;
 *   ?q=edge          — вопросы с длинными составными словами (dev);
 *   ?scene=kit       — лист рукописного кита (dev);
 *   ?scene=hearing   — сцена теста читаемости слуха, 8.4 (dev).
 */
import { GameApp } from './app/GameApp';
import type { ArtProvider } from './art/ArtFactory';
import { balance } from './config/balance';
import { AiQuestionProvider } from './shared/questions/AiQuestionProvider';
import { LocalBankProvider } from './shared/questions/LocalBankProvider';
import type { Question, QuestionProvider } from './shared/questions/types';

const root = document.getElementById('app');
if (!root) throw new Error('main: нет элемента #app');

const params = new URLSearchParams(window.location.search);
const scene = params.get('scene');

async function start(container: HTMLElement): Promise<void> {
  if (import.meta.env.DEV && scene === 'kit') {
    const m = await import('./dev/kitSheet');
    await m.showKitSheet(container);
    return;
  }
  if (import.meta.env.DEV && scene === 'sprites') {
    const m = await import('./dev/spriteSheet');
    await m.showSpriteSheet(container);
    return;
  }
  // Серый прототип — только по ?art=gray; по умолчанию рукописный арт.
  let art: ArtProvider | undefined;
  if (params.get('art') === 'gray') art = (await import('./art/recipes/gray')).grayProvider;
  const levelParam = params.get('level');
  // Dev: ?q=edge — вопросы с длинными составными словами и с 2, 3 и 4 вариантами.
  const edge: Question[] = [
    {
      id: 'edge-1',
      prompt: 'die Donaudampfschifffahrtsgesellschaftskapitänsmütze',
      promptLang: 'de',
      options: ['richtig', 'falsch'],
      optionsLang: 'de',
      correctIndex: 0,
    },
    {
      id: 'edge-2',
      prompt: 'Rechtsschutzversicherungsgesellschaften',
      promptLang: 'de',
      options: ['die', 'der', 'das'],
      optionsLang: 'de',
      correctIndex: 0,
    },
    {
      id: 'edge-3',
      prompt: 'страховая компания',
      promptLang: 'ru',
      options: ['die Rechtsschutzversicherungsgesellschaft', 'das Auto', 'der Hund', 'die Katze'],
      optionsLang: 'de',
      correctIndex: 0,
    },
  ];
  const bank = new LocalBankProvider();
  let questions: QuestionProvider;
  if (import.meta.env.DEV && params.get('q') === 'edge') questions = new LocalBankProvider(edge);
  else if (params.get('q') === 'bank') questions = bank;
  else {
    const ai = balance.ai;
    questions = new AiQuestionProvider({
      fallback: bank,
      batchSize: ai.batch,
      refillAt: ai.refillAt,
      firstWaitMs: ai.firstWaitMs,
      nextWaitMs: ai.nextWaitMs,
      requestTimeoutMs: ai.requestTimeoutMs,
      retryWrongMin: ai.retryWrongMin,
      retryWrongMax: ai.retryWrongMax,
    });
  }
  const app = new GameApp(container, {
    questions,
    art,
    level: levelParam ? Number(levelParam) : undefined,
    dev: import.meta.env.DEV,
    hearingTest: import.meta.env.DEV && scene === 'hearing',
  });
  (window as unknown as { __lib?: GameApp }).__lib = app;
}

void start(root);
