/**
 * Слух на экране (план, раздел 8): нимбы, кольца громкого слуха, кольца звука,
 * маникулы, отпечатки тапочек, след героя. Всё берётся из тех же функций, что и логика
 * (hints.ts), поэтому подсказки никогда не врут.
 */
import Phaser from 'phaser';
import type { ArtFactory } from '../art/ArtFactory';
import type { TexSpec } from '../art/manifest';
import { ANCHOR, CELL, DEPTH, TEX } from '../art/manifest';
import { balance } from '../config/balance';
import { hex, palette } from '../config/palette';
import type { Cell, GameState, SoundKind } from '../core';
import { isListening, manicules, routeHint, slipperPrints, stepHint } from '../core';
import { NIB_ANGLE } from '../shared/manuscriptKit';
import type { LibrarianView } from './LibrarianView';
import type { Mapper, Point } from './orientation';
import { approach } from './rig';
import type { WorldRect } from './WorldView';

interface Ring {
  x: number;
  y: number;
  /** Конечный радиус, единицы мира: ровно тот, на котором звук слышно (8.3). */
  radius: number;
  color: number;
  age: number;
  width: number;
}

interface HaloSprite {
  image: Phaser.GameObjects.Image;
  on: number;
}

const RING_HOLD_MS = 260;
const RING_FADE_MS = 280;
const RING_SEGMENTS = 72;

export class HearingView {
  private readonly halos: HaloSprite[] = [];
  private readonly loud: Phaser.GameObjects.Image[] = [];
  private readonly hands: Phaser.GameObjects.Image[] = [];
  private readonly prints: Phaser.GameObjects.Image[][] = [];
  private readonly foot: Phaser.GameObjects.Image;
  private readonly footRed: Phaser.GameObjects.Image;
  private readonly routeEnd: Phaser.GameObjects.Image;
  private readonly dots: Phaser.GameObjects.Image[] = [];
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly rings: Ring[] = [];
  private readonly rects: WorldRect[] = [];
  private time = 0;
  private handTone: string[] = [];
  /** Тест читаемости: кольца звука застывают на полном радиусе. */
  freeze = false;
  /** Тест читаемости: что показывать. */
  readonly show = { halo: true, loud: true, rings: true, hands: true, prints: true };

  constructor(
    scene: Phaser.Scene,
    private readonly art: ArtFactory,
    private readonly mapper: Mapper,
    state: GameState,
  ) {
    const k = art.scale;
    const img = (spec: TexSpec, depth: number): Phaser.GameObjects.Image =>
      scene.add
        .image(0, 0, spec.key)
        .setOrigin(spec.ox, spec.oy)
        .setScale(k)
        .setDepth(depth)
        .setVisible(false);

    const loudKey = art.loudRing(state.level.loudR);
    for (let i = 0; i < state.librarians.length; i++) {
      this.halos.push({ image: img(TEX.halo, DEPTH.onFloor + 1), on: 0 });
      this.loud.push(
        scene.add
          .image(0, 0, loudKey)
          .setOrigin(0.5, 0.5)
          .setScale(k)
          .setDepth(DEPTH.onFloor + 2)
          .setVisible(false),
      );
      this.hands.push(img(TEX.manInk, DEPTH.top + 10 + i));
      this.handTone.push('ink');
      const row: Phaser.GameObjects.Image[] = [];
      for (let j = 0; j < balance.view.slipperPrints; j++)
        row.push(img(TEX.slipper, DEPTH.onFloor + 4));
      this.prints.push(row);
    }
    this.foot = img(TEX.footInk, DEPTH.onFloor + 6);
    this.footRed = img(TEX.footAlarm, DEPTH.onFloor + 6);
    this.routeEnd = img(TEX.routeEnd, DEPTH.onFloor + 5);
    for (let i = 0; i < 24; i++) this.dots.push(img(TEX.routeDot, DEPTH.onFloor + 5));
    this.gfx = scene.add.graphics().setDepth(DEPTH.effects);
  }

  /**
   * Кольцо звука: расходится от клетки звука ровно до радиуса, на котором этот звук
   * слышно. Дошло до библиотекаря — услышал; не дошло — нет (8.3).
   */
  ring(cell: Cell, kind: SoundKind, radiusCells: number): void {
    const p = this.mapper.center(cell);
    let radius = radiusCells * CELL;
    if (!Number.isFinite(radius)) {
      // Словарь слышно везде: кольцо идёт до краёв библиотеки.
      const corners = [
        [0, 0],
        [this.mapper.width, 0],
        [0, this.mapper.height],
        [this.mapper.width, this.mapper.height],
      ] as const;
      radius = Math.max(...corners.map(([x, y]) => Math.hypot(x - p.x, y - p.y)));
    }
    const color =
      kind === 'book'
        ? hex(palette.derived.ultramarine)
        : kind === 'step'
          ? hex(palette.derived.goldInk)
          : hex(palette.derived.alarmInk);
    this.rings.push({
      x: p.x,
      y: p.y,
      radius,
      color,
      age: 0,
      width: kind === 'book' ? 0.07 : 0.095,
    });
    // Колец звука — не больше 6 одновременно (13.6.1).
    while (this.rings.length > balance.view.maxSoundRings) this.rings.shift();
  }

