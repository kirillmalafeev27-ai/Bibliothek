/**
 * Действия героя (план, 2.2, 2.5, 2.6): шаг, бросок словаря, подбор листов и словарей.
 * Все функции меняют черновик состояния, созданный редуктором.
 */
import { balance } from '../config/balance';
import type { DeniedReason, GameEvent } from './events';
import type { Sound, SoundKind } from './hearing';
import { hears, inHalo, soundRadius } from './hearing';
import type { Cell } from './library';
import { distance, isDoor, isSqueak, sameCell } from './library';
import { checkThrow, heroPath } from './intent';
import { reactToSound } from './librarian';
import type { GameState } from './state';
import { STAY, hasAllPages } from './state';

/** Звук в библиотеке: кто услышал — тот реагирует (2.4). */
export function emitSound(s: GameState, kind: SoundKind, cell: Cell, ev: GameEvent[]): void {
  const sound: Sound = { kind, cell };
  const heard = s.debug.deaf ? [] : s.librarians.filter((m) => hears(m, sound, s.level));
  ev.push({
    type: 'SOUND',
    cell,
    kind,
    radius: soundRadius(kind, s.level),
    heardBy: heard.map((m) => m.id),
  });
  if (heard.length > 0 && kind !== 'book') {
    // Услышан герой: ошибка, скрип или шаг. Брошенные словари не считаются (2.6.5).
    s.stats.heard += 1;
    s.stats.heardBy[kind] += 1;
  }
  for (const m of heard) reactToSound(s, m, sound, ev);
}

/** Лист и словарь подбираются сами, когда герой входит на клетку (2.2.1). */
export function pickUpAt(s: GameState, ev: GameEvent[]): void {
  const cell = s.hero.cell;
  for (let i = s.pages.length - 1; i >= 0; i--) {
    const page = s.pages[i];
    if (page && sameCell(page.cell, cell)) {
      s.pages.splice(i, 1);
      s.hero.pages.push(page.id);
      ev.push({ type: 'PICKUP', item: 'page', cell, pageId: page.id });
    }
  }
  for (let i = s.books.length - 1; i >= 0; i--) {
    // Словарей в руках не больше трёх: лишний остаётся лежать.
    if (s.hero.books >= balance.maxBooks) break;
    if (sameCell(s.books[i], cell)) {
      s.books.splice(i, 1);
      s.hero.books += 1;
      ev.push({ type: 'PICKUP', item: 'book', cell, pageId: -1 });
    }
  }
}

function bank(s: GameState, ev: GameEvent[]): void {
  if (!s.hero.ready) {
    s.hero.ready = true;
    ev.push({ type: 'READY' });
  }
}

function deny(s: GameState, reason: DeniedReason, cell: Cell | null, ev: GameEvent[]): void {
  ev.push({ type: 'DENIED', reason, cell });
  bank(s, ev);
}

function doStep(s: GameState, next: Cell, ev: GameEvent[]): void {
  const h = s.hero;
  const from = h.cell;
  if (next.x !== from.x) h.faceX = next.x > from.x ? 1 : -1;
  if (next.y !== from.y) h.faceY = next.y > from.y ? 1 : -1;
  h.cell = next;
  s.stats.steps += 1;
  const squeak = isSqueak(s.lib, next.x, next.y);
  ev.push({ type: 'STEP', from, to: next, squeak });

  if (isDoor(s.lib, next)) {
    // Победа — герой вошёл на клетку двери со всеми тремя листами (2.6.2).
    const near = s.librarians.some((m) => distance(m.cell, next) < balance.knappR);
    h.intent = STAY;
    s.status = 'won';
    ev.push({ type: 'EXIT', near });
    return;
  }

  pickUpAt(s, ev);
  if (h.intent.kind === 'move' && sameCell(h.intent.cell, next)) h.intent = STAY;
  // Шаг по скрипучей половице — громкий звук, обычный шаг — тихий (2.4).
  emitSound(s, squeak ? 'squeak' : 'step', next, ev);
}

function doThrow(s: GameState, cell: Cell, ev: GameEvent[]): void {
  const h = s.hero;
  h.books -= 1;
  s.stats.throws += 1;
  if (cell.x !== h.cell.x) h.faceX = cell.x > h.cell.x ? 1 : -1;
  // Словарь остаётся лежать, его можно подобрать снова (2.5.3).
  s.books.push(cell);
  ev.push({ type: 'THROW', from: h.cell, cell });
  // После броска герой возвращается к прежней цели ходьбы, если она была.
  h.intent = h.resume && !sameCell(h.resume, h.cell) ? { kind: 'move', cell: h.resume } : STAY;
  h.resume = null;
  emitSound(s, 'book', cell, ev);
}

/**
 * Выполняет одно действие по текущему намерению (2.2). Вызывается в момент клика по
 * верному ответу или, при готовом действии, в момент выбора намерения (2.2.6).
 * Если выполнить нельзя — действие становится готовым.
 */
export function act(s: GameState, ev: GameEvent[]): void {
  const h = s.hero;
  const it = h.intent;
  if (it.kind === 'stay') {
    bank(s, ev);
    return;
  }
  if (it.kind === 'throw') {
    const check = checkThrow(s, it.cell);
    if (check !== 'ok') {
      h.intent = h.resume ? { kind: 'move', cell: h.resume } : STAY;
      h.resume = null;
      deny(s, check, it.cell, ev);
      return;
    }
    doThrow(s, it.cell, ev);
    return;
  }
  if (sameCell(h.cell, it.cell)) {
    h.intent = STAY;
    bank(s, ev);
    return;
  }
  if (isDoor(s.lib, it.cell) && !hasAllPages(s)) {
    deny(s, 'blocked', it.cell, ev);
    return;
  }
  const path = heroPath(s, it.cell);
  const next = path?.[0];
  if (!next) {
    // Пути нет: клетку занял библиотекарь (2.2.7).
    deny(s, 'blocked', it.cell, ev);
    return;
  }
  if (s.librarians.some((m) => sameCell(m.cell, next))) {
    deny(s, 'blocked', next, ev);
    return;
  }
  // Осторожный шаг (2.2.8): в нимб слушающего библиотекаря герой сам не шагнёт.
  if (s.hints.cautiousStep && inHalo(s, next)) {
    deny(s, 'halo', next, ev);
    return;
  }
  doStep(s, next, ev);
}
