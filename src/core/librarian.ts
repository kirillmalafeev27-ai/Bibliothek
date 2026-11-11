/**
 * Библиотекарь (план, 2.3): ходит, слушает, принюхивается, замирает («Wer da?»),
 * бежит на звук, ищет, злится, ловит, подшивает билет.
 * Все функции меняют черновик состояния, созданный редуктором.
 */
import { balance } from '../config/balance';
import type { GameEvent } from './events';
import type { Sound } from './hearing';
import type { Cell } from './library';
import { cellIndex, distance, floorCells, sameCell } from './library';
import { distanceMap, shortestPath } from './pathfinding';
import { Rng } from './rng';
import type { GameState, Librarian } from './state';
import { STAY } from './state';
import { pickUpAt } from './hero';

function walkDur(s: GameState): number {
  return s.level.walkStepA * s.unitA;
}

/** Длительность шага бега: злость ускоряет (2.3.6). */
export function runDur(s: GameState, m: Librarian): number {
  const mul = balance.angerMul[Math.min(m.anger, balance.maxAnger)] ?? 1;
  return s.level.huntStepA * s.unitA * mul;
}

function librarianAt(s: GameState, cell: Cell, exceptId: number): Librarian | undefined {
  return s.librarians.find((o) => o.id !== exceptId && sameCell(o.cell, cell));
}

/**
 * Следующие клетки пути библиотекаря (до `k` штук). Единая функция: её используют
 * логика, отпечатки тапочек и путь броска (13.3.6).
 */
export function librarianPath(s: GameState, m: Librarian, k = Infinity): Cell[] {
  if (!m.target) return [];
  if (m.mode === 'search' || m.mode === 'file') return [];
  if (m.mode === 'listen' && m.atWaypoint) return [];
  const path = shortestPath(s.lib, m.cell, m.target);
  if (!path) return [];
  return k === Infinity ? path : path.slice(0, k);
}

/** Путь, которым библиотекарь побежит к клетке броска (2.8.6). */
export function pathToSound(s: GameState, m: Librarian, cell: Cell): Cell[] {
  return shortestPath(s.lib, m.cell, cell) ?? [];
}

function withRng<T>(s: GameState, fn: (rng: Rng) => T): T {
  const rng = new Rng(s.rng);
  const out = fn(rng);
  s.rng = rng.state;
  return out;
}

/**
 * Новая точка маршрута (2.3.5): обычно случайная клетка пола в 4–10 шагах;
 * раз в sniffA единиц — в пределах 2 клеток от героя («Schnupper…»).
 */
function chooseWaypoint(s: GameState, m: Librarian, ev: GameEvent[]): void {
  const dist = distanceMap(s.lib, m.cell);
  const reachable = floorCells(s.lib).filter(
    (c) => (dist[cellIndex(s.lib, c.x, c.y)] as number) > 0,
  );
  if (reachable.length === 0) {
    m.target = null;
    return;
  }
  if (s.time >= m.nextSniffAt) {
    const near = reachable.filter((c) => distance(c, s.hero.cell) <= balance.sniffR);
    if (near.length > 0) {
      const target = withRng(s, (rng) => rng.pick(near));
      m.target = target;
      m.sniffed = true;
      m.cause = 'sniff';
      m.nextSniffAt = s.time + s.level.sniffA * s.unitA;
      ev.push({ type: 'SNIFF', m: m.id, target });
      return;
    }
  }
  const { minSteps, maxSteps } = balance.waypoint;
  let pool = reachable.filter((c) => {
    const d = dist[cellIndex(s.lib, c.x, c.y)] as number;
    return d >= minSteps && d <= maxSteps;
  });
  if (pool.length === 0) pool = reachable;
  const target = withRng(s, (rng) => rng.pick(pool));
  m.target = target;
  m.sniffed = false;
  m.cause = null;
  ev.push({ type: 'WAYPOINT', m: m.id, target });
}

function startListen(s: GameState, m: Librarian, ev: GameEvent[], atWaypoint: boolean): void {
  m.mode = 'listen';
  m.timer = balance.listenA * s.unitA;
  m.stepDur = 0;
  m.from = null;
  m.atWaypoint = atWaypoint;
  ev.push({ type: 'LISTEN_START', m: m.id });
}

function startWalk(s: GameState, m: Librarian): void {
  m.mode = 'walk';
  m.burstLeft = balance.burst;
  m.stepDur = walkDur(s);
  m.timer = m.stepDur;
  m.from = null;
}

function startSearch(s: GameState, m: Librarian, ev: GameEvent[]): void {
  m.mode = 'search';
  m.timer = balance.searchA * s.unitA;
  m.stepDur = 0;
  m.from = null;
  ev.push({ type: 'SEARCH_START', m: m.id });
}

