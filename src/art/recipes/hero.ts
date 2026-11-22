/**
 * Герой — тот же искатель серии в виде фигурки с полей (план, 7.5.10): зелёная шапочка,
 * оранжевый шарф, кремовая туника, сливовые штаны, сапоги. Большая голова, рост около
 * 1.1 клетки. Части смотрят вправо.
 */
import { palette } from '../../config/palette';
import * as K from '../../shared/manuscriptKit';
import { cellPen, dot, gleam, inkW, strokeCells } from './common';

const H = palette.hero;

export function drawHeroBody(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const tunic = cellPen(ppc, [
    [0.15, 0.06],
    [0.39, 0.06],
    [0.43, 0.18],
    [0.41, 0.3],
    [0.47, 0.45],
    [0.27, 0.485],
    [0.07, 0.45],
    [0.13, 0.3],
    [0.11, 0.18],
  ]);
  K.shape(ctx, rng, tunic, H.tunic, inkW(ppc, 0.7), { rim: ppc * 0.025, streak: Math.PI / 2 });
  // Складки туники.
  strokeCells(ctx, ppc, [[0.2, 0.34], [0.18, 0.44]], ppc * 0.004, ppc * 0.012, palette.inkFaded, 0.3);
  strokeCells(ctx, ppc, [[0.34, 0.34], [0.37, 0.44]], ppc * 0.004, ppc * 0.012, palette.inkFaded, 0.3);
  // Пояс с пряжкой и маленькая сумка.
  const belt = cellPen(ppc, [[0.12, 0.27, 1], [0.42, 0.27, 1], [0.42, 0.315, 1], [0.12, 0.315, 1]]);
  K.shape(ctx, rng, belt, H.boots, inkW(ppc, 0.4), { rim: 0, ink: { pools: false } });
  K.inkOutline(ctx, rng, K.rectPath(ppc * 0.25, ppc * 0.265, ppc * 0.05, ppc * 0.055), inkW(ppc, 0.3), {
    closed: true,
    color: palette.derived.brass,
    pools: false,
  });
  const bag = cellPen(ppc, [[0.06, 0.29], [0.15, 0.29], [0.16, 0.39], [0.11, 0.42], [0.05, 0.38]]);
  K.shape(ctx, rng, bag, H.boots, inkW(ppc, 0.45), { rim: 0 });
  // Шарф вокруг шеи — оранжевый, знак искателя во всей серии.
  const scarf = cellPen(ppc, [
    [0.13, 0.03],
    [0.27, 0.0],
    [0.42, 0.03],
    [0.43, 0.11],
    [0.27, 0.14],
    [0.12, 0.11],
  ]);
  K.shape(ctx, rng, scarf, H.scarf, inkW(ppc, 0.55), { rim: ppc * 0.015 });
  strokeCells(ctx, ppc, [[0.18, 0.06], [0.27, 0.09], [0.38, 0.06]], ppc * 0.004, ppc * 0.012, K.darker(H.scarf, 0.35), 0.2);
}

export function drawHeroLeg(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const pants = cellPen(ppc, [[0.05, 0.0, 1], [0.17, 0.0, 1], [0.16, 0.25, 1], [0.06, 0.25, 1]]);
  K.shape(ctx, rng, pants, H.pants, inkW(ppc, 0.55), { rim: ppc * 0.01 });
  const boot = cellPen(ppc, [
    [0.045, 0.22, 1],
    [0.165, 0.22, 1],
    [0.165, 0.29],
    [0.205, 0.31],
    [0.21, 0.355, 1],
    [0.04, 0.36, 1],
  ]);
  K.shape(ctx, rng, boot, H.boots, inkW(ppc, 0.55), { rim: ppc * 0.01 });
  strokeCells(ctx, ppc, [[0.05, 0.245], [0.16, 0.245]], ppc * 0.004, ppc * 0.012, palette.inkFaded);
}

