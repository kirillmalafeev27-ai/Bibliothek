/**
 * Библиотекарь: высокий, худой, сутулый; длинный нос, огромные уши, крошечные очки,
 * связка ключей на поясе, тапочки (план, 7.5.9). Ворчливый и смешной, а не страшный.
 *
 * Положение на экране честное: фигура всегда находится внутри своей логической клетки.
 * Он «входит» в клетку, когда пересекает её границу, поэтому в начале шага стоит на
 * границе клеток, к середине шага — в центре, к концу — у следующей границы.
 */
import Phaser from 'phaser';
import type { ArtFactory } from '../art/ArtFactory';
import { ANCHOR, CELL, DEPTH, TEX } from '../art/manifest';
import type { Cell, GameState, Librarian } from '../core';
import { librarianPath } from '../core';
import type { Mapper, Point } from './orientation';
import { approach, approachAngle, part, smooth } from './rig';

/** Особые сцены, в которых фигурой управляет постановка, а не состояние. */
export type LibrarianScript = 'none' | 'grab' | 'stamp' | 'sleep';

const ARM_LISTEN = 2.9;
const ARM_RUN = -1.3;

export class LibrarianView {
  readonly box: Phaser.GameObjects.Container;
  private readonly slipperA: Phaser.GameObjects.Image;
  private readonly slipperB: Phaser.GameObjects.Image;
  private readonly hem: Phaser.GameObjects.Image;
  private readonly robe: Phaser.GameObjects.Image;
  private readonly keys: Phaser.GameObjects.Image;
  private readonly earFar: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly headAngry: Phaser.GameObjects.Image;
  private readonly headSleep: Phaser.GameObjects.Image;
  private readonly earNear: Phaser.GameObjects.Image;
  private readonly arm: Phaser.GameObjects.Image;
  private readonly stamp: Phaser.GameObjects.Image;

  /** Где он нарисован (ступни), единицы мира. */
  pos: Point = { x: 0, y: 0 };
  /** Куда смотрит на экране: 1 — вправо, −1 — влево. */
  facing = 1;
  script: LibrarianScript = 'none';
  /** Сцена держит фигуру: положение задаётся снаружи. */
  held = false;

