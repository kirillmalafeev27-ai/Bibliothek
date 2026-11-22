/**
 * Сочность (план, раздел 9): слова-звуки на бандеролях, тряска камеры, летящие листы
 * и словари, чернильные звёздочки, пар злости, пылинки. Ничто здесь не блокирует ввод
 * и не задерживает библиотекаря или следующий вопрос.
 */
import Phaser from 'phaser';
import type { ArtFactory } from '../art/ArtFactory';
import type { TexSpec } from '../art/manifest';
import { CELL, DEPTH, TEX } from '../art/manifest';
import { balance } from '../config/balance';
import type { Mapper, Point } from './orientation';

export interface JuiceEnv {
  /** «Меньше движения»: без тряски, зума и пульсаций; бандероли — без разворота. */
  reduced: () => boolean;
  /** Множитель числа частиц (на низком качестве — половина). */
  particleScale: () => number;
  /** Слова-звуки на русском: фрактура кириллицу не покрывает. */
  cyrillic: () => boolean;
  /** Сколько пикселей канвы в одном CSS-пикселе. */
  dpr: () => number;
}

interface Banner {
  image: Phaser.GameObjects.Image;
  born: number;
}

export type WordSize = 'small' | 'normal' | 'big';

const WORD_SCALE: Record<WordSize, number> = { small: 0.82, normal: 1, big: 1.28 };

