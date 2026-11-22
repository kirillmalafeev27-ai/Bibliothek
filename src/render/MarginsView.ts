/**
 * Маргиналии (план, 7.5.11): улитка, заяц с трубой, обезьянка с книгой — на угловых
 * столбах рамки, вне игрового поля. Смысла для игры не несут: мелкие, приглушённые,
 * неподвижные. На громкие звуки вздрагивают и закрывают уши.
 */
import type Phaser from 'phaser';
import type { ArtFactory } from '../art/ArtFactory';
import type { TexSpec } from '../art/manifest';
import { CELL, DEPTH, TEX } from '../art/manifest';
import type { Mapper } from './orientation';

interface Critter {
  image: Phaser.GameObjects.Image;
  calm: TexSpec;
  startled: TexSpec;
  x: number;
  y: number;
  /** Сколько ещё секунд зверёк закрывает уши. */
  fright: number;
}

const FRIGHT_SEC = 0.9;

export class MarginsView {
  private readonly critters: Critter[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly art: ArtFactory,
    mapper: Mapper,
    private readonly still: () => boolean,
  ) {
    const W = mapper.cols * CELL;
    const H = mapper.rows * CELL;
    // Угловые клетки — столбы стен: игрового смысла у них нет.
    const spots: [TexSpec, TexSpec, number, number, boolean][] = [
      [TEX.margSnail, TEX.margSnailStartled, CELL * 0.52, H - CELL * 0.18, false],
      [TEX.margHare, TEX.margHareStartled, W - CELL * 0.5, CELL * 0.88, true],
      [TEX.margMonkey, TEX.margMonkeyStartled, CELL * 0.5, CELL * 0.88, false],
    ];
    for (const [calm, startled, x, y, flip] of spots) {
      const image = scene.add
        .image(x, y, calm.key)
        .setOrigin(calm.ox, calm.oy)
        .setScale(art.scale * 0.86)
        .setFlipX(flip)
        .setAlpha(0.92)
        .setDepth(DEPTH.objects + y + CELL * 0.5);
      this.critters.push({ image, calm, startled, x, y, fright: 0 });
    }
  }

  /** Громкий звук: зверьки вздрагивают и закрывают уши. */
  flinch(): void {
    for (const c of this.critters) {
      if (c.fright <= 0) c.image.setTexture(c.startled.key);
      c.fright = FRIGHT_SEC;
    }
  }

  update(dt: number): void {
    const still = this.still();
    for (const c of this.critters) {
      if (c.fright > 0) {
        c.fright -= dt;
        const t = 1 - c.fright / FRIGHT_SEC;
        const hop = still ? 0 : Math.max(0, Math.sin(Math.min(1, t * 3) * Math.PI)) * CELL * 0.06;
        c.image.y = c.y - hop;
        if (c.fright <= 0) {
          c.image.setTexture(c.calm.key);
          c.image.y = c.y;
        }
      }
    }
  }

  destroy(): void {
    for (const c of this.critters) c.image.destroy();
    this.critters.length = 0;
    void this.art;
  }
}