function startRun(s: GameState, m: Librarian, ev: GameEvent[]): void {
  m.mode = 'run';
  m.stepDur = runDur(s, m);
  m.timer = m.stepDur;
  m.from = null;
  ev.push({ type: 'RUN', m: m.id });
  if (!m.target || sameCell(m.cell, m.target)) startSearch(s, m, ev);
}

/** Поимка (2.3.8, 2.6.3): библиотекарь вошёл на клетку героя. */
function catchHero(s: GameState, m: Librarian, ev: GameEvent[]): void {
  const at = s.hero.cell;
  const cause = m.cause;
  s.stats.caught += 1;
  const key = cause === 'error' || cause === 'squeak' || cause === 'step' || cause === 'sniff' ? cause : 'other';
  s.stats.caughtBy[key] += 1;
  if (!s.debug.infiniteCards) s.hero.cards -= 1;
  const last = s.hero.cards <= 0;
  ev.push({ type: 'CAUGHT', m: m.id, at, cause, last });
  ev.push({ type: 'CARD_LOST', left: Math.max(0, s.hero.cards) });
  // Злость сбрасывается после поимки (2.3.6).
  m.anger = 0;
  m.target = null;
  m.sniffed = false;
  m.cause = null;
  m.from = null;
  m.stepDur = 0;
  if (last) {
    // Отдан последний билет — «Raus!», поражение (2.6.4).
    s.hero.ready = false;
    s.status = 'lost';
    ev.push({ type: 'LOST' });
    return;
  }
  // Герой — на клетке у двери; листы и словари при нём, готовое действие сгорает.
  if (s.hero.ready) ev.push({ type: 'READY_USED' });
  s.hero.ready = false;
  s.hero.intent = STAY;
  s.hero.resume = null;
  s.hero.cell = s.lib.start;
  s.hero.faceY = -1;
  pickUpAt(s, ev);
  // Поймавший возвращается к столу и подшивает билет в картотеку.
  m.cell = freeCellNear(s, m.desk, m.id);
  m.mode = 'file';
  m.timer = balance.fileCardA * s.unitA;
  // Часы мира стоят, пока идёт сцена поимки, но не дольше 1.5 с (2.6.3).
  s.status = 'catchScene';
  s.sceneLeft = balance.catchSceneSec;
}

/** Стол или, если его занял второй библиотекарь, ближайшая к нему свободная клетка. */
function freeCellNear(s: GameState, desk: Cell, exceptId: number): Cell {
  if (!librarianAt(s, desk, exceptId)) return desk;
  const dist = distanceMap(s.lib, desk);
  let best = desk;
  let bestD = Infinity;
  for (const c of floorCells(s.lib)) {
    const d = dist[cellIndex(s.lib, c.x, c.y)] as number;
    if (d <= 0 || d >= bestD) continue;
    if (librarianAt(s, c, exceptId) || sameCell(c, s.hero.cell)) continue;
    best = c;
    bestD = d;
  }
  return best;
}

function moveTo(s: GameState, m: Librarian, next: Cell, ev: GameEvent[]): void {
  const from = m.cell;
  m.from = from;
  m.cell = next;
  ev.push({ type: 'LIB_STEP', m: m.id, from, to: next, running: m.mode === 'run' });
  if (sameCell(next, s.hero.cell) && s.status === 'playing') catchHero(s, m, ev);
}

/** После шага: остановка послушать, поиск или следующий шаг. */
function afterMove(s: GameState, m: Librarian, ev: GameEvent[]): void {
  if (m.mode === 'walk') {
    m.burstLeft -= 1;
    if (!m.target || sameCell(m.cell, m.target)) startListen(s, m, ev, true);
    else if (m.burstLeft <= 0) startListen(s, m, ev, false);
    else {
      m.stepDur = walkDur(s);
      m.timer = m.stepDur;
    }
  } else if (m.mode === 'run') {
    if (!m.target || sameCell(m.cell, m.target)) startSearch(s, m, ev);
    else {
      m.stepDur = runDur(s, m);
      m.timer = m.stepDur;
    }
  }
}

