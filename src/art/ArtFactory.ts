/**
 * Фабрика арта (план, 7.3). Внешних картинок нет: все текстуры рисуются процедурно
 * на Canvas 2D и регистрируются в Phaser под ключами из манифеста.
 * Набор рисунков задаёт «поставщик»: серый (этап 2) или рукописный (этап 3).
 */
import type Phaser from 'phaser';
import type { RoomView } from '../render/room';
import * as K from '../shared/manuscriptKit';
import type { TexSpec } from './manifest';
import { ALL_TEX, CELL, loudRingKey, shelfKey } from './manifest';

export interface ShelfEnds {
  /** Есть ли на этом конце ряда свеча (её рисует отдельный спрайт). */
  variant: number;
}

export interface ArtProvider {
  readonly name: 'gray' | 'manuscript';
  /** Рисует текстуру манифеста на холсте размером spec.w × ppc на spec.h × ppc. */
  draw(spec: TexSpec, ctx: CanvasRenderingContext2D, ppc: number, rng: K.Rand): void;
  /** Запечённый фон комнаты: пол, скрипучие половицы, стены, проём двери. */
  room(ctx: CanvasRenderingContext2D, room: RoomView, ppc: number, seed: number): void;
  /** Ряд стеллажей: холст len × (1 + overhang) клеток (гориз.) или 1 × (len + overhang) (верт.). */
  shelf(ctx: CanvasRenderingContext2D, dir: 'h' | 'v', len: number, ppc: number, seed: number): void;
  /** Кольцо громкого слуха радиуса r клеток, холст (2r + 0.4) клеток. */
  loudRing(ctx: CanvasRenderingContext2D, radius: number, ppc: number): void;
  /** Золотая рамка миниатюры: холст (cols + 2t) × (rows + 2t) клеток, t — толщина. */
  frame(ctx: CanvasRenderingContext2D, cols: number, rows: number, thickness: number, ppc: number): void;
  /** Слово-звук на бандероли. Возвращает готовый холст. */
  word(text: string, ppc: number, cyrillic: boolean): HTMLCanvasElement;
}

/** Запас вокруг кольца громкого слуха, клеток. */
export const LOUD_RING_PAD = 0.2;

export class ArtFactory {
  /** Сколько миллисекунд заняла генерация основного набора. */
  generationMs = 0;

  constructor(
    private readonly textures: Phaser.Textures.TextureManager,
    readonly provider: ArtProvider,
    /** Пикселей текстуры на клетку: 96, на низком качестве — 64 (7.3.3). */
    readonly ppc: number,
  ) {}

  /** Во сколько раз спрайт масштабируется, чтобы клетка заняла CELL единиц мира. */
  get scale(): number {
    return CELL / this.ppc;
  }

  private add(key: string, canvas: HTMLCanvasElement): void {
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
  }

  /**
   * Генерирует все текстуры манифеста. Работа разбита на порции, чтобы экран загрузки
   * успевал обновляться (7.3.6).
   */
  async generateAll(onProgress?: (done: number, total: number) => void): Promise<void> {
    const t0 = performance.now();
    const total = ALL_TEX.length;
    let lastYield = performance.now();
    for (let i = 0; i < total; i++) {
      const spec = ALL_TEX[i] as TexSpec;
      const canvas = K.makeCanvas(spec.w * this.ppc, spec.h * this.ppc);
      const ctx = K.ctx2d(canvas);
      this.provider.draw(spec, ctx, this.ppc, K.mulberry32(K.hashSeed(spec.key)));
      this.add(spec.key, canvas);
      onProgress?.(i + 1, total);
      if (performance.now() - lastYield > 24) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        lastYield = performance.now();
      }
    }
    this.generationMs = performance.now() - t0;
  }

  /** Фон комнаты. Ключ один: при новом раунде или повороте экрана текстура заменяется. */
  room(key: string, room: RoomView, seed: number): string {
    const canvas = K.makeCanvas(room.cols * this.ppc, room.rows * this.ppc);
    this.provider.room(K.ctx2d(canvas), room, this.ppc, seed);
    this.add(key, canvas);
    return key;
  }

  shelf(dir: 'h' | 'v', len: number, variant: number, overhang: number): string {
    const key = shelfKey(dir, len, variant);
    if (this.textures.exists(key)) return key;
    const w = dir === 'h' ? len : 1;
    const h = dir === 'h' ? 1 + overhang : len + overhang;
    const canvas = K.makeCanvas(w * this.ppc, h * this.ppc);
    this.provider.shelf(K.ctx2d(canvas), dir, len, this.ppc, K.hashSeed(key));
    this.add(key, canvas);
    return key;
  }

  loudRing(radius: number): string {
    const key = loudRingKey(radius);
    if (this.textures.exists(key)) return key;
    const size = (radius + LOUD_RING_PAD) * 2 * this.ppc;
    const canvas = K.makeCanvas(size, size);
    this.provider.loudRing(K.ctx2d(canvas), radius, this.ppc);
    this.add(key, canvas);
    return key;
  }

  frame(cols: number, rows: number, thickness: number): string {
    const key = `frame_${cols}x${rows}_${Math.round(thickness * 1000)}`;
    if (this.textures.exists(key)) return key;
    const canvas = K.makeCanvas((cols + thickness * 2) * this.ppc, (rows + thickness * 2) * this.ppc);
    this.provider.frame(K.ctx2d(canvas), cols, rows, thickness, this.ppc);
    this.add(key, canvas);
    return key;
  }

  /** Слово-звук на бандероли; текстуры кэшируются по тексту. */
  word(text: string, cyrillic: boolean): string {
    const key = `word_${cyrillic ? 'ru' : 'de'}_${K.hashSeed(text)}`;
    if (this.textures.exists(key)) return key;
    this.add(key, this.provider.word(text, this.ppc, cyrillic));
    return key;
  }

  /** Удаляет все текстуры фабрики (destroy() встраивания). */
  dispose(keys: readonly string[] = []): void {
    for (const spec of ALL_TEX) if (this.textures.exists(spec.key)) this.textures.remove(spec.key);
    for (const key of keys) if (this.textures.exists(key)) this.textures.remove(key);
  }
}
