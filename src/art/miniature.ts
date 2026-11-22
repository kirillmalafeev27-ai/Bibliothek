/**
 * Миниатюры для карточек выбора уровня (11.5.2): крошечный план библиотеки этого уровня
 * красками палитры — пол, стеллажи, скрипучие половицы, столы и мантии библиотекарей.
 */
import { palette } from '../config/palette';
import type { LevelConfig } from '../config/levels';
import { TILE, generateLevel } from '../core';
import * as K from '../shared/manuscriptKit';

export function levelMiniature(level: LevelConfig): string {
  const g = generateLevel(level, 1000 + level.id * 17);
  const lib = g.lib;
  const c = 10;
  // Ландшафтная миниатюра: библиотека повёрнута дверью вправо.
  const W = lib.h * c;
  const H = lib.w * c;
  const canvas = K.makeCanvas(W, H);
  const ctx = K.ctx2d(canvas);
  const rng = K.mulberry32(level.id);
  for (let y = 0; y < lib.h; y++) {
    for (let x = 0; x < lib.w; x++) {
      const t = lib.tiles[y * lib.w + x];
      const vx = y * c;
      const vy = (lib.w - 1 - x) * c;
      let color: string = (x + y) % 2 === 0 ? palette.floor.a : palette.floor.b;
      if (t === TILE.shelf)
        color =
          x === 0 || y === 0 || x === lib.w - 1 || y === lib.h - 1
            ? palette.shelf.top
            : palette.shelf.wood;
      else if (t === TILE.squeak) color = palette.squeak.plank;
      else if (t === TILE.door) color = palette.door.light;
      ctx.fillStyle = color;
      ctx.fillRect(vx, vy, c, c);
    }
  }
  for (const p of g.pages) {
    ctx.fillStyle = palette.take.base;
    ctx.fillRect(p.y * c + 3, (lib.w - 1 - p.x) * c + 3, c - 6, c - 6);
  }
  for (const d of lib.desks) {
    const cx = d.y * c + c / 2;
    const cy = (lib.w - 1 - d.x) * c + c / 2;
    K.shape(ctx, rng, K.ellipsePath(cx, cy, c * 0.42, c * 0.42, 12), palette.librarian.robe, 1.4, {
      rim: 0,
      mottle: 0,
    });
  }
  K.grainOver(ctx, rng, W, H, 0.06);
  return canvas.toDataURL('image/png');
}
