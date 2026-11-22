/**
 * Герой — тот же искатель серии в виде фигурки с полей: зелёная шапочка, оранжевый шарф,
 * кремовая туника, сливовые штаны, сапоги (план, 7.5.10). Смотрит в сторону цели.
 */
import Phaser from 'phaser';
import type { ArtFactory } from '../art/ArtFactory';
import { ANCHOR, CELL, DEPTH, TEX } from '../art/manifest';
import { balance } from '../config/balance';
import type { Cell, GameState } from '../core';
import { inEarshot, inHalo, nextStep } from '../core';
import type { Mapper, Point } from './orientation';
import { approach, approachAngle, part, smooth } from './rig';

/** Особые сцены героя. */
export type HeroScript = 'none' | 'caught' | 'cheer' | 'sneakIn';

/** Палец у губ: рука вперёд и вверх, к лицу (герой смотрит вправо). */
const ARM_HUSH = -2.05;
const ARM_UP = 3.0;

export class HeroView {
  readonly box: Phaser.GameObjects.Container;
  private readonly legA: Phaser.GameObjects.Image;
  private readonly legB: Phaser.GameObjects.Image;
  private readonly scarf: Phaser.GameObjects.Image;
  private readonly body: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly headPuff: Phaser.GameObjects.Image;
  private readonly arm: Phaser.GameObjects.Image;
  private readonly carried: Phaser.GameObjects.Image;

  pos: Point = { x: 0, y: 0 };
  facing = 1;
  script: HeroScript = 'none';
  /** Сцена держит фигуру: положение задаётся снаружи. */
  held = false;

  private from: Point = { x: 0, y: 0 };
  private to: Point = { x: 0, y: 0 };
  /** Прогресс шага 0..1; 1 — стоит. */
  private stepT = 1;
  private placed = false;
  private phase = 0;
  private armRot = 0.1;
  private puff = 0;
  private throwT = 1;
  private holdT = 0;
  private squash = 0;
  private scriptTime = 0;
  private tilt = 0;
  private armLen = 1;

  constructor(
    scene: Phaser.Scene,
    private readonly art: ArtFactory,
    private readonly mapper: Mapper,
  ) {
    this.box = scene.add.container(0, 0);
    const p = (spec: Parameters<typeof part>[3], x: number, y: number): Phaser.GameObjects.Image =>
      part(scene, this.box, art, spec, x, y);
    this.legA = p(TEX.heroLeg, -0.09, -0.31);
    this.legB = p(TEX.heroLeg, 0.09, -0.31);
    this.scarf = p(TEX.heroScarf, -0.1, -0.7);
    this.scarf.setScale(-art.scale, art.scale);
    this.body = p(TEX.heroBody, 0, -0.26);
    this.head = p(TEX.heroHead, 0.02, -0.7);
    this.headPuff = p(TEX.heroHeadPuff, 0.02, -0.7);
    this.headPuff.setAlpha(0);
    this.arm = p(TEX.heroArm, -0.07, -0.66);
    this.carried = new Phaser.GameObjects.Image(scene, 0, 0, TEX.page0.key);
    this.carried.setOrigin(0.5, 0.5).setScale(art.scale * 0.8).setVisible(false);
    this.box.add(this.carried);
  }

  private cellPoint(cell: Cell): Point {
    return this.mapper.at(cell, 0.5, ANCHOR.feet);
  }

  /** Ставит героя на клетку без анимации. */
  snapTo(cell: Cell): void {
    this.pos = this.cellPoint(cell);
    this.from = { ...this.pos };
    this.to = { ...this.pos };
    this.stepT = 1;
    this.placed = true;
  }

  /** Шаг на цыпочках — преувеличенно крадущийся, 200 мс. */
  stepTo(cell: Cell): void {
    const target = this.cellPoint(cell);
    this.from = { ...this.pos };
    this.to = target;
    this.stepT = 0;
    if (Math.abs(target.x - this.pos.x) > 1) this.facing = target.x > this.pos.x ? 1 : -1;
  }

  /** Бросок — словарь навесом через стеллажи, 250 мс. */
  throwAt(target: Point): void {
    this.throwT = 0;
    if (Math.abs(target.x - this.pos.x) > 1) this.facing = target.x > this.pos.x ? 1 : -1;
  }

