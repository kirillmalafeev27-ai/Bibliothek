/**
 * Игровая сцена: рисует раунд и откликается на события редуктора (план, 13.3.4).
 * Состояние не меняет — только читает. Умеет режим заставки для меню: библиотекарь
 * бродит по пустой библиотеке (11.5).
 */
import Phaser from 'phaser';
import type { ArtFactory } from '../art/ArtFactory';
import { CELL, DEPTH, TEX } from '../art/manifest';
import { balance } from '../config/balance';
import type { Round } from '../app/Round';
import type { Cell, GameEvent, GameState } from '../core';
import { distance, sameCell } from '../core';
import type { SfxKey } from '../i18n/sfx.de';
import { AimView } from '../render/AimView';
import { HearingView } from '../render/HearingView';
import { HeroView } from '../render/HeroView';
import { Juice } from '../render/juice';
import type { WordSize } from '../render/juice';
import { LibrarianView } from '../render/LibrarianView';
import { MarginsView } from '../render/MarginsView';
import type { Orient, Point } from '../render/orientation';
import { Mapper } from '../render/orientation';
import { smooth } from '../render/rig';
import type { WorldRect } from '../render/WorldView';
import { WorldView } from '../render/WorldView';
import type { Layout } from '../shared/layout';
import type { SceneHost } from './host';
import { HOST_KEY } from './host';

export type SceneMode = 'idle' | 'attract' | 'intro' | 'play' | 'outro';

export interface AttachOptions {
  mode: 'attract' | 'intro' | 'play';
  /** В ландшафте дверь сбоку: с какой стороны (выбирается на раунд). */
  doorSide: 'left' | 'right';
  onIntroDone?: () => void;
  onOutroDone?: (result: 'won' | 'lost') => void;
}

interface CatchAnim {
  t: number;
  m: number;
  last: boolean;
  heroFrom: Point;
  libFrom: Point;
  card: Phaser.GameObjects.Image | null;
  mark: Phaser.GameObjects.Image | null;
  stamped: boolean;
  raus: boolean;
}

interface Timeline {
  t: number;
  dur: number;
  kind: 'intro' | 'won' | 'lost';
  fired: Set<string>;
  near?: boolean;
  from?: Point;
}

/** Через сколько после начала поимки летит штамп «Ungültig!». */
const STAMP_AT = 0.62;

export class GameScene extends Phaser.Scene {
  private host!: SceneHost;
  private art!: ArtFactory;
  private round: Round | null = null;
  private unsub: (() => void) | null = null;
  private opts: AttachOptions | null = null;

  mode: SceneMode = 'idle';
  private mapper: Mapper | null = null;
  private world: WorldView | null = null;
  private libs: LibrarianView[] = [];
  private hero: HeroView | null = null;
  private hearing: HearingView | null = null;
  private aim: AimView | null = null;
  private juice: Juice | null = null;
  private margins: MarginsView | null = null;

  private layout: Layout | null = null;
  private dprNow = 1;
  private paused = false;
  private catchAnim: CatchAnim | null = null;
  private timeline: Timeline | null = null;
  private pendingBooks: Cell[] = [];
  private klimperAt = -Infinity;
  private steamAt = 0;
  private zzzAt = 0;
  private clock = 0;
  private pointerStart: { id: number; x: number; y: number } | null = null;
  private readonly cleanups: (() => void)[] = [];

  constructor() {
    super('Game');
  }