  /** Сколько колец звука сейчас на экране. */
  get ringCount(): number {
    return this.rings.length;
  }

  /** Прямоугольники подсказок на полу — они могут оказаться за стеллажом. */
  hintRects(): readonly WorldRect[] {
    return this.rects;
  }

  private rectOf(image: Phaser.GameObjects.Image): void {
    const w = image.displayWidth * 0.7;
    const h = image.displayHeight * 0.7;
    this.rects.push({ x: image.x - w / 2, y: image.y - h / 2, w, h });
  }

  /** Кольцо пером: толщина зависит от направления штриха. */
  private nibRing(
    x: number,
    y: number,
    r: number,
    wMin: number,
    wMax: number,
    color: number,
    alpha: number,
  ): void {
    if (r <= wMax || alpha <= 0.01) return;
    const outer: Phaser.Math.Vector2[] = [];
    const inner: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= RING_SEGMENTS; i++) {
      const a = (i / RING_SEGMENTS) * Math.PI * 2;
      // Направление штриха — касательная к окружности.
      const w = wMin + (wMax - wMin) * Math.abs(Math.sin(a + Math.PI / 2 - NIB_ANGLE));
      const c = Math.cos(a);
      const s = Math.sin(a);
      outer.push(new Phaser.Math.Vector2(x + c * (r + w / 2), y + s * (r + w / 2)));
      inner.push(new Phaser.Math.Vector2(x + c * (r - w / 2), y + s * (r - w / 2)));
    }
    this.gfx.fillStyle(color, alpha);
    this.gfx.fillPoints(outer.concat(inner.reverse()), true, true);
  }

  update(dt: number, state: GameState, views: readonly LibrarianView[], reduced: boolean): void {
    this.time += dt;
    this.rects.length = 0;
    const k = this.art.scale;
    const playing = state.status === 'playing' || state.status === 'catchScene';

    // Нимбы: распускаются за 200 мс, гаснут за 150 мс.
    for (let i = 0; i < state.librarians.length; i++) {
      const m = state.librarians[i]!;
      const halo = this.halos[i]!;
      const want = playing && isListening(m) ? 1 : 0;
      const tau = (want ? balance.view.haloInMs : balance.view.haloOutMs) / 1000 / 3;
      halo.on = reduced ? want : approach(halo.on, want, dt, tau);
      if (halo.on < 0.01 || !this.show.halo) {
        halo.image.setVisible(false);
      } else {
        const c = this.mapper.center(m.cell);
        const pulse = reduced ? 1 : 1 + Math.sin(this.time * 2.4 + i) * 0.006;
        halo.image
          .setVisible(true)
          .setPosition(c.x, c.y)
          .setAlpha(Math.min(1, halo.on * 1.15))
          .setScale(k * (0.72 + 0.28 * halo.on) * pulse);
      }

      // Кольцо громкого слуха: тонкий золотой пунктир радиусом loudR.
      const ring = this.loud[i]!;
      const view = views[i];
      if (state.hints.loudRing && view && playing && this.show.loud) {
        ring
          .setVisible(true)
          .setPosition(view.pos.x, view.pos.y - (ANCHOR.feet - 0.5) * CELL)
          .setRotation(reduced ? 0 : this.time * 0.02);
      } else {
        ring.setVisible(false);
      }

      // Отпечатки тапочек: следующие клетки его пути, бледнее к концу.
      const row = this.prints[i]!;
      const path = playing ? slipperPrints(state, m) : [];
      let prev: Point = this.mapper.center(m.cell);
      for (let j = 0; j < row.length; j++) {
        const image = row[j]!;
        const cell = path[j];
        if (!cell) {
          image.setVisible(false);
          continue;
        }
        const c = this.mapper.at(cell, 0.5, 0.56);
        const cc = this.mapper.center(cell);
        image
          .setVisible(true)
          .setPosition(c.x, c.y)
          .setRotation(Math.atan2(cc.y - prev.y, cc.x - prev.x) + Math.PI / 2)
          .setAlpha(0.82 - j * 0.24);
        prev = cc;
        this.rectOf(image);
      }
    }

    // Маникула над клеткой, куда идёт библиотекарь. Видна всегда.
    const hands = playing ? manicules(state) : [];
    for (let i = 0; i < this.hands.length; i++) {
      const image = this.hands[i]!;
      const hint = hands.find((h) => h.m === i);
      if (!hint || !this.show.hands) {
        image.setVisible(false);
        continue;
      }
      if (this.handTone[i] !== hint.tone) {
        this.handTone[i] = hint.tone;
        image.setTexture(
          hint.tone === 'ink'
            ? TEX.manInk.key
            : hint.tone === 'gold'
              ? TEX.manGold.key
              : TEX.manAlarm.key,
        );
      }
      const v = this.mapper.toView(hint.cell);
      // Рука тянется снизу-сбоку и указывает на нижний угол клетки: героя не закрывает.
      const fromRight = v.x <= 1;
      const bob = reduced ? 0 : Math.sin(this.time * 4.2 + i * 1.7) * 0.035;
      const dir = fromRight ? -1 : 1;
      const tipX = (v.x + 0.5 - dir * 0.2 + dir * bob) * CELL;
      const tipY = (v.y + 0.74 - bob) * CELL;
      const grow = 1 + hint.anger * 0.16;
      image
        .setVisible(true)
        .setOrigin(fromRight ? 1 - TEX.manInk.ox : TEX.manInk.ox, TEX.manInk.oy)
        .setFlipX(fromRight)
        .setPosition(tipX, tipY)
        .setRotation(dir * -0.62)
        .setScale(k * 0.94 * grow);
    }

    // След следующего шага героя и тихий пунктир маршрута.
    const step = playing && state.status === 'playing' ? stepHint(state) : null;
    this.foot.setVisible(false);
    this.footRed.setVisible(false);
    this.routeEnd.setVisible(false);
    let used = 0;
    if (step) {
      const from = this.mapper.center(state.hero.cell);
      const c = this.mapper.at(step.cell, 0.5, 0.56);
      const cc = this.mapper.center(step.cell);
      const image = step.red ? this.footRed : this.foot;
      const pulse = step.red && !reduced ? 1 + Math.sin(this.time * 7) * 0.06 : 1;
      image
        .setVisible(true)
        .setPosition(c.x, c.y)
        .setRotation(Math.atan2(cc.y - from.y, cc.x - from.x) + Math.PI / 2)
        .setScale(k * pulse);
      this.rectOf(image);
      const route = routeHint(state);
      let prev = cc;
      for (let j = 1; j < route.length && used < this.dots.length; j++) {
        const cur = this.mapper.center(route[j]!);
        const last = j === route.length - 1;
        // Две точки на клетку пути; над последней клеткой — крестик цели.
        for (const f of last ? [0.5] : [0.5, 1]) {
          const dot = this.dots[used++];
          if (!dot) break;
          dot
            .setVisible(true)
            .setPosition(prev.x + (cur.x - prev.x) * f, prev.y + (cur.y - prev.y) * f)
            .setAlpha(0.5);
        }
        if (last) this.routeEnd.setVisible(true).setPosition(cur.x, cur.y).setAlpha(0.7);
        prev = cur;
      }
    }
    for (let j = used; j < this.dots.length; j++) this.dots[j]!.setVisible(false);

    // Кольца звука.
    this.gfx.clear();
    const grow = balance.view.soundRingMs;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i]!;
      ring.age += dt * 1000;
      if (this.freeze) ring.age = Math.min(ring.age, grow + 1);
      if (!this.show.rings) continue;
      const total = grow + RING_HOLD_MS + RING_FADE_MS;
      if (ring.age >= total) {
        this.rings.splice(i, 1);
        continue;
      }
      const t = Math.min(1, ring.age / grow);
      const ease = 1 - Math.pow(1 - t, 2.2);
      const fade =
        ring.age <= grow + RING_HOLD_MS ? 1 : 1 - (ring.age - grow - RING_HOLD_MS) / RING_FADE_MS;
      const wMax = ring.width * CELL;
      const wMin = wMax * 0.7;
      const r = reduced ? ring.radius : ring.radius * ease;
      this.nibRing(ring.x, ring.y, r, wMin, wMax, ring.color, fade);
      // Два догоняющих кольца потоньше.
      for (let n = 1; n <= 2; n++) {
        const lag = r - n * CELL * 0.34 * (0.4 + 0.6 * ease);
        this.nibRing(
          ring.x,
          ring.y,
          lag,
          wMin * 0.7,
          wMax * 0.62,
          ring.color,
          fade * (0.55 - n * 0.17),
        );
      }
    }
  }

  destroy(): void {
    for (const h of this.halos) h.image.destroy();
    for (const image of [...this.loud, ...this.hands, ...this.prints.flat(), ...this.dots])
      image.destroy();
    this.foot.destroy();
    this.footRed.destroy();
    this.routeEnd.destroy();
    this.gfx.destroy();
    this.rings.length = 0;
  }
}