export function drawHeroHead(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number, puff: boolean): void {
  const lw = inkW(ppc, 0.75);
  // Ухо.
  K.shape(ctx, rng, K.ellipsePath(ppc * 0.18, ppc * 0.38, ppc * 0.045, ppc * 0.055, 14), H.skin, inkW(ppc, 0.45), { rim: 0 });
  // Лицо: большое и круглое; с надутыми щеками — шире.
  const face = puff
    ? cellPen(ppc, [
        [0.16, 0.3],
        [0.24, 0.18],
        [0.38, 0.16],
        [0.5, 0.24],
        [0.56, 0.36],
        [0.53, 0.47],
        [0.42, 0.55],
        [0.28, 0.55],
        [0.17, 0.46],
      ])
    : cellPen(ppc, [
        [0.16, 0.3],
        [0.24, 0.18],
        [0.38, 0.16],
        [0.49, 0.24],
        [0.54, 0.36],
        [0.5, 0.46],
        [0.4, 0.53],
        [0.28, 0.53],
        [0.18, 0.45],
      ]);
  K.shape(ctx, rng, face, H.skin, lw, { rim: ppc * 0.025, mottle: 0.3 });
  // Румянец.
  ctx.save();
  ctx.globalAlpha = puff ? 0.75 : 0.45;
  dot(ctx, ppc * (puff ? 0.43 : 0.41), ppc * 0.43, ppc * (puff ? 0.055 : 0.04), palette.derived.cheek);
  ctx.restore();
  // Шапочка с откинутым назад кончиком.
  const cap = cellPen(ppc, [
    [0.13, 0.32],
    [0.12, 0.2],
    [0.06, 0.13],
    [0.02, 0.07, 1],
    [0.12, 0.07],
    [0.24, 0.05],
    [0.38, 0.05],
    [0.5, 0.11],
    [0.57, 0.22],
    [0.57, 0.28, 1],
    [0.44, 0.24],
    [0.3, 0.24],
    [0.18, 0.3],
  ]);
  K.shape(ctx, rng, cap, H.cap, lw, { rim: ppc * 0.02, streak: 0.3 });
  const brim = cellPen(ppc, [[0.15, 0.3], [0.3, 0.22], [0.46, 0.22], [0.58, 0.27, 1], [0.57, 0.31, 1], [0.44, 0.27], [0.3, 0.27], [0.17, 0.34, 1]]);
  K.shape(ctx, rng, brim, K.darker(H.cap, 0.2), inkW(ppc, 0.45), { rim: 0, ink: { pools: false } });
  // Глаз, бровь, нос, рот.
  if (puff) {
    strokeCells(ctx, ppc, [[0.38, 0.35], [0.42, 0.33], [0.46, 0.35]], ppc * 0.008, ppc * 0.02);
    strokeCells(ctx, ppc, [[0.42, 0.48], [0.47, 0.475]], ppc * 0.006, ppc * 0.016);
  } else {
    dot(ctx, ppc * 0.425, ppc * 0.345, ppc * 0.034);
    gleam(ctx, ppc * 0.415, ppc * 0.333, ppc * 0.01);
    strokeCells(ctx, ppc, [[0.38, 0.29], [0.43, 0.28], [0.47, 0.295]], ppc * 0.005, ppc * 0.014);
    strokeCells(ctx, ppc, [[0.41, 0.465], [0.45, 0.48], [0.49, 0.465]], ppc * 0.005, ppc * 0.015);
  }
  const nose = cellPen(ppc, [[0.5, 0.36], [0.56, 0.39], [0.55, 0.43], [0.5, 0.425]]);
  K.shape(ctx, rng, nose, H.skin, inkW(ppc, 0.45), { rim: 0, ink: { pools: false } });
}

/** Рукав и кулачок с вытянутым указательным пальцем (палец у губ, указать путь). */
export function drawHeroArm(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const finger = cellPen(ppc, [[0.085, 0.3], [0.12, 0.3], [0.118, 0.385], [0.1, 0.395], [0.085, 0.385]]);
  K.shape(ctx, rng, finger, H.skin, inkW(ppc, 0.4), { rim: 0, ink: { pools: false } });
  const fist = K.ellipsePath(ppc * 0.1, ppc * 0.29, ppc * 0.052, ppc * 0.05, 14);
  K.shape(ctx, rng, fist, H.skin, inkW(ppc, 0.5), { rim: 0 });
  const sleeve = cellPen(ppc, [[0.05, 0.0], [0.15, 0.0], [0.155, 0.25, 1], [0.045, 0.25, 1]]);
  K.shape(ctx, rng, sleeve, H.tunic, inkW(ppc, 0.55), { rim: ppc * 0.01 });
}

/** Хвост шарфа, развевающийся назад. */
export function drawHeroScarf(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const tail = cellPen(ppc, [
    [0.02, 0.06],
    [0.16, 0.05],
    [0.28, 0.1],
    [0.42, 0.06],
    [0.44, 0.13],
    [0.32, 0.18],
    [0.17, 0.15],
    [0.02, 0.15],
  ]);
  K.shape(ctx, rng, tail, H.scarf, inkW(ppc, 0.5), { rim: ppc * 0.012 });
  for (const x of [0.4, 0.43]) strokeCells(ctx, ppc, [[x, 0.135], [x + 0.02, 0.2]], ppc * 0.004, ppc * 0.01, K.darker(H.scarf, 0.4));
}
