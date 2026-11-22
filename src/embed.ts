/**
 * Встраивание игры в основное приложение (план, 13.4).
 *
 *   const game = mountLibrary(container, { questions, storage, level, onFinish });
 *   …
 *   game.destroy();
 */
import type { FinishResult, MountOptions } from './app/GameApp';
import { GameApp } from './app/GameApp';
import type { QuestionProvider } from './shared/questions/types';
import type { KeyValueStorage } from './shared/storage';

export type { FinishResult, QuestionProvider, KeyValueStorage };

export interface LibraryOptions {
  questions: QuestionProvider;
  /** По умолчанию — localStorage с префиксом ключей `library:`. */
  storage?: KeyValueStorage;
  level?: number;
  onFinish?: (r: FinishResult) => void;
}

export function mountLibrary(container: HTMLElement, options: LibraryOptions): { destroy(): void } {
  const app = new GameApp(container, options as MountOptions);
  return { destroy: () => app.destroy() };
}
