/**
 * Прицеливание (план, 2.8.6, 8.2): круг броска радиусом throwR вокруг героя и путь,
 * которым библиотекарь побежит к выбранной клетке; если путь проходит через героя
 * или вплотную к нему, он кармином.
 */
import Phaser from 'phaser';
import type { ArtFactory } from '../art/ArtFactory';
import type { TexSpec } from '../art/manifest';
import { CELL, DEPTH, TEX } from '../art/manifest';
import { balance } from '../config/balance';
import { hex, palette } from '../config/palette';
import type { Cell, GameState } from '../core';
import { checkThrow, sameCell, throwPreview, throwTargets } from '../core';
import { NIB_ANGLE } from '../shared/manuscriptKit';
import type { Mapper } from './orientation';
import { approach } from './rig';
import type { WorldRect } from './WorldView';

const DASHES = 46;

export class AimView {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly ok: Phaser.GameObjects.Image;
  private readonly bad: Phaser.GameObjects.Image;
  private readonly marks: Phaser.GameObjects.Image[] = [];
  private readonly pathInk: Phaser.GameObjects.Image[] = [];
  private readonly pathAlarm: Phaser.GameObjects.Image[] = [];
  private readonly rects: WorldRect[] = [];
  private show = 0;
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly art: ArtFactory,
    private readonly mapper: Mapper,
  ) {
    const k = art.scale;
    const img = (spec: TexSpec, depth: number): Phaser.GameObjects.Image =>
      scene.add
        .image(0, 0, spec.key)
        .setOrigin(spec.ox, spec.oy)
        .setScale(k)
        .setDepth(depth)
        .setVisible(false);
    this.gfx = scene.add.graphics().setDepth(DEPTH.top + 1);
    this.ok = img(TEX.aimOk, DEPTH.top + 4);
    this.bad = img(TEX.aimBad, DEPTH.top + 4);
    for (let i = 0; i < 70; i++) this.marks.push(img(TEX.aimDot, DEPTH.top + 2));
    for (let i = 0; i < 28; i++) {
      this.pathInk.push(img(TEX.pathInk, DEPTH.top + 3));
      this.pathAlarm.push(img(TEX.pathAlarm, DEPTH.top + 3));
    }
  }

  hintRects(): readonly WorldRect[] {
    return this.rects;
  }

  /** Штрих пунктира пером — дуга от a0 до a1. */
  private dash(
    x: number,
    y: number,
    r: number,
    a0: number,
    a1: number,
    wMin: number,
    wMax: number,
    color: number,
    alpha: number,
  ): void {
    const steps = 5;
    const outer: Phaser.Math.Vector2[] = [];
    const inner: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = a0 + (a1 - a0) * t;
      // Штрих сходит на нет к концам.
      const taper = 0.35 + 0.65 * Math.sin(t * Math.PI);
      const w = (wMin + (wMax - wMin) * Math.abs(Math.sin(a + Math.PI / 2 - NIB_ANGLE))) * taper;
      const c = Math.cos(a);
      const s = Math.sin(a);
      outer.push(new Phaser.Math.Vector2(x + c * (r + w / 2), y + s * (r + w / 2)));
      inner.push(new Phaser.Math.Vector2(x + c * (r - w / 2), y + s * (r - w / 2)));
    }
    this.gfx.fillStyle(color, alpha);
    this.gfx.fillPoints(outer.concat(inner.reverse()), true, true);
  }

  update(
    dt: number,
    state: GameState,
    aiming: boolean,
    aimCell: Cell | null,
    reduced: boolean,
  ): void {
    this.time += dt;
    this.rects.length = 0;
    const active = aiming && state.status === 'playing';
    this.show = reduced ? (active ? 1 : 0) : approach(this.show, active ? 1 : 0, dt, 0.05);
    this.gfx.clear();
    const hide = (list: Phaser.GameObjects.Image[], from: number): void => {
      for (let i = from; i < list.length; i++) list[i]!.setVisible(false);
    };
    if (this.show < 0.02) {
      this.ok.setVisible(false);
      this.bad.setVisible(false);
      hide(this.marks, 0);
      hide(this.pathInk, 0);
      hide(this.pathAlarm, 0);
      return;
    }
    const k = this.art.scale;
    const withCircle = state.hints.throwCircle;
    const hero = this.mapper.center(state.hero.cell);

    let usedMarks = 0;
    if (withCircle) {
      // Круг броска: пунктир пером радиусом 5 клеток.
      const r = balance.throwR * CELL * (0.9 + 0.1 * this.show);
      const unit = (Math.PI * 2) / DASHES;
      const spin = reduced ? 0 : this.time * 0.05;
      const ink = hex(palette.ink);
      for (let i = 0; i < DASHES; i++) {
        const a0 = spin + i * unit;
        this.dash(
          hero.x,
          hero.y,
          r,
          a0,
          a0 + unit * 0.58,
          CELL * 0.022,
          CELL * 0.055,
          ink,
          0.78 * this.show,
        );
      }
      // Клетки, куда словарь долетит.
      for (const cell of throwTargets(state)) {
        const mark = this.marks[usedMarks++];
        if (!mark) break;
        const c = this.mapper.center(cell);
        mark
          .setVisible(true)
          .setPosition(c.x, c.y)
          .setAlpha(0.42 * this.show);
      }
    }
    hide(this.marks, usedMarks);

    let usedInk = 0;
    let usedAlarm = 0;
    this.ok.setVisible(false);
    this.bad.setVisible(false);
    if (aimCell) {
      const valid = checkThrow(state, aimCell) === 'ok';
      const c = this.mapper.center(aimCell);
      const reticle = valid ? this.ok : this.bad;
      const pulse = reduced ? 1 : 1 + Math.sin(this.time * 6) * 0.04;
      reticle
        .setVisible(true)
        .setPosition(c.x, c.y)
        .setScale(k * pulse)
        .setAlpha(this.show);
      this.rects.push({ x: c.x - CELL * 0.3, y: c.y - CELL * 0.3, w: CELL * 0.6, h: CELL * 0.6 });
      if (valid && withCircle) {
        // Путь, которым библиотекарь побежит к выбранной клетке.
        const preview = throwPreview(state, aimCell);
        for (const p of preview.paths) {
          const m = state.librarians[p.m];
          if (!m) continue;
          let prev = this.mapper.center(m.cell);
          for (const cell of p.path) {
            const cur = this.mapper.center(cell);
            const last = sameCell(cell, aimCell);
            for (const f of last ? [0.5] : [0.5, 1]) {
              const pool = p.danger ? this.pathAlarm : this.pathInk;
              const image = p.danger ? pool[usedAlarm++] : pool[usedInk++];
              if (!image) break;
              const x = prev.x + (cur.x - prev.x) * f;
              const y = prev.y + (cur.y - prev.y) * f;
              image
                .setVisible(true)
                .setPosition(x, y)
                .setRotation(Math.atan2(cur.y - prev.y, cur.x - prev.x))
                .setAlpha((p.danger ? 0.95 : 0.8) * this.show);
              this.rects.push({
                x: x - CELL * 0.1,
                y: y - CELL * 0.1,
                w: CELL * 0.2,
                h: CELL * 0.2,
              });
            }
            prev = cur;
          }
        }
      }
    }
    hide(this.pathInk, usedInk);
    hide(this.pathAlarm, usedAlarm);
  }

  destroy(): void {
    this.gfx.destroy();
    this.ok.destroy();
    this.bad.destroy();
    for (const image of [...this.marks, ...this.pathInk, ...this.pathAlarm]) image.destroy();
  }
}
