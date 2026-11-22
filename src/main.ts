/**
 * Автономная страница игры. Параметры адреса (dev):
 *   ?art=gray        — серый прототип вместо рукописного арта;
 *   ?level=N         — сразу в игру на уровне N;
 *   ?scene=kit       — лист рукописного кита;
 *   ?scene=hearing   — сцена теста читаемости слуха (8.4).
 */
import { GameApp } from './app/GameApp';
import type { ArtProvider } from './art/ArtFactory';
import { LocalBankProvider } from './shared/questions/LocalBankProvider';
import type { Question } from './shared/questions/types';

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
  let art: ArtProvider | undefined;
  if (params.get('art') === 'gray') {
    art = (await import('./art/recipes/gray')).grayProvider;
  } else {
    try {
      art = (await import('./art/recipes/manuscript')).manuscriptProvider;
    } catch {
      art = undefined;
    }
  }
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
  const questions =
    import.meta.env.DEV && params.get('q') === 'edge'
      ? new LocalBankProvider(edge)
      : new LocalBankProvider();
  const app = new GameApp(container, {
    questions,
    art,
    level: levelParam ? Number(levelParam) : undefined,
    dev: import.meta.env.DEV,
    hearingTest: scene === 'hearing',
  });
  (window as unknown as { __lib?: GameApp }).__lib = app;
}

void start(root);
