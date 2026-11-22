/**
 * Мир: запечённый фон (пол и стены), ряды стеллажей, столы, дверь, свечи, листы и словари
 * на полу, рамка миниатюры. Вид только читает состояние (план, 13.3.4).
 */
import Phaser from 'phaser';
import type { ArtFactory } from '../art/ArtFactory';
import type { TexSpec } from '../art/manifest';
import { ANCHOR, CELL, DEPTH, SHELF, TEX } from '../art/manifest';
import { balance } from '../config/balance';
import { hex, palette } from '../config/palette';
import type { Cell, GameState } from '../core';
import { sameCell } from '../core';
import * as K from '../shared/manuscriptKit';
import type { Mapper, Side } from './orientation';
import type { RoomView, ShelfRun } from './room';
import { buildRoomView } from './room';

export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ShelfSprite {
  run: ShelfRun;
  image: Phaser.GameObjects.Image;
  /** Полоса позади ряда, которую закрывает его верхняя грань. */
  cover: WorldRect;
  alpha: number;
}

interface FloorItem {
  key: string;
  image: Phaser.GameObjects.Image;
  cell: Cell;
  baseY: number;
  phase: number;
}

const ROOM_KEY = 'room';

/** Скрыта ли за полосой `cover` заметная часть прямоугольника `r` (больше четверти). */
function hiddenBehind(cover: WorldRect, r: WorldRect): boolean {
  const w = Math.min(cover.x + cover.w, r.x + r.w) - Math.max(cover.x, r.x);
  const h = Math.min(cover.y + cover.h, r.y + r.h) - Math.max(cover.y, r.y);
  if (w <= 0 || h <= 0) return false;
  return w * h >= r.w * r.h * 0.25;
}