export class Juice {
  private readonly banners: Banner[] = [];
  private readonly temp = new Set<Phaser.GameObjects.GameObject>();
  private dust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private shakeAmp = 0;
  private shakeLeft = 0;
  private shakeDur = 0;
  private offset: Point = { x: 0, y: 0 };
  private clock = 0;
  private lastFlashAt = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly art: ArtFactory,
    private readonly mapper: Mapper,
    private readonly env: JuiceEnv,
  ) {
    this.startDust();
  }

  private sprite(spec: TexSpec, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const image = this.scene.add
      .image(x, y, spec.key)
      .setOrigin(spec.ox, spec.oy)
      .setScale(this.art.scale)
      .setDepth(depth);
    this.temp.add(image);
    return image;
  }

  private drop(obj: Phaser.GameObjects.GameObject): void {
    this.temp.delete(obj);
    obj.destroy();
  }

  /** Пылинки в воздухе: тихая жизнь картинки, не тянет на себя взгляд. */
  private startDust(): void {
    const count = Math.round(18 * this.env.particleScale());
    if (count <= 0 || this.env.reduced()) return;
    this.dust = this.scene.add.particles(0, 0, TEX.dust.key, {
      x: { min: CELL, max: this.mapper.width - CELL },
      y: { min: CELL, max: this.mapper.height - CELL },
      lifespan: { min: 5000, max: 9000 },
      speedX: { min: -5, max: 5 },
      speedY: { min: -7, max: -2 },
      scale: { min: this.art.scale * 0.6, max: this.art.scale * 1.3 },
      alpha: { start: 0, end: 0, ease: (t: number) => Math.sin(t * Math.PI) * 0.42 },
      frequency: 7000 / count,
      maxAliveParticles: count,
      advance: 5000,
    });
    this.dust.setDepth(DEPTH.effects + 1);
  }

  /**
   * Слово-звук на бандероли над событием. Одновременно на экране не больше трёх;
   * лента появляется со смещением вверх и не закрывает героя и библиотекаря (9.1.4).
   */
  word(text: string, at: Point, size: WordSize = 'normal', holdMs = 820): void {
    const key = this.art.word(text, this.env.cyrillic());
    while (this.banners.length >= balance.view.maxBanderoles) {
      const old = this.banners.shift();
      if (old) this.drop(old.image);
    }
    const k = this.art.scale * WORD_SCALE[size];
    const image = this.scene.add
      .image(0, 0, key)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.effects + 50);
    this.temp.add(image);
    const w = image.width * k;
    const h = image.height * k;
    // Лента остаётся внутри миниатюры и не наезжает на другие ленты.
    const pad = CELL * 0.08;
    let x = Phaser.Math.Clamp(at.x, w / 2 + pad, this.mapper.width - w / 2 - pad);
    let y = Math.max(h + pad, at.y - CELL * 0.06);
    for (let guard = 0; guard < 4; guard++) {
      const clash = this.banners.find(
        (b) =>
          Math.abs(b.image.x - x) < (b.image.displayWidth + w) / 2 &&
          Math.abs(b.image.y - y) < h * 0.9,
      );
      if (!clash) break;
      y = clash.image.y - h * 0.92;
      if (y < h + pad) {
        y = clash.image.y + h * 0.92;
        x = Phaser.Math.Clamp(x + w * 0.2, w / 2 + pad, this.mapper.width - w / 2 - pad);
      }
    }
    image.setPosition(x, y);
    const banner: Banner = { image, born: this.clock };
    this.banners.push(banner);
    const done = (): void => {
      const i = this.banners.indexOf(banner);
      if (i >= 0) this.banners.splice(i, 1);
      this.drop(image);
    };
    if (this.env.reduced()) {
      image.setScale(k);
      this.scene.tweens.add({
        targets: image,
        alpha: 0,
        delay: holdMs,
        duration: 120,
        onComplete: done,
      });
      return;
    }
    // Лента разворачивается, как свиток.
    image
      .setScale(k * 0.08, k * 0.7)
      .setAlpha(0.2)
      .setAngle(Phaser.Math.Between(-4, 4));
    this.scene.tweens.chain({
      targets: image,
      tweens: [
        {
          scaleX: k * 1.06,
          scaleY: k * 1.04,
          alpha: 1,
          y: y - CELL * 0.06,
          duration: 150,
          ease: 'Cubic.easeOut',
        },
        { scaleX: k, scaleY: k, duration: 90, ease: 'Sine.easeInOut' },
        { y: y - CELL * 0.14, duration: holdMs, ease: 'Sine.easeOut' },
        { alpha: 0, y: y - CELL * 0.24, scaleX: k * 0.92, duration: 190, ease: 'Cubic.easeIn' },
      ],
      onComplete: done,
    });
  }

  get bannerCount(): number {
    return this.banners.length;
  }

  /** Тряска камеры на столько CSS-пикселей (9.2). В режиме «меньше движения» её нет. */
  shake(cssPx: number, ms = 240): void {
    if (this.env.reduced() || cssPx <= 0) return;
    const amp = cssPx * this.env.dpr();
    if (amp < this.shakeAmp * (this.shakeLeft / Math.max(1, this.shakeDur))) return;
    this.shakeAmp = amp;
    this.shakeLeft = ms;
    this.shakeDur = ms;
  }

  /** Смещение камеры в пикселях канвы. */
  get cameraOffset(): Point {
    return this.offset;
  }

  /** Спрайт летит по дуге из точки в точку. */
  fly(
    spec: TexSpec,
    from: Point,
    to: Point,
    ms: number,
    opts: {
      arc?: number;
      spin?: number;
      scaleTo?: number;
      depth?: number;
      onDone?: () => void;
      ease?: string;
    } = {},
  ): Phaser.GameObjects.Image {
    const image = this.sprite(spec, from.x, from.y, opts.depth ?? DEPTH.effects + 30);
    const k = this.art.scale;
    const arc = (opts.arc ?? 0.8) * CELL;
    const state = { t: 0 };
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: ms,
      ease: opts.ease ?? 'Sine.easeInOut',
      onUpdate: () => {
        const t = state.t;
        image.setPosition(
          from.x + (to.x - from.x) * t,
          from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * arc,
        );
        image.setRotation((opts.spin ?? 0) * t);
        if (opts.scaleTo !== undefined) image.setScale(k * (1 + (opts.scaleTo - 1) * t));
      },
      onComplete: () => {
        this.drop(image);
        opts.onDone?.();
      },
    });
    return image;
  }

  /** Чернильная звёздочка над героем — верный ответ (9.2). */
  inkStar(at: Point): void {
    const image = this.sprite(TEX.inkStar, at.x, at.y, DEPTH.effects + 20);
    const k = this.art.scale;
    if (this.env.reduced()) {
      this.scene.tweens.add({
        targets: image,
        alpha: 0,
        delay: 260,
        duration: 100,
        onComplete: () => this.drop(image),
      });
      return;
    }
    image.setScale(k * 0.2).setAngle(-30);
    this.scene.tweens.add({
      targets: image,
      scale: k,
      angle: 20,
      y: at.y - CELL * 0.2,
      duration: 190,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: image,
          alpha: 0,
          y: at.y - CELL * 0.34,
          duration: 170,
          onComplete: () => this.drop(image),
        });
      },
    });
  }

  /** Короткая вспышка у уха библиотекаря — «услышал» (8.2). Не чаще 3 раз в секунду. */
  heardFlash(at: Point): void {
    if (this.clock - this.lastFlashAt < balance.view.minFlashGapMs) return;
    this.lastFlashAt = this.clock;
    const image = this.sprite(TEX.heard, at.x, at.y, DEPTH.effects + 25);
    const k = this.art.scale;
    image.setScale(k * 0.4).setAlpha(1);
    this.scene.tweens.add({
      targets: image,
      scale: k * 1.1,
      alpha: 0,
      angle: this.env.reduced() ? 0 : 25,
      duration: 240,
      ease: 'Cubic.easeOut',
      onComplete: () => this.drop(image),
    });
  }

  /** Облачко пара из ушей — злится. */
  steam(at: Point, dir: number): void {
    if (this.env.particleScale() < 1 && Math.random() < 0.5) return;
    const image = this.sprite(TEX.steam, at.x, at.y, DEPTH.effects + 15);
    const k = this.art.scale;
    image.setScale(k * 0.4).setAlpha(0.85);
    const still = this.env.reduced();
    this.scene.tweens.add({
      targets: image,
      x: at.x + dir * CELL * (still ? 0.1 : 0.34),
      y: at.y - CELL * (still ? 0.1 : 0.42),
      scale: k * 1.25,
      alpha: 0,
      duration: 620,
      ease: 'Sine.easeOut',
      onComplete: () => this.drop(image),
    });
  }

  /** Книга падает с полки рядом с героем — ошибка (9.2). Декор: взять её нельзя. */
  bookFall(at: Point): void {
    const side = Math.random() < 0.5 ? -1 : 1;
    const from = { x: at.x + side * CELL * 0.42, y: at.y - CELL * 1.1 };
    const to = { x: at.x + side * CELL * 0.46, y: at.y - CELL * 0.02 };
    const image = this.sprite(TEX.fallBook, from.x, from.y, DEPTH.effects + 12);
    image.setAngle(side * -20);
    this.scene.tweens.chain({
      targets: image,
      tweens: [
        { x: to.x, y: to.y, angle: side * 70, duration: 200, ease: 'Quad.easeIn' },
        { y: to.y - CELL * 0.1, angle: side * 96, duration: 90, ease: 'Quad.easeOut' },
        { y: to.y, angle: side * 90, duration: 80, ease: 'Quad.easeIn' },
        { alpha: 0, delay: 360, duration: 260 },
      ],
      onComplete: () => this.drop(image),
    });
  }

  update(dt: number): void {
    this.clock += dt * 1000;
    if (this.shakeLeft > 0) {
      this.shakeLeft = Math.max(0, this.shakeLeft - dt * 1000);
      const amp = this.shakeAmp * (this.shakeLeft / Math.max(1, this.shakeDur));
      const a = Math.random() * Math.PI * 2;
      this.offset = { x: Math.cos(a) * amp, y: Math.sin(a) * amp };
      if (this.shakeLeft <= 0) {
        this.offset = { x: 0, y: 0 };
        this.shakeAmp = 0;
      }
    }
  }

  /** Пауза: частицы и разовые анимации замирают вместе с миром. */
  setPaused(paused: boolean): void {
    if (this.dust) {
      if (paused) this.dust.pause();
      else this.dust.resume();
    }
  }

  destroy(): void {
    for (const obj of this.temp) obj.destroy();
    this.temp.clear();
    this.banners.length = 0;
    this.dust?.destroy();
    this.dust = null;
  }
}