/** Шаг ходьбы или бега к цели. */
function stepTowardsTarget(s: GameState, m: Librarian, ev: GameEvent[]): void {
  const arrive = (): void => {
    if (m.mode === 'run') startSearch(s, m, ev);
    else startListen(s, m, ev, true);
  };
  if (!m.target || sameCell(m.cell, m.target)) {
    arrive();
    return;
  }
  const path = shortestPath(s.lib, m.cell, m.target);
  const next = path?.[0];
  if (!next) {
    arrive();
    return;
  }
  const other = librarianAt(s, next, m.id);
  if (other) {
    // На одной клетке двое не стоят (2.3.9).
    if (sameCell(next, m.target)) {
      // Цель занята вторым библиотекарем: считаем, что пришёл, — слушает рядом.
      arrive();
      return;
    }
    const otherNext =
      other.mode === 'walk' || other.mode === 'run'
        ? (other.target ? shortestPath(s.lib, other.cell, other.target)?.[0] : undefined)
        : undefined;
    if (otherNext && sameCell(otherNext, m.cell)) {
      // Идут навстречу друг другу в узком проходе: расходятся, меняясь клетками.
      const mine = m.cell;
      m.from = mine;
      m.cell = next;
      other.from = next;
      other.cell = mine;
      ev.push({ type: 'LIB_STEP', m: m.id, from: mine, to: next, running: m.mode === 'run' });
      ev.push({ type: 'LIB_STEP', m: other.id, from: next, to: mine, running: other.mode === 'run' });
      if (sameCell(m.cell, s.hero.cell) && s.status === 'playing') catchHero(s, m, ev);
      if (s.status === 'playing' && sameCell(other.cell, s.hero.cell)) catchHero(s, other, ev);
      if (s.status !== 'playing') return;
      afterMove(s, m, ev);
      afterMove(s, other, ev);
      return;
    }
    // Второй ждёт.
    m.from = null;
    m.timer = balance.blockedRetryA * s.unitA;
    return;
  }
  moveTo(s, m, next, ev);
  if (s.status !== 'playing') return;
  afterMove(s, m, ev);
}

/** Продвигает одного библиотекаря на dt секунд. */
export function tickLibrarian(s: GameState, m: Librarian, dt: number, ev: GameEvent[]): void {
  m.timer -= dt;
  let guard = 0;
  while (m.timer <= 0 && s.status === 'playing' && guard++ < 8) {
    const over = -m.timer;
    switch (m.mode) {
      case 'listen': {
        ev.push({ type: 'LISTEN_END', m: m.id });
        if (m.atWaypoint || !m.target) chooseWaypoint(s, m, ev);
        startWalk(s, m);
        break;
      }
      case 'alert':
        startRun(s, m, ev);
        break;
      case 'search': {
        // Ничего не услышал — успокаивается, злость сбрасывается (2.3.4).
        m.anger = 0;
        ev.push({ type: 'CALM', m: m.id });
        chooseWaypoint(s, m, ev);
        startWalk(s, m);
        break;
      }
      case 'file': {
        ev.push({ type: 'FILE_END', m: m.id });
        chooseWaypoint(s, m, ev);
        startWalk(s, m);
        break;
      }
      case 'walk':
      case 'run':
        stepTowardsTarget(s, m, ev);
        break;
    }
    if (s.status !== 'playing') return;
    m.timer -= over;
  }
}

/**
 * Реакция на услышанный звук (2.3.3, 2.3.6, 2.4.4).
 * Из спокойного состояния он сначала замирает («Wer da?»), потом бежит.
 * Уже бежит или ищет — сразу меняет цель; звук героя при этом его злит.
 */
export function reactToSound(s: GameState, m: Librarian, sound: Sound, ev: GameEvent[]): void {
  const fromHero = sound.kind !== 'book';
  switch (m.mode) {
    case 'run':
    case 'search': {
      const before = m.anger;
      if (fromHero && s.level.anger && m.anger < balance.maxAnger) {
        m.anger += 1;
        ev.push({ type: 'ANGER', m: m.id, level: m.anger });
      }
      m.target = sound.cell;
      m.sniffed = false;
      m.cause = sound.kind;
      if (m.mode === 'search') {
        ev.push({ type: 'RETARGET', m: m.id, cell: sound.cell });
        if (sameCell(m.cell, sound.cell)) {
          // Звук прямо под ногами: ищет здесь заново.
          m.timer = balance.searchA * s.unitA;
        } else {
          startRun(s, m, ev);
        }
      } else {
        ev.push({ type: 'RETARGET', m: m.id, cell: sound.cell });
        if (m.anger !== before && m.stepDur > 0) {
          // Разозлился на бегу: остаток шага сокращается вместе с шагом.
          const next = runDur(s, m);
          m.timer *= next / m.stepDur;
          m.stepDur = next;
        }
        if (sameCell(m.cell, sound.cell)) startSearch(s, m, ev);
      }
      break;
    }
    case 'alert': {
      m.target = sound.cell;
      m.cause = sound.kind;
      ev.push({ type: 'RETARGET', m: m.id, cell: sound.cell });
      break;
    }
    case 'listen':
    case 'walk':
    case 'file': {
      if (m.mode === 'listen') ev.push({ type: 'LISTEN_END', m: m.id });
      m.mode = 'alert';
      m.timer = s.level.alertA * s.unitA;
      m.stepDur = 0;
      m.from = null;
      m.target = sound.cell;
      m.sniffed = false;
      m.cause = sound.kind;
      ev.push({ type: 'ALERT', m: m.id, cell: sound.cell });
      break;
    }
  }
}