export class WorldView {
  readonly room: RoomView;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly shelves: ShelfSprite[] = [];
  private readonly items = new Map<string, FloorItem>();
  private readonly flames: Phaser.GameObjects.Image[] = [];
  private doorLeaf: Phaser.GameObjects.Image | null = null;
  private doorLight: Phaser.GameObjects.Image | null = null;
  private readonly twinkles: { image: Phaser.GameObjects.Image; phase: number; rate: number }[] = [];
  private glint: Phaser.GameObjects.Image | null = null;
  private glintMask: Phaser.GameObjects.Image | null = null;
  private glintFilter: { needsUpdate: boolean } | null = null;
  private glintT = -1;
  private glintWait = 2;
  private frameThickness = 0;
  private doorOpen = 0;
  private frameImage: Phaser.GameObjects.Image | null = null;
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly art: ArtFactory,
    readonly mapper: Mapper,
    state: GameState,
    private readonly reducedMotion: () => boolean,
  ) {
    this.room = buildRoomView(state.lib, mapper);
    const k = art.scale;
    const rng = K.mulberry32(state.seed ^ 0x77aa);

    // Слой 1: пол, скрипучие половицы и стены — одна запечённая текстура.
    art.room(ROOM_KEY, this.room, state.seed);
    const roomImage = scene.add.image(0, 0, ROOM_KEY).setOrigin(0, 0).setScale(k).setDepth(DEPTH.floor);
    this.objects.push(roomImage);

    // Слой 3: ряды стеллажей, сортировка по y основания.
    for (const run of this.room.runs) {
      const variant = Math.floor(rng() * 3);
      const key = art.shelf(run.dir, run.len, variant, SHELF.overhang);
      const bottomRow = run.dir === 'h' ? run.y + 1 : run.y + run.len;
      const baseY = bottomRow * CELL;
      const image = scene.add
        .image(run.x * CELL, baseY, key)
        .setOrigin(0, 1)
        .setScale(k)
        .setDepth(DEPTH.objects + baseY);
      this.objects.push(image);
      const widthCells = run.dir === 'h' ? run.len : 1;
      this.shelves.push({
        run,
        image,
        cover: {
          x: run.x * CELL,
          y: (run.y - SHELF.overhang) * CELL,
          w: widthCells * CELL,
          h: SHELF.overhang * CELL,
        },
        alpha: 1,
      });
      // Свечи на концах некоторых рядов (7.5.4): декор, пламя светлое, лимонное.
      if (run.len >= 2 && rng() < 0.42) {
        const atStart = rng() < 0.5;
        const cx = run.dir === 'h' ? (atStart ? run.x + 0.22 : run.x + run.len - 0.22) : run.x + 0.5;
        const cy = run.dir === 'h' ? run.y + 0.16 : atStart ? run.y + 0.05 : run.y + run.len - SHELF.front - 0.12;
        this.addCandle(cx * CELL, cy * CELL, baseY + 1, rng);
      }
    }

    // Столы библиотекарей.
    for (const desk of state.lib.desks) this.addDesk(desk);

    // Дверь: створка «развёрнута наружу» на своей стене.
    this.addDoor(state.lib.door);

    // Звёзды в окнах дальней стены мерцают — ночь живёт.
    const cx = Math.floor(this.room.cols / 2);
    const windows = [cx - 2, cx + 2];
    if (this.room.cols >= 11) windows.push(cx - 4, cx + 4);
    for (const wx of windows) {
      for (let i = 0; i < 2; i++) {
        const x = (wx + 0.33 + rng() * 0.34) * CELL;
        const y = (0.24 + rng() * 0.36) * CELL;
        const image = scene.add
          .image(x, y, TEX.spark.key)
          .setScale(art.scale * (0.45 + rng() * 0.25))
          .setTint(hex(palette.window.star))
          .setDepth(DEPTH.floor + 3);
        this.objects.push(image);
        this.twinkles.push({ image, phase: rng() * 10, rate: 0.7 + rng() * 1.2 });
      }
    }

    this.syncItems(state);
  }

  private make(spec: TexSpec, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const image = this.scene.add
      .image(x, y, spec.key)
      .setOrigin(spec.ox, spec.oy)
      .setScale(this.art.scale)
      .setDepth(depth);
    this.objects.push(image);
    return image;
  }

  private addCandle(x: number, y: number, depth: number, rng: K.Rand): void {
    this.make(TEX.candle, x, y, DEPTH.objects + depth);
    const flame = this.make(TEX.flame, x, y - TEX.candle.h * CELL * 0.86, DEPTH.objects + depth + 0.5);
    flame.setData('phase', rng() * 10);
    this.flames.push(flame);
  }

  private addDesk(desk: Cell): void {
    const far = this.mapper.farSide;
    if (far === 'top') {
      const p = this.mapper.at(desk, 0.5, 0.4);
      this.make(TEX.deskFront, p.x, p.y, DEPTH.objects + p.y);
    } else {
      // В ландшафте конторка стоит боком у дальней стены.
      const fx = far === 'right' ? 0.74 : 0.26;
      const p = this.mapper.at(desk, fx, 0.56);
      const image = this.make(TEX.deskSide, p.x, p.y, DEPTH.objects + p.y);
      image.setFlipX(far === 'left');
    }
  }

  private addDoor(door: Cell): void {
    const side: Side = this.mapper.doorSide;
    const v = this.mapper.toView(door);
    let x = (v.x + 0.5) * CELL;
    let y = v.y * CELL;
    let angle = 0;
    if (side === 'left') {
      x = (v.x + 1) * CELL;
      y = (v.y + 0.5) * CELL;
      angle = 90;
    } else if (side === 'right') {
      x = v.x * CELL;
      y = (v.y + 0.5) * CELL;
      angle = -90;
    }
    const leaf = this.make(TEX.doorLeaf, x, y, DEPTH.floor + 2);
    leaf.setAngle(angle);
    this.doorLeaf = leaf;
    // Тёплый свет из-за двери ложится на пол у порога, когда дверь открыта.
    const light = this.make(TEX.doorLight, x, y, DEPTH.floor + 1);
    light.setAngle(angle).setAlpha(0);
    this.doorLight = light;
  }

  /** Рамка миниатюры: толщина задаётся раскладкой, в клетках. */
  setFrame(thickness: number): void {
    if (this.frameImage && Math.abs(thickness - this.frameThickness) < 1e-4) {
      if (this.glintFilter) this.glintFilter.needsUpdate = true;
      return;
    }
    this.frameThickness = thickness;
    this.frameImage?.destroy();
    const key = this.art.frame(this.room.cols, this.room.rows, thickness);
    this.frameImage = this.scene.add
      .image(-thickness * CELL, -thickness * CELL, key)
      .setOrigin(0, 0)
      .setScale(this.art.scale)
      .setDepth(DEPTH.margins + 5);
    this.setupGlint(thickness);
  }

  /**
   * Блик золота (8.1): заранее отрисованная полоса раз в 3–5 секунд пробегает по маске
   * золотых элементов рамки. Если фильтры недоступны — золото остаётся без блика (8.5).
   */
  private setupGlint(thickness: number): void {
    this.glint?.destroy();
    this.glintMask?.destroy();
    this.glint = null;
    this.glintMask = null;
    this.glintFilter = null;
    if (this.scene.game.renderer.type !== Phaser.WEBGL) return;
    try {
      const maskKey = this.art.frameMask(this.room.cols, this.room.rows, thickness);
      const mask = new Phaser.GameObjects.Image(this.scene, -thickness * CELL, -thickness * CELL, maskKey);
      mask.setOrigin(0, 0).setScale(this.art.scale);
      const glint = this.scene.add
        .image(-9999, 0, TEX.glint.key)
        .setScale(this.art.scale * 1.4)
        .setRotation(0.5)
        .setDepth(DEPTH.margins + 6)
        .setVisible(false);
      glint.enableFilters();
      const filter = glint.filters?.external.addMask(mask, false, this.scene.cameras.main);
      if (filter) {
        filter.autoUpdate = false;
        filter.needsUpdate = true;
        this.glintFilter = filter;
      }
      this.glint = glint;
      this.glintMask = mask;
    } catch (err) {
      console.warn('Блик золота недоступен', err);
      this.glint = null;
    }
  }

  /** Насколько открыта дверь: 0 — закрыта, 1 — распахнута. */
  setDoorOpen(open: number): void {
    this.doorOpen = Phaser.Math.Clamp(open, 0, 1);
    if (this.doorLeaf) this.doorLeaf.scaleX = this.art.scale * (1 - this.doorOpen * 0.82);
    this.doorLight?.setAlpha(this.doorOpen);
  }

  get doorOpenness(): number {
    return this.doorOpen;
  }

  /** Точка мира у порога двери — куда проскальзывает герой. */
  doorPoint(state: GameState, outside: number): { x: number; y: number } {
    const side = this.mapper.doorSide;
    const c = this.mapper.at(state.lib.door, 0.5, 0.5);
    if (side === 'bottom') return { x: c.x, y: c.y + outside * CELL };
    if (side === 'left') return { x: c.x - outside * CELL, y: c.y + (ANCHOR.feet - 0.5) * CELL };
    return { x: c.x + outside * CELL, y: c.y + (ANCHOR.feet - 0.5) * CELL };
  }

  private itemPoint(cell: Cell, slot: number): { x: number; y: number } {
    const p = this.mapper.at(cell, 0.5, ANCHOR.item);
    // Несколько словарей на одной клетке лежат стопкой со сдвигом.
    return { x: p.x + slot * CELL * 0.1, y: p.y - slot * CELL * 0.08 };
  }

  /** Листы и словари на полу: спрайты появляются и исчезают вслед за состоянием. */
  syncItems(state: GameState): void {
    const seen = new Set<string>();
    for (const page of state.pages) {
      const key = `page:${page.id}`;
      seen.add(key);
      if (!this.items.has(key)) {
        const spec = [TEX.page0, TEX.page1, TEX.page2][page.id] ?? TEX.page0;
        const p = this.itemPoint(page.cell, 0);
        const image = this.make(spec, p.x, p.y, DEPTH.onFloor + p.y);
        this.items.set(key, { key, image, cell: page.cell, baseY: p.y, phase: page.id * 2.1 });
      }
    }
    const counts = new Map<string, number>();
    for (const book of state.books) {
      const id = `${book.x},${book.y}`;
      const slot = counts.get(id) ?? 0;
      counts.set(id, slot + 1);
      const key = `book:${id}:${slot}`;
      seen.add(key);
      if (!this.items.has(key)) {
        const p = this.itemPoint(book, slot);
        const image = this.make(TEX.book, p.x, p.y, DEPTH.onFloor + p.y + slot);
        this.items.set(key, { key, image, cell: book, baseY: p.y, phase: 0 });
      }
    }
    for (const [key, item] of this.items) {
      if (seen.has(key)) continue;
      item.image.destroy();
      const i = this.objects.indexOf(item.image);
      if (i >= 0) this.objects.splice(i, 1);
      this.items.delete(key);
    }
  }

  /** Прячет лист или словарь на клетке, пока его «несёт» анимация подбора. */
  hideItemAt(cell: Cell, kind: 'page' | 'book'): { x: number; y: number } | null {
    for (const item of this.items.values()) {
      if (item.key.startsWith(kind) && sameCell(item.cell, cell) && item.image.visible) {
        item.image.setVisible(false);
        return { x: item.image.x, y: item.image.y };
      }
    }
    return null;
  }

  /** Показывает спрятанный предмет на клетке (словарь приземлился). */
  showItemAt(cell: Cell, kind: 'page' | 'book'): void {
    for (const item of this.items.values()) {
      if (item.key.startsWith(kind) && sameCell(item.cell, cell) && !item.image.visible) {
        item.image.setVisible(true);
        return;
      }
    }
  }

  /** Прямоугольники предметов на полу — они могут оказаться за стеллажом. */
  itemRects(): WorldRect[] {
    const out: WorldRect[] = [];
    for (const item of this.items.values()) {
      if (!item.image.visible) continue;
      const w = item.image.displayWidth;
      const h = item.image.displayHeight;
      out.push({ x: item.image.x - w * item.image.originX, y: item.image.y - h * item.image.originY, w, h });
    }
    return out;
  }

  /**
   * Стеллаж становится полупрозрачным, если за ним персонаж, предмет или подсказка (2.1.7).
   * `behind` — прямоугольники всего, что может быть скрыто.
   */
  update(dt: number, behind: readonly WorldRect[], glintOn = true): void {
    this.time += dt;
    const still = this.reducedMotion();
    const rate = 1 - Math.exp(-dt / (balance.view.shelfFadeMs / 1000 / 3));
    for (const shelf of this.shelves) {
      let hidden = false;
      for (const r of behind) {
        if (hiddenBehind(shelf.cover, r)) {
          hidden = true;
          break;
        }
      }
      const target = hidden ? balance.view.shelfBehindAlpha : 1;
      shelf.alpha += (target - shelf.alpha) * rate;
      if (Math.abs(shelf.alpha - target) < 0.004) shelf.alpha = target;
      shelf.image.setAlpha(shelf.alpha);
    }
    // Листы слегка покачиваются (7.5.7); пламя свечей дрожит.
    for (const item of this.items.values()) {
      if (!item.key.startsWith('page')) continue;
      const t = this.time * 1.6 + item.phase;
      item.image.setRotation(still ? 0 : Math.sin(t) * 0.07);
      item.image.y = item.baseY + (still ? 0 : Math.sin(t * 0.7) * CELL * 0.012);
    }
    for (const tw of this.twinkles) {
      const a = still ? 0.8 : 0.45 + 0.55 * Math.max(0, Math.sin(this.time * tw.rate + tw.phase));
      tw.image.setAlpha(a);
    }
    this.updateGlint(dt, glintOn);
    const k = this.art.scale;
    for (const flame of this.flames) {
      const t = this.time * 7 + (flame.getData('phase') as number);
      if (still) {
        flame.setScale(k);
        flame.setRotation(0);
      } else {
        flame.setScale(k * (1 + Math.sin(t * 1.3) * 0.05), k * (1 + Math.sin(t) * 0.09 + Math.sin(t * 2.7) * 0.04));
        flame.setRotation(Math.sin(t * 0.6) * 0.07);
      }
    }
  }

  private updateGlint(dt: number, on: boolean): void {
    const glint = this.glint;
    if (!glint) return;
    if (!on) {
      glint.setVisible(false);
      this.glintT = -1;
      return;
    }
    if (this.glintT < 0) {
      this.glintWait -= dt;
      if (this.glintWait > 0) return;
      this.glintT = 0;
      if (this.glintFilter) this.glintFilter.needsUpdate = true;
    }
    this.glintT += dt / 0.9;
    const W = this.room.cols * CELL;
    const H = this.room.rows * CELL;
    const t = this.glintT;
    glint.setVisible(true).setPosition(-CELL + (W + H * 0.6 + CELL * 2) * t - H * 0.3, H / 2);
    glint.setScale(this.art.scale * 1.4, (this.art.scale * (H + CELL * 2)) / (TEX.glint.h * this.art.ppc) );
    if (t >= 1) {
      glint.setVisible(false);
      this.glintT = -1;
      this.glintWait = 3 + Math.random() * 2;
    }
  }

  /** Все ряды стеллажей (для отладки и тестов). */
  shelfAlphas(): number[] {
    return this.shelves.map((s) => s.alpha);
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
    this.objects.length = 0;
    this.shelves.length = 0;
    this.items.clear();
    this.flames.length = 0;
    this.frameImage?.destroy();
    this.frameImage = null;
    this.glint?.destroy();
    this.glintMask?.destroy();
    this.glint = null;
    this.glintMask = null;
    this.doorLeaf = null;
    this.doorLight = null;
    this.twinkles.length = 0;
  }
}
