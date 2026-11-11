/**
 * События редуктора (план, 13.3.3). Вид подписан на них и никогда не меняет
 * состояние напрямую.
 */
import type { Cell } from './library';
import type { SoundKind } from './hearing';
import type { HuntCause } from './state';

export type DeniedReason = 'blocked' | 'halo' | 'noBooks' | 'outOfRange';

export type GameEvent =
  /** Ответ принят. `paced` — учитывать ли время ответа в T_med (раздел 3.2). */
  | { type: 'ANSWERED'; correct: boolean; timeMs: number; paced: boolean }
  /** Верный ответ без намерения: действие готово и ждёт выбора (2.2.4). */
  | { type: 'READY' }
  /** Готовое действие потрачено или сгорело. */
  | { type: 'READY_USED' }
  | { type: 'STEP'; from: Cell; to: Cell; squeak: boolean }
  | { type: 'PICKUP'; item: 'page' | 'book'; cell: Cell; pageId: number }
  | { type: 'THROW'; from: Cell; cell: Cell }
  /**
   * Любой звук. `radius` — на каком расстоянии его слышно (кольцо расходится ровно
   * до него, правило 8.3); `heardBy` — номера услышавших библиотекарей.
   */
  | { type: 'SOUND'; cell: Cell; kind: SoundKind; radius: number; heardBy: number[] }
  | { type: 'LISTEN_START'; m: number }
  | { type: 'LISTEN_END'; m: number }
  | { type: 'WAYPOINT'; m: number; target: Cell }
  | { type: 'SNIFF'; m: number; target: Cell }
  | { type: 'ALERT'; m: number; cell: Cell }
  | { type: 'RUN'; m: number }
  | { type: 'RETARGET'; m: number; cell: Cell }
  | { type: 'SEARCH_START'; m: number }
  | { type: 'CALM'; m: number }
  | { type: 'ANGER'; m: number; level: number }
  | { type: 'LIB_STEP'; m: number; from: Cell; to: Cell; running: boolean }
  | { type: 'CAUGHT'; m: number; at: Cell; cause: HuntCause; last: boolean }
  | { type: 'CARD_LOST'; left: number }
  | { type: 'FILE_END'; m: number }
  | { type: 'SCENE_END' }
  /** Победа. `near` — библиотекарь был ближе 2 клеток («Knapp!»). */
  | { type: 'EXIT'; near: boolean }
  | { type: 'LOST' }
  | { type: 'DENIED'; reason: DeniedReason; cell: Cell | null }
  | { type: 'PAUSED' }
  | { type: 'RESUMED' };

export type GameEventType = GameEvent['type'];
export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