  private placed = false;
  private phase = 0;
  private armRot = 0.1;
  private headRot = 0.05;
  private lean = 0.04;
  private earPerk = 0;
  private angry = 0;
  private sniff = 0;
  private sniffLeft = 0;
  private jerk = 0;
  private scriptTime = 0;
  private gait = 0;
  private keySwing = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly art: ArtFactory,
    private readonly mapper: Mapper,
    readonly id: number,
  ) {
    this.box = scene.add.container(0, 0);
    const p = (spec: Parameters<typeof part>[3], x: number, y: number): Phaser.GameObjects.Image =>
      part(scene, this.box, art, spec, x, y);
    this.hem = p(TEX.libHem, 0, -0.07);
    this.slipperA = p(TEX.libSlipper, -0.13, -0.01);
    this.slipperB = p(TEX.libSlipper, 0.13, -0.01);
    this.robe = p(TEX.libRobe, 0, 0);
    this.keys = p(TEX.libKeys, 0.15, -0.5);
    this.earFar = p(TEX.libEar, 0.0, -1.3);
    this.earFar.setScale(art.scale * 0.82);
    this.head = p(TEX.libHead, 0.07, -0.98);
    this.headAngry = p(TEX.libHeadAngry, 0.07, -0.98);
    this.headAngry.setAlpha(0);
    this.headSleep = p(TEX.libHeadSleep, 0.07, -0.98);
    this.headSleep.setVisible(false);
    this.earNear = p(TEX.libEar, -0.13, -1.22);
    this.arm = p(TEX.libArm, -0.05, -0.9);
    this.stamp = p(TEX.libStamp, 0, 0);
    this.stamp.setVisible(false);
  }

  /** Точка мира, где стоит фигура по логике: внутри своей клетки. */
  private logicalPoint(state: GameState, m: Librarian): Point {
    const fx = 0.5;
    const fy = ANCHOR.feet;
    const here = this.mapper.at(m.cell, fx, fy);
    if (m.stepDur <= 0 || (m.mode !== 'walk' && m.mode !== 'run')) return here;
    const u = Phaser.Math.Clamp(1 - m.timer / m.stepDur, 0, 1);
    const next: Cell | undefined = librarianPath(state, m, 1)[0];
    const mid = (a: Cell, b: Cell): Point => this.mapper.lerp(a, b, 0.5, fx, fy);
    if (m.from) {
      if (u < 0.5) {
        const edge = mid(m.from, m.cell);
        const t = u / 0.5;
        return { x: edge.x + (here.x - edge.x) * t, y: edge.y + (here.y - edge.y) * t };
      }
      if (!next) return here;
      const edge = mid(m.cell, next);
      const t = (u - 0.5) / 0.5;
      return { x: here.x + (edge.x - here.x) * t, y: here.y + (edge.y - here.y) * t };
    }
    // Начал с места: полклетки до границы — за весь шаг.
    if (!next) return here;
    const edge = mid(m.cell, next);
    const t = smooth(u);
    return { x: here.x + (edge.x - here.x) * t, y: here.y + (edge.y - here.y) * t };
  }

  /** «Schnupper…» — нос вверх, ноздри раздуваются. */
  startSniff(): void {
    this.sniffLeft = 1.4;
  }

  /** «Wer da?» — голова дёргается к звуку. */
  startJerk(): void {
    this.jerk = 1;
  }

  setScript(script: LibrarianScript): void {
    if (this.script === script) return;
    this.script = script;
    this.scriptTime = 0;
    this.stamp.setVisible(script === 'stamp');
    this.headSleep.setVisible(script === 'sleep');
    this.head.setVisible(script !== 'sleep');
  }

  /** Точка у уха — для вспышки «услышал» и пара злости. */
  earPoint(): Point {
    return { x: this.pos.x - this.facing * 0.13 * CELL, y: this.pos.y - 1.34 * CELL };
  }

  /** Точка над головой — для бандеролей. */
  headTop(): Point {
    return { x: this.pos.x, y: this.pos.y - 1.62 * CELL };
  }

  /** Рука, которой он хватает героя. */
  handPoint(): Point {
    return { x: this.pos.x + this.facing * 0.42 * CELL, y: this.pos.y - 0.86 * CELL };
  }

  /** Область у ступней — она может оказаться за стеллажом. */
  footRect(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.pos.x - CELL * 0.3,
      y: this.pos.y - CELL * 0.1,
      w: CELL * 0.6,
      h: CELL * 0.18,
    };
  }

  update(dt: number, state: GameState, m: Librarian, reduced: boolean): void {
    const target = this.logicalPoint(state, m);
    if (!this.placed) {
      this.pos = { ...target };
      this.placed = true;
    } else if (!this.held) {
      const tau = 0.09;
      const px = approach(this.pos.x, target.x, dt, tau);
      const py = approach(this.pos.y, target.y, dt, tau);
      const moved = Math.hypot(px - this.pos.x, py - this.pos.y);
      if (Math.abs(px - this.pos.x) > 0.02) this.facing = px > this.pos.x ? 1 : -1;
      this.pos = { x: px, y: py };
      this.gait += (moved / CELL) * Math.PI * 4.2;
    }

    // Куда смотреть стоя: на цель.
    const moving = m.stepDur > 0 && (m.mode === 'walk' || m.mode === 'run');
    if (!moving && m.target && this.script === 'none') {
      const tp = this.mapper.center(m.target);
      if (Math.abs(tp.x - this.pos.x) > CELL * 0.3) this.facing = tp.x > this.pos.x ? 1 : -1;
    }

    this.phase += dt;
    this.scriptTime += dt;
    this.sniffLeft = Math.max(0, this.sniffLeft - dt);
    this.jerk = Math.max(0, this.jerk - dt * 2.4);
    this.sniff = approach(this.sniff, this.sniffLeft > 0 ? 1 : 0, dt, 0.12);
    this.angry = approach(
      this.angry,
      Math.min(1, m.anger / 2 + (m.anger > 0 ? 0.25 : 0)),
      dt,
      0.25,
    );

    // Целевая поза по состоянию.
    let arm = 0.12;
    let head = 0.06;
    let lean = 0.05;
    let perk = 0;
    const running = m.mode === 'run';
    switch (m.mode) {
      case 'listen':
      case 'search':
        arm = ARM_LISTEN;
        head = m.mode === 'search' && !reduced ? Math.sin(this.phase * 1.7) * 0.22 : -0.1;
        lean = 0;
        perk = 1;
        break;
      case 'alert':
        arm = 1.5;
        head = -0.16;
        lean = -0.04;
        perk = 1;
        break;
      case 'run':
        arm = ARM_RUN;
        head = 0.1;
        lean = 0.2 + this.angry * 0.06;
        perk = 0.4;
        break;
      case 'file':
        arm = 0.3;
        head = 0.16;
        lean = 0.08;
        break;
      default:
        break;
    }
    if (this.sniff > 0.02) head = head * (1 - this.sniff) + -0.42 * this.sniff;
    head -= this.jerk * 0.3;

    let bodyY = 0;
    if (this.script === 'stamp') {
      // Подшивает билет: штамп, ящик картотеки.
      const cycle = (this.scriptTime * 1.5) % 1;
      const stampDown = cycle < 0.5 ? smooth(cycle / 0.5) : 1 - smooth((cycle - 0.5) / 0.5);
      arm = -0.5 + stampDown * 0.9;
      head = 0.2;
      lean = 0.1;
    } else if (this.script === 'sleep') {
      arm = 0.25;
      head = 0.34 + (reduced ? 0 : Math.sin(this.phase * 1.3) * 0.03);
      lean = 0.16;
      perk = 0;
      bodyY = reduced ? 0 : Math.sin(this.phase * 1.3) * 0.012;
    } else if (this.script === 'grab') {
      arm = -1.1;
      head = 0.02;
      lean = 0.1;
      perk = 0.6;
    }

    this.armRot = approachAngle(this.armRot, arm, dt, 0.11);
    this.headRot = approach(this.headRot, head, dt, 0.1);
    this.lean = approach(this.lean, lean, dt, 0.14);
    this.earPerk = approach(this.earPerk, perk, dt, 0.09);

    // Шарканье: тапочки по очереди, ключи покачиваются, подол волнуется.
    const stride = reduced ? 0 : Math.sin(this.gait);
    const amp = running ? 0.085 : 0.05;
    const swing = moving && !reduced ? 1 : 0;
    this.keySwing = approach(this.keySwing, swing * (running ? 0.5 : 0.3), dt, 0.2);
    const k = this.art.scale;
    this.slipperA.x = (-0.13 + stride * amp) * CELL;
    this.slipperB.x = (0.13 - stride * amp) * CELL;
    this.slipperA.y = (-0.01 - Math.max(0, stride) * 0.02) * CELL;
    this.slipperB.y = (-0.01 - Math.max(0, -stride) * 0.02) * CELL;
    const hemWave = reduced ? 0 : Math.sin(this.phase * (running ? 9 : 2.6) + this.id);
    this.hem.setRotation(hemWave * (running ? 0.07 : 0.025));
    this.hem.setScale(k * (1 + hemWave * (running ? 0.05 : 0.02)), k);
    this.keys.setRotation(Math.sin(this.gait * 1.1 + 0.6) * this.keySwing);

    const upperRot = this.lean;
    this.robe.setRotation(upperRot * 0.5);
    this.robe.y = bodyY * CELL;
    const bob = moving && !reduced ? Math.abs(Math.sin(this.gait)) * 0.012 : 0;
    const neckX = 0.07 + upperRot * 0.5;
    const neckY = -0.98 + bodyY - bob + Math.abs(upperRot) * 0.06;
    for (const h of [this.head, this.headAngry, this.headSleep]) {
      h.setPosition(neckX * CELL, neckY * CELL);
      h.setRotation(this.headRot + upperRot * 0.4);
      h.setScale(k * (1 + this.sniff * 0.035 * (reduced ? 0 : Math.sin(this.phase * 16))));
    }
    this.headAngry.setAlpha(this.script === 'sleep' ? 0 : this.angry);

    // Уши поднимаются, когда он слушает.
    const earLift = this.earPerk;
    const twitch = reduced ? 0 : Math.sin(this.phase * 9 + this.id) * 0.03 * earLift;
    this.earNear.setPosition((neckX - 0.2) * CELL, (neckY - 0.24 - earLift * 0.03) * CELL);
    this.earNear.setRotation(this.headRot * 0.6 - 0.25 + earLift * 0.55 + twitch - this.jerk * 0.4);
    this.earNear.setScale(k * (1 + earLift * 0.14));
    this.earFar.setPosition((neckX - 0.07) * CELL, (neckY - 0.32 - earLift * 0.03) * CELL);
    this.earFar.setRotation(this.headRot * 0.6 - 0.05 + earLift * 0.3 - twitch);
    this.earFar.setScale(k * 0.82 * (1 + earLift * 0.12));

    const shoulderX = -0.05 + upperRot * 0.42;
    const shoulderY = -0.9 + bodyY - bob;
    const armSwing =
      moving && !reduced && this.script === 'none' && m.mode === 'walk'
        ? Math.sin(this.gait) * 0.14
        : 0;
    this.arm.setPosition(shoulderX * CELL, shoulderY * CELL);
    this.arm.setRotation(this.armRot + armSwing);
    if (this.stamp.visible) {
      const len = TEX.libArm.h * 0.86;
      const a = this.armRot;
      this.stamp.setPosition(
        (shoulderX - Math.sin(a) * len) * CELL,
        (shoulderY + Math.cos(a) * len) * CELL,
      );
      this.stamp.setRotation(a * 0.3);
    }

    this.box.setPosition(this.pos.x, this.pos.y);
    this.box.setScale(this.facing, 1);
    this.box.setDepth(DEPTH.objects + this.pos.y);
  }

  /** Сцена ставит фигуру сама (поимка, заставка). */
  place(point: Point): void {
    this.pos = { ...point };
    this.placed = true;
    this.box.setPosition(point.x, point.y);
    this.box.setDepth(DEPTH.objects + point.y);
  }

  setVisible(visible: boolean): void {
    this.box.setVisible(visible);
  }

  destroy(): void {
    this.box.destroy(true);
  }
}