  /** Взял лист — поднимает его над головой. */
  holdUp(textureKey: string, seconds = 0.7): void {
    this.carried.setTexture(textureKey);
    this.holdT = seconds;
  }

  setScript(script: HeroScript): void {
    if (this.script === script) return;
    this.script = script;
    this.scriptTime = 0;
  }

  headTop(): Point {
    return { x: this.pos.x, y: this.pos.y - 1.2 * CELL };
  }

  /** Шиворот: за него хватает библиотекарь. */
  collarPoint(): Point {
    return { x: this.pos.x, y: this.pos.y - 0.74 * CELL };
  }

  handPoint(): Point {
    return { x: this.pos.x + this.facing * 0.2 * CELL, y: this.pos.y - 0.62 * CELL };
  }

  footRect(): { x: number; y: number; w: number; h: number } {
    return { x: this.pos.x - CELL * 0.26, y: this.pos.y - CELL * 0.08, w: CELL * 0.52, h: CELL * 0.16 };
  }

  get stepping(): boolean {
    return this.stepT < 1;
  }

  update(dt: number, state: GameState | null, reduced: boolean): void {
    this.phase += dt;
    this.scriptTime += dt;
    if (!this.placed && state) this.snapTo(state.hero.cell);

    let hop = 0;
    let stride = 0;
    if (this.stepT < 1 && !this.held) {
      this.stepT = Math.min(1, this.stepT + dt / (balance.view.heroStepMs / 1000));
      const t = smooth(this.stepT);
      this.pos = {
        x: this.from.x + (this.to.x - this.from.x) * t,
        y: this.from.y + (this.to.y - this.from.y) * t,
      };
      hop = reduced ? 0 : Math.sin(this.stepT * Math.PI) * 0.07;
      stride = Math.sin(this.stepT * Math.PI) * 0.75;
      if (this.stepT >= 1) this.squash = reduced ? 0 : 1;
    }

    // Куда смотреть стоя: в сторону цели.
    if (state && this.stepT >= 1 && this.script === 'none' && this.throwT >= 1) {
      const it = state.hero.intent;
      const aimCell = it.kind === 'move' ? (nextStep(state) ?? it.cell) : it.kind === 'throw' ? it.cell : null;
      if (aimCell) {
        const tp = this.mapper.center(aimCell);
        if (Math.abs(tp.x - this.pos.x) > CELL * 0.3) this.facing = tp.x > this.pos.x ? 1 : -1;
      }
    }

    this.throwT = Math.min(1, this.throwT + dt / (balance.view.heroThrowMs / 1000));
    this.holdT = Math.max(0, this.holdT - dt);
    this.squash = Math.max(0, this.squash - dt * 6);

    // Поза по обстановке.
    const playing = !!state && state.status === 'playing';
    const hush = playing && state.hints.loudRing && inEarshot(state);
    const breath = playing && inHalo(state, state.hero.cell);
    let arm = 0.12 + (reduced ? 0 : Math.sin(this.phase * 1.7) * 0.03);
    let tilt = 0;
    let bodyDy = reduced ? 0 : Math.sin(this.phase * 2.1) * 0.006;
    let legA = stride;
    let legB = -stride;
    if (hush) arm = ARM_HUSH;
    if (this.holdT > 0) arm = ARM_UP;
    if (this.throwT < 1) {
      // Замах назад и бросок вперёд.
      const t = this.throwT;
      arm = t < 0.35 ? 2.2 + (t / 0.35) * 0.9 : 3.1 - smooth((t - 0.35) / 0.65) * 4.4;
      tilt = t < 0.35 ? -0.12 : 0.16 * (1 - t);
    }
    if (this.stepT < 1) tilt += 0.1;

    if (this.script === 'caught') {
      // Болтается за шиворот, дрыгая ногами.
      const kick = reduced ? 0.4 : Math.sin(this.scriptTime * 22);
      legA = kick * 0.9;
      legB = -kick * 0.9;
      arm = 1.2 + (reduced ? 0 : Math.sin(this.scriptTime * 17) * 0.5);
      tilt = reduced ? 0.1 : Math.sin(this.scriptTime * 9) * 0.16;
    } else if (this.script === 'cheer') {
      // Подпрыгивает снаружи.
      const t = this.scriptTime;
      hop = reduced ? 0 : Math.abs(Math.sin(t * 6.5)) * 0.22;
      arm = ARM_UP;
      legA = Math.sin(t * 13) * 0.3;
      legB = -legA;
    } else if (this.script === 'sneakIn') {
      const t = this.scriptTime * 9;
      legA = Math.sin(t) * 0.7;
      legB = -legA;
      tilt = 0.12;
      hop = reduced ? 0 : Math.abs(Math.sin(t)) * 0.04;
    }

    this.armRot = approachAngle(this.armRot, arm, dt, this.throwT < 1 ? 0.025 : 0.09);
    // В жесте «тсс» рука согнута — укорачиваем её, чтобы палец пришёлся к губам.
    const hushing = hush && this.holdT <= 0 && this.throwT >= 1 && this.script === 'none';
    this.armLen = approach(this.armLen, hushing ? 0.64 : 1, dt, 0.08);
    this.puff = approach(this.puff, breath ? 1 : 0, dt, 0.12);
    this.tilt = approach(this.tilt, tilt, dt, 0.07);

    const k = this.art.scale;
    const sq = this.squash * 0.06;
    this.legA.setRotation(legA);
    this.legB.setRotation(legB);
    this.body.setPosition(0, (-0.26 + bodyDy + sq * 0.5) * CELL);
    this.body.setRotation(this.tilt);
    this.body.setScale(k * (1 + sq), k * (1 - sq));
    const shake = breath && !reduced ? Math.sin(this.phase * 31) * 0.006 : 0;
    const headX = 0.02 + this.tilt * 0.42 + shake;
    const headY = -0.7 + bodyDy + sq * 0.9;
    for (const h of [this.head, this.headPuff]) {
      h.setPosition(headX * CELL, headY * CELL);
      h.setRotation(this.tilt * 0.7 + (hush ? -0.05 : 0));
    }
    this.headPuff.setAlpha(this.puff);
    const scarfWave = reduced ? 0 : Math.sin(this.phase * 3.1) * 0.12 + Math.sin(this.phase * 7.3) * 0.05;
    this.scarf.setPosition((headX - 0.12) * CELL, (headY + 0.02) * CELL);
    this.scarf.setRotation(-0.12 + scarfWave + (this.stepT < 1 ? -0.35 : 0) + this.tilt * 0.5);
    const shoulderX = -0.07 + this.tilt * 0.36;
    const shoulderY = -0.66 + bodyDy + sq * 0.8;
    this.arm.setPosition(shoulderX * CELL, shoulderY * CELL);
    this.arm.setRotation(this.armRot);
    this.arm.setScale(k, k * this.armLen);

    this.carried.setVisible(this.holdT > 0);
    if (this.holdT > 0) {
      const len = TEX.heroArm.h * 0.9;
      const lift = reduced ? 0 : Math.sin(this.phase * 9) * 0.01;
      this.carried.setPosition(
        (shoulderX - Math.sin(this.armRot) * len) * CELL,
        (shoulderY + Math.cos(this.armRot) * len - 0.16 + lift) * CELL,
      );
      this.carried.setRotation(reduced ? 0 : Math.sin(this.phase * 6) * 0.1);
    }

    this.box.setPosition(this.pos.x, this.pos.y - hop * CELL);
    this.box.setScale(this.facing, 1);
    this.box.setDepth(DEPTH.objects + this.pos.y);
  }

  /** Сцена ставит фигуру сама (интро, поимка, победа). */
  place(point: Point, depthBoost = 0): void {
    this.pos = { ...point };
    this.from = { ...point };
    this.to = { ...point };
    this.stepT = 1;
    this.placed = true;
    this.box.setPosition(point.x, point.y);
    this.box.setDepth(DEPTH.objects + point.y + depthBoost);
  }

  setRotation(rotation: number): void {
    this.box.setRotation(rotation);
  }

  setVisible(visible: boolean): void {
    this.box.setVisible(visible);
  }

  setAlpha(alpha: number): void {
    this.box.setAlpha(alpha);
  }

  destroy(): void {
    this.box.destroy(true);
  }
}