  create(): void {
    this.host = this.registry.get(HOST_KEY) as SceneHost;
    if (!this.host.art) throw new Error('GameScene: нет фабрики арта');
    this.art = this.host.art;
    this.cameras.main.setOrigin(0, 0);
    this.cameras.main.setRoundPixels(false);
    this.bindPointer();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardown());
    this.host.onSceneReady();
  }

  // ─────────────── раунд ───────────────

  attach(round: Round, opts: AttachOptions): void {
    this.detach();
    this.round = round;
    this.opts = opts;
    this.mode = opts.mode;
    this.build();
    this.unsub = round.subscribe((events, state, prev) => this.onEvents(events, state, prev));
    if (opts.mode === 'intro') this.startIntro();
  }

  detach(): void {
    this.unsub?.();
    this.unsub = null;
    this.clearViews();
    this.round = null;
    this.opts = null;
    this.mode = 'idle';
    this.catchAnim = null;
    this.timeline = null;
    this.pendingBooks = [];
    this.tweens.killAll();
    this.time.removeAllEvents();
  }

  private orient(): Orient {
    if (!this.layout || this.layout.orientation === 'portrait') return 'portrait';
    return this.opts?.doorSide ?? 'right';
  }

  private clearViews(): void {
    this.world?.destroy();
    for (const l of this.libs) l.destroy();
    this.hero?.destroy();
    this.hearing?.destroy();
    this.aim?.destroy();
    this.juice?.destroy();
    this.margins?.destroy();
    this.world = null;
    this.libs = [];
    this.hero = null;
    this.hearing = null;
    this.aim = null;
    this.juice = null;
    this.margins = null;
  }

  /** Строит все виды под текущую ориентацию. Состояние раунда не трогает. */
  private build(): void {
    const round = this.round;
    if (!round) return;
    this.clearViews();
    const st = round.state;
    const mapper = new Mapper(this.orient(), st.lib.w, st.lib.h);
    this.mapper = mapper;
    const reduced = (): boolean => this.host.quality.reducedMotion;
    this.world = new WorldView(this, this.art, mapper, st, reduced);
    this.margins = new MarginsView(this, this.art, mapper, () => reduced() || this.host.quality.low);
    this.hearing = new HearingView(this, this.art, mapper, st);
    this.libs = st.librarians.map((m) => new LibrarianView(this, this.art, mapper, m.id));
    this.hero = new HeroView(this, this.art, mapper);
    this.hero.snapTo(st.hero.cell);
    this.hero.setVisible(this.mode !== 'attract');
    this.aim = new AimView(this, this.art, mapper);
    this.juice = new Juice(this, this.art, mapper, {
      reduced,
      particleScale: () => this.host.quality.particleScale,
      cyrillic: () => this.host.cyrillic(),
      dpr: () => this.dprNow,
    });
    for (const l of this.libs) {
      const m = st.librarians[l.id];
      if (m?.mode === 'file') l.setScript('stamp');
    }
    if (this.layout) this.applyCamera();
  }

  // ─────────────── раскладка ───────────────

  /** Новая раскладка: зум камеры, а при повороте экрана — перестройка видов. */
  relayout(layout: Layout, dpr: number): void {
    const turned = !this.layout || this.layout.orientation !== layout.orientation;
    this.layout = layout;
    this.dprNow = dpr;
    if (turned && this.round) {
      // Поворот посреди раунда: библиотека поворачивается вместе с панелью (11.1.6).
      const catchAnim = this.catchAnim;
      this.build();
      if (catchAnim) this.finishCatch(catchAnim);
      if (this.timeline && this.timeline.kind !== 'intro') this.finishOutro();
    } else {
      this.applyCamera();
    }
  }

  private applyCamera(): void {
    const layout = this.layout;
    if (!layout || !this.world) return;
    const cam = this.cameras.main;
    const zoom = (layout.cell * this.dprNow) / CELL;
    cam.setZoom(zoom);
    this.world.setFrame(layout.frame / layout.cell);
    this.scrollCamera();
  }

  private scrollCamera(): void {
    const layout = this.layout;
    if (!layout) return;
    const cam = this.cameras.main;
    const off = this.juice?.cameraOffset ?? { x: 0, y: 0 };
    cam.scrollX = (-layout.board.x / layout.cell) * CELL - off.x / cam.zoom;
    cam.scrollY = (-layout.board.y / layout.cell) * CELL - off.y / cam.zoom;
  }

  /** Точка мира → CSS-пиксели панели мира. */
  worldToCss(p: Point): Point {
    const layout = this.layout;
    if (!layout) return { x: 0, y: 0 };
    return { x: layout.board.x + (p.x / CELL) * layout.cell, y: layout.board.y + (p.y / CELL) * layout.cell };
  }

  cssToWorld(p: Point): Point {
    const layout = this.layout;
    if (!layout) return { x: 0, y: 0 };
    return { x: ((p.x - layout.board.x) / layout.cell) * CELL, y: ((p.y - layout.board.y) / layout.cell) * CELL };
  }

  /** Где на экране голова героя — для подсказок и пузырей обучения. */
  heroCss(): Point | null {
    return this.hero ? this.worldToCss(this.hero.headTop()) : null;
  }

  librarianCss(m: number): Point | null {
    const l = this.libs[m];
    return l ? this.worldToCss(l.headTop()) : null;
  }

  cellCss(cell: Cell): Point | null {
    return this.mapper ? this.worldToCss(this.mapper.center(cell)) : null;
  }

  /** Направление стрелки на экране → направление в библиотеке. */
  arrowToLogic(dir: Cell): Cell {
    return this.mapper ? this.mapper.dirToLogic(dir) : dir;
  }

  // ─────────────── ввод ───────────────

  private bindPointer(): void {
    const canvas = this.game.canvas;
    const local = (e: PointerEvent): Point => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const cellAt = (p: Point): Cell | null => {
      if (!this.mapper) return null;
      const w = this.cssToWorld(p);
      return this.mapper.cellAt(w.x, w.y);
    };
    const down = (e: PointerEvent): void => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const p = local(e);
      this.pointerStart = { id: e.pointerId, x: p.x, y: p.y };
    };
    const up = (e: PointerEvent): void => {
      const start = this.pointerStart;
      this.pointerStart = null;
      if (!start || start.id !== e.pointerId) return;
      const p = local(e);
      if (Math.hypot(p.x - start.x, p.y - start.y) > 14) return;
      const cell = cellAt(p);
      if (cell) this.host.onCellTap(cell);
    };
    const move = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse') return;
      this.host.onCellHover(cellAt(local(e)));
    };
    const leave = (): void => this.host.onCellHover(null);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', leave);
    canvas.style.touchAction = 'manipulation';
    this.cleanups.push(() => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
    });
  }

  // ─────────────── пауза ───────────────

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.time.paused = paused;
    this.juice?.setPaused(paused);
  }

  // ─────────────── отклик на события (9.2) ───────────────

  private word(key: SfxKey, at: Point, size: WordSize = 'normal', hold?: number): void {
    if (this.mode === 'attract' || !this.juice) return;
    this.juice.word(this.host.word(key), at, size, hold);
  }

  private overCell(cell: Cell, lift = 0.36): Point {
    const c = this.mapper?.center(cell) ?? { x: 0, y: 0 };
    return { x: c.x, y: c.y - lift * CELL };
  }

  private sfx(name: string, at?: Cell | null): void {
    if (this.mode === 'attract') return;
    this.host.sound(name, at ?? null);
  }

  private onEvents(events: GameEvent[], state: GameState, prev: GameState): void {
    const hero = this.hero;
    const juice = this.juice;
    const world = this.world;
    const mapper = this.mapper;
    if (!hero || !juice || !world || !mapper) return;
    const shake = balance.view.shake;
    for (const e of events) {
      switch (e.type) {
        case 'STEP': {
          hero.stepTo(e.to);
          this.sfx(e.squeak ? 'squeak' : 'step', e.to);
          if (e.squeak) {
            this.word('knarr', this.overCell(e.to, 0.9));
            juice.shake(shake.squeak);
          }
          break;
        }
        case 'SOUND': {
          if (e.kind === 'book') {
            // Кольцо брошенного словаря расходится, когда словарь падает.
            this.time.delayedCall(balance.view.bookArcMs, () => this.hearing?.ring(e.cell, e.kind, e.radius));
          } else if (e.kind !== 'step' || e.heardBy.length > 0) {
            // Тихий шаг даёт кольцо, только если его услышали (8.2).
            this.hearing?.ring(e.cell, e.kind, e.radius);
          }
          if (e.kind !== 'step') this.margins?.flinch();
          for (const m of e.heardBy) {
            const l = this.libs[m];
            if (l) juice.heardFlash(l.earPoint());
          }
          break;
        }
        case 'PICKUP': {
          if (e.item === 'page') {
            const from = world.hideItemAt(e.cell, 'page') ?? mapper.center(e.cell);
            const spec = [TEX.page0, TEX.page1, TEX.page2][e.pageId] ?? TEX.page0;
            hero.holdUp(spec.key);
            const slot = this.host.pageSlotPoint(e.pageId);
            const to = slot ? this.cssToWorld(slot) : { x: from.x, y: from.y - CELL * 2 };
            juice.fly(spec, { x: from.x, y: from.y - CELL * 0.5 }, to, 520, {
              arc: 1.1,
              spin: Math.PI * 2,
              scaleTo: 0.7,
              depth: DEPTH.top + 40,
              ease: 'Sine.easeIn',
            });
            this.word('raschel', hero.headTop(), 'small');
            this.sfx('rustle', e.cell);
          } else {
            const from = world.hideItemAt(e.cell, 'book') ?? mapper.center(e.cell);
            juice.fly(TEX.book, from, hero.handPoint(), 220, { arc: 0.5, scaleTo: 0.6 });
            this.word('schnapp', hero.headTop(), 'small');
            this.sfx('grab', e.cell);
          }
          break;
        }
        case 'THROW': {
          const to = mapper.center(e.cell);
          hero.throwAt(to);
          this.pendingBooks.push(e.cell);
          this.sfx('throw', e.from);
          const dist = distance(e.from, e.cell);
          juice.fly(TEX.book, hero.handPoint(), to, balance.view.bookArcMs, {
            arc: 0.9 + dist * 0.28,
            spin: Math.PI * 3,
            depth: DEPTH.top + 30,
            onDone: () => {
              this.world?.showItemAt(e.cell, 'book');
              this.word('rums', this.overCell(e.cell, 0.5));
              this.juice?.shake(shake.throw);
              this.sfx('thud', e.cell);
            },
          });
          break;
        }
        case 'ANSWERED': {
          if (e.correct) {
            juice.inkStar(hero.headTop());
            this.sfx('correct');
          } else {
            juice.bookFall(hero.pos);
            this.word('plumps', hero.headTop());
            juice.shake(shake.error);
            this.sfx('bookFall', state.hero.cell);
          }
          break;
        }
        case 'LISTEN_START': {
          const l = this.libs[e.m];
          if (l && this.mode !== 'attract') this.word('hm', l.headTop(), 'small', 560);
          break;
        }
        case 'SNIFF': {
          const l = this.libs[e.m];
          l?.startSniff();
          if (l) this.word('schnupper', l.headTop());
          this.sfx('sniff', state.librarians[e.m]?.cell);
          break;
        }
        case 'ALERT': {
          const l = this.libs[e.m];
          l?.startJerk();
          if (l) this.word('werDa', l.headTop());
          this.sfx('inhale', state.librarians[e.m]?.cell);
          break;
        }
        case 'RUN': {
          const l = this.libs[e.m];
          const m = state.librarians[e.m];
          if (l && m) this.word(m.anger > 0 ? 'ruheAngry' : 'ruhe', l.headTop());
          this.sfx('run', m?.cell);
          break;
        }
        case 'ANGER': {
          const l = this.libs[e.m];
          if (l) {
            this.word('ruheAngry', l.headTop(), 'big');
            juice.steam(l.earPoint(), -l.facing);
          }
          juice.shake(shake.anger);
          this.sfx('grumble', state.librarians[e.m]?.cell);
          break;
        }
        case 'SEARCH_START': {
          const l = this.libs[e.m];
          if (l) this.word('woBistDu', l.headTop(), 'small');
          break;
        }
        case 'CALM': {
          const l = this.libs[e.m];
          if (l) this.word('hmpf', l.headTop(), 'small');
          this.sfx('sigh', state.librarians[e.m]?.cell);
          break;
        }
        case 'LIB_STEP': {
          const m = state.librarians[e.m];
          if (!m || this.mode === 'attract') break;
          // Ключи рядом: связка звякает, когда он идёт поблизости, не чаще раза в 8 с.
          if (
            !e.running &&
            distance(e.to, state.hero.cell) < 3.2 &&
            this.clock - this.klimperAt > balance.view.klimperEverySec
          ) {
            this.klimperAt = this.clock;
            const l = this.libs[e.m];
            if (l) this.word('klimper', { x: l.pos.x, y: l.pos.y - CELL * 0.9 }, 'small', 520);
          }
          break;
        }
        case 'CAUGHT':
          this.startCatch(e.m, e.last, prev);
          break;
        case 'FILE_END':
          this.libs[e.m]?.setScript('none');
          break;
        case 'SCENE_END':
          if (this.catchAnim) this.finishCatch(this.catchAnim);
          break;
        case 'EXIT':
          this.startOutro('won', e.near);
          break;
        case 'DENIED':
          this.sfx('deny');
          break;
        default:
          break;
      }
    }
    world.syncItems(state);
    // Только что брошенные словари прячутся, пока летят.
    if (events.some((e) => e.type === 'THROW')) {
      for (const cell of this.pendingBooks) world.hideItemAt(cell, 'book');
      this.pendingBooks = [];
    }
  }

  // ─────────────── поимка (2.6.3, 9.2) ───────────────

  private startCatch(m: number, last: boolean, prev: GameState): void {
    const hero = this.hero;
    const lib = this.libs[m];
    if (!hero || !lib) return;
    if (this.catchAnim) this.finishCatch(this.catchAnim);
    hero.held = true;
    lib.held = true;
    hero.setScript('caught');
    lib.setScript('grab');
    // Он смотрит на героя.
    if (Math.abs(hero.pos.x - lib.pos.x) > 2) lib.facing = hero.pos.x > lib.pos.x ? 1 : -1;
    this.catchAnim = {
      t: 0,
      m,
      last,
      heroFrom: { ...hero.pos },
      libFrom: { ...lib.pos },
      card: null,
      mark: null,
      stamped: false,
      raus: false,
    };
    this.word('ausweis', lib.headTop(), 'big', 640);
    this.sfx('grab', prev.hero.cell);
  }

  private updateCatch(dt: number): void {
    const c = this.catchAnim;
    const hero = this.hero;
    const lib = this.libs[c?.m ?? -1];
    const juice = this.juice;
    if (!c || !hero || !lib || !juice) return;
    c.t += dt;
    const k = this.art.scale;
    // Хватает героя за шиворот и поднимает.
    const hand = lib.handPoint();
    const lift = smooth(c.t / 0.25);
    const target = { x: hand.x, y: hand.y + CELL * 0.82 };
    let hx = c.heroFrom.x + (target.x - c.heroFrom.x) * lift;
    let hy = c.heroFrom.y + (target.y - c.heroFrom.y) * lift;
    if (c.t > 0.45 && !c.card) {
      const mid = { x: (lib.pos.x + hx) / 2, y: Math.min(lib.pos.y, hy) - CELL * 1.25 };
      c.card = this.add.image(mid.x, mid.y, TEX.card.key).setScale(k * 0.2).setDepth(DEPTH.effects + 60);
      this.tweens.add({ targets: c.card, scale: k * 1.5, angle: -6, duration: 160, ease: 'Back.easeOut' });
    }
    if (c.t > STAMP_AT && !c.stamped && c.card) {
      c.stamped = true;
      c.mark = this.add
        .image(c.card.x, c.card.y, TEX.stampMark.key)
        .setScale(k * 3)
        .setAlpha(0)
        .setAngle(-24)
        .setDepth(DEPTH.effects + 61);
      this.tweens.add({ targets: c.mark, scale: k * 1.15, alpha: 1, angle: -12, duration: 130, ease: 'Cubic.easeIn' });
      this.word('ungueltig', { x: c.card.x, y: c.card.y - CELL * 0.45 }, 'big', 560);
      juice.shake(balance.view.shake.caught);
      this.sfx('stamp');
    }
    if (c.last && c.t > 0.92 && !c.raus) {
      c.raus = true;
      this.word('raus', lib.headTop(), 'big', 900);
      juice.shake(balance.view.shake.lost);
      this.startOutro('lost', false);
    }
    // Уносит героя к двери: оба растворяются.
    const away = smooth((c.t - 0.95) / 0.45);
    if (!c.last && away > 0) {
      const door = this.world?.doorPoint(this.round!.state, 0) ?? hero.pos;
      const drift = 0.25 * away;
      hx += (door.x - hx) * drift;
      hy += (door.y - hy) * drift;
      hero.setAlpha(1 - away);
      lib.box.setAlpha(1 - away);
      lib.place({ x: c.libFrom.x + (door.x - c.libFrom.x) * drift, y: c.libFrom.y + (door.y - c.libFrom.y) * drift });
    }
    // При последнем билете героя дальше ведёт финал «Raus!».
    if (!c.last || !c.raus) hero.place({ x: hx, y: hy }, CELL);
    if (!c.last && c.t >= balance.catchSceneSec - 0.02) this.finishCatch(c);
  }

  private finishCatch(c: CatchAnim): void {
    if (this.catchAnim !== c) return;
    this.catchAnim = null;
    c.card?.destroy();
    c.mark?.destroy();
    if (c.last) return;
    const st = this.round?.state;
    const hero = this.hero;
    const lib = this.libs[c.m];
    if (!st || !hero || !lib) return;
    hero.held = false;
    hero.setScript('none');
    hero.setAlpha(1);
    hero.snapTo(st.hero.cell);
    lib.held = false;
    lib.box.setAlpha(1);
    lib.setScript(st.librarians[c.m]?.mode === 'file' ? 'stamp' : 'none');
    lib.place(this.mapper!.at(st.librarians[c.m]!.cell, 0.5, 0.62));
  }

  // ─────────────── интро и финал ───────────────

  private startIntro(): void {
    const st = this.round?.state;
    if (!st || !this.hero || !this.world) return;
    const from = this.world.doorPoint(st, 0.85);
    this.hero.held = true;
    this.hero.setScript('sneakIn');
    this.hero.place(from);
    this.hero.setAlpha(0);
    this.timeline = { t: 0, dur: 2.1, kind: 'intro', fired: new Set(), from };
    this.sfx('doorCreak');
  }

  /** Интро пропускается тапом (11.5.3). */
  skipIntro(): void {
    if (this.timeline?.kind === 'intro') this.finishIntro();
  }

  private finishIntro(): void {
    const st = this.round?.state;
    this.timeline = null;
    if (this.hero && st) {
      this.hero.held = false;
      this.hero.setScript('none');
      this.hero.setAlpha(1);
      this.hero.snapTo(st.hero.cell);
    }
    this.world?.setDoorOpen(0);
    this.mode = 'play';
    this.opts?.onIntroDone?.();
  }

  private startOutro(kind: 'won' | 'lost', near: boolean): void {
    if (this.timeline && this.timeline.kind !== 'intro') return;
    this.mode = 'outro';
    this.timeline = { t: 0, dur: balance.outroSec, kind, fired: new Set(), near };
    this.takeSnapshot(kind === 'won' ? 0.55 : 1.2);
  }

  /** Финальная анимация пропускается тапом (2.6.7). */
  skipOutro(): void {
    if (this.timeline && this.timeline.kind !== 'intro') this.finishOutro();
  }

  private finishOutro(): void {
    const tl = this.timeline;
    if (!tl || tl.kind === 'intro') return;
    this.timeline = null;
    this.opts?.onOutroDone?.(tl.kind);
  }

  private fire(tl: Timeline, key: string, at: number, fn: () => void): void {
    if (tl.t >= at && !tl.fired.has(key)) {
      tl.fired.add(key);
      fn();
    }
  }

  private updateTimeline(dt: number): void {
    const tl = this.timeline;
    const st = this.round?.state;
    const hero = this.hero;
    const world = this.world;
    if (!tl || !st || !hero || !world) return;
    tl.t += dt;
    if (tl.kind === 'intro') {
      // Дверь приоткрывается, герой на цыпочках проскальзывает внутрь (9.2).
      world.setDoorOpen(tl.t < 1.45 ? smooth(tl.t / 0.35) : 1 - smooth((tl.t - 1.45) / 0.35));
      const from = tl.from ?? hero.pos;
      const to = this.mapper!.at(st.hero.cell, 0.5, 0.62);
      const walk = smooth((tl.t - 0.3) / 1.0);
      hero.place({ x: from.x + (to.x - from.x) * walk, y: from.y + (to.y - from.y) * walk });
      hero.setAlpha(Math.min(1, Math.max(0, (tl.t - 0.25) / 0.3)));
      if (Math.abs(to.x - from.x) > 1) hero.facing = to.x > from.x ? 1 : -1;
      this.fire(tl, 'psst', 0.95, () => this.word('psst', hero.headTop()));
      this.fire(tl, 'still', 1.3, () => hero.setScript('none'));
      if (tl.t >= tl.dur) this.finishIntro();
      return;
    }
    if (tl.kind === 'won') {
      // Герой выскальзывает за дверь, библиотекарь засыпает за столом.
      world.setDoorOpen(tl.t < 1.35 ? smooth((tl.t - 0.1) / 0.25) : 1 - smooth((tl.t - 1.35) / 0.3));
      this.fire(tl, 'word', 0.12, () => this.word(tl.near ? 'knapp' : 'geschafft', hero.headTop(), 'big', 1100));
      this.fire(tl, 'cheer', 0.25, () => {
        hero.held = true;
        hero.setScript('cheer');
        this.sfx('win');
      });
      if (tl.t > 0.25) {
        const out = world.doorPoint(st, 0.55);
        const from = this.mapper!.at(st.lib.door, 0.5, 0.62);
        const t = smooth((tl.t - 0.25) / 0.5);
        hero.place({ x: from.x + (out.x - from.x) * t, y: from.y + (out.y - from.y) * t }, CELL * 2);
        hero.setAlpha(1 - smooth((tl.t - 1.2) / 0.4));
      }
      this.fire(tl, 'sleep', 0.45, () => {
        for (const l of this.libs) {
          const m = st.librarians[l.id];
          if (!m) continue;
          l.held = true;
          l.setScript('sleep');
          l.box.setAlpha(0);
          l.place(this.mapper!.at(m.desk, 0.5, 0.82));
          this.tweens.add({ targets: l.box, alpha: 1, duration: 280 });
        }
      });
      this.fire(tl, 'snore', 1.0, () => {
        const l = this.libs[0];
        if (l) this.word('schnarch', l.headTop(), 'normal', 900);
        this.sfx('snore');
      });
      if (tl.t > 0.9 && this.clock - this.zzzAt > 0.55) {
        this.zzzAt = this.clock;
        for (const l of this.libs) this.juice?.fly(TEX.zzz, l.earPoint(), { x: l.earPoint().x + CELL * 0.3, y: l.earPoint().y - CELL * 0.8 }, 900, { arc: 0.1, scaleTo: 1.4 });
      }
      if (tl.t >= tl.dur) this.finishOutro();
      return;
    }
    // Поражение: «Raus!» — героя выставляют за дверь, дверь хлопает.
    world.setDoorOpen(tl.t < 0.7 ? smooth(tl.t / 0.2) : 1 - smooth((tl.t - 0.7) / 0.15));
    if (tl.t < 0.7) {
      hero.held = true;
      hero.setScript('caught');
      const out = world.doorPoint(st, 0.9);
      const from = this.hero!.pos;
      const t = smooth(tl.t / 0.6);
      hero.place({ x: from.x + (out.x - from.x) * t * 0.35, y: from.y + (out.y - from.y) * t * 0.35 }, CELL * 2);
      hero.setAlpha(1 - smooth((tl.t - 0.3) / 0.35));
    }
    this.fire(tl, 'slam', 0.8, () => {
      this.juice?.shake(balance.view.shake.lost);
      this.sfx('doorSlam');
    });
    if (tl.t >= tl.dur) this.finishOutro();
  }

  /** Снимок кадра для карточки итогов (11.5.5): весь кадр, затем вырезаем миниатюру. */
  private takeSnapshot(delaySec: number): void {
    this.time.delayedCall(delaySec * 1000, () => {
      const layout = this.layout;
      const renderer = this.game.renderer;
      if (!layout || !renderer) return;
      const d = this.dprNow;
      const f = layout.field;
      renderer.snapshot((img) => {
        if (!(img instanceof HTMLImageElement)) return;
        const crop = (): void => {
          const w = Math.round(f.w * d);
          const h = Math.round(f.h * d);
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(w, 640);
          canvas.height = Math.round((canvas.width / w) * h);
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, Math.round(f.x * d), Math.round(f.y * d), w, h, 0, 0, canvas.width, canvas.height);
          try {
            this.snapshot = canvas.toDataURL('image/jpeg', 0.86);
          } catch {
            this.snapshot = img.src;
          }
        };
        if (img.complete) crop();
        else img.onload = crop;
      });
    });
  }

  /** Последний снимок кадра (data URL) или null. */
  snapshot: string | null = null;

  // ─────────────── кадр ───────────────

  override update(_time: number, deltaMs: number): void {
    this.host.onFrame(deltaMs);
    const round = this.round;
    if (!round || !this.world || !this.hero || !this.hearing || !this.aim || !this.juice) return;
    const dt = this.paused ? 0 : Math.min(deltaMs, 100) / 1000;
    this.clock += dt;
    const st = round.state;
    const reduced = this.host.quality.reducedMotion;
    if (this.catchAnim) this.updateCatch(dt);
    if (this.timeline) this.updateTimeline(dt);
    for (const l of this.libs) {
      const m = st.librarians[l.id];
      if (m) l.update(dt, st, m, reduced);
      // Злится: пар из ушей.
      if (m && m.anger > 0 && this.clock - this.steamAt > 0.42) {
        this.steamAt = this.clock;
        this.juice.steam(l.earPoint(), -l.facing);
      }
    }
    this.hero.update(dt, this.mode === 'attract' ? null : st, reduced);
    this.hearing.update(dt, st, this.libs, reduced);
    this.aim.update(dt, st, round.aiming, round.aimCell, reduced);
    this.juice.update(dt);
    this.margins?.update(dt);
    const behind: WorldRect[] = [
      ...this.world.itemRects(),
      ...this.hearing.hintRects(),
      ...this.aim.hintRects(),
      this.hero.footRect(),
      ...this.libs.map((l) => l.footRect()),
    ];
    this.world.update(dt, behind, this.host.quality.goldGlint);
    this.scrollCamera();
  }

  private teardown(): void {
    this.detach();
    for (const fn of this.cleanups) fn();
    this.cleanups.length = 0;
  }

  /**
   * Тест читаемости слуха (8.4): застывшие кольца, управление видимостью элементов
   * и геометрия в CSS-пикселях панели мира.
   */
  hearingProbe(): {
    freeze: (on: boolean) => void;
    ring: (cell: Cell, kind: 'error' | 'squeak' | 'step' | 'book', radius: number) => void;
    show: (what: 'halo' | 'loud' | 'rings' | 'hands' | 'prints', on: boolean) => void;
    geometry: () => Record<string, unknown>;
  } {
    const h = this.hearing;
    return {
      freeze: (on) => {
        if (h) h.freeze = on;
      },
      ring: (cell, kind, radius) => h?.ring(cell, kind, radius),
      show: (what, on) => {
        if (h) h.show[what] = on;
      },
      geometry: () => {
        const layout = this.layout;
        const st = this.round?.state;
        if (!layout || !st || !this.mapper) return {};
        const m = st.librarians[0]!;
        const cellCss = (c: Cell): Point => this.worldToCss(this.mapper!.center(c));
        return {
          cell: layout.cell,
          board: layout.board,
          librarian: cellCss(m.cell),
          libView: this.libs[0] ? this.worldToCss({ x: this.libs[0].pos.x, y: this.libs[0].pos.y - (0.62 - 0.5) * CELL }) : null,
          hero: cellCss(st.hero.cell),
          target: m.target ? cellCss(m.target) : null,
          hearR: balance.hearR,
          loudR: st.level.loudR,
          mapperOrient: this.mapper.orient,
        };
      },
    };
  }

  /** Для отладки и тестов: что сейчас на экране. */
  debugInfo(): Record<string, unknown> {
    return {
      mode: this.mode,
      banners: this.juice?.bannerCount ?? 0,
      rings: this.hearing?.ringCount ?? 0,
      shelves: this.world?.shelfAlphas() ?? [],
      orient: this.mapper?.orient ?? null,
      catching: !!this.catchAnim,
      sameCellHero: this.round && this.hero ? sameCell(this.round.state.hero.cell, this.round.state.hero.cell) : null,
    };
  }
}
