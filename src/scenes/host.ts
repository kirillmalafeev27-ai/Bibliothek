/**
 * Что сцены получают от приложения. Сцены только читают состояние и реагируют
 * на события (план, 0.3); всё остальное — здесь.
 */
import type { ArtFactory, ArtProvider } from '../art/ArtFactory';
import type { Cell } from '../core';
import type { SfxKey } from '../i18n/sfx.de';
import type { Layout } from '../shared/layout';
import type { Quality } from '../shared/quality';

export const HOST_KEY = 'host';

export interface SceneHost {
  provider: ArtProvider;
  /** Пикселей текстуры на клетку. */
  ppc: number;
  quality: Quality;
  /** Фабрика арта появляется после загрузочной сцены. */
  art: ArtFactory | null;
  layout: () => Layout;
  /** Сколько пикселей канвы в одном CSS-пикселе. */
  dpr: () => number;
  /** Слово-звук на выбранном языке. */
  word: (key: SfxKey) => string;
  /** Слова-звуки на русском (фрактура кириллицу не покрывает). */
  cyrillic: () => boolean;
  /** Звук события; сцена не знает, как он устроен. */
  sound: (name: string, at?: Cell | null) => void;
  onBootProgress: (done: number, total: number) => void;
  onBootDone: (ms: number) => void;
  onSceneReady: () => void;
  /** Каждый кадр, до отрисовки: время кадра в миллисекундах. */
  onFrame: (dtMs: number) => void;
  onCellTap: (cell: Cell) => void;
  onCellHover: (cell: Cell | null) => void;
  /** Куда на экране летит подобранный лист: точка в CSS-пикселях панели мира. */
  pageSlotPoint: (pageId: number) => { x: number; y: number } | null;
}
