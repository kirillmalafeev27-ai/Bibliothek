/**
 * Общие приёмы рецептов: координаты в долях клетки, толщина пера, контактная линия.
 */
import { palette } from '../../config/palette';
import * as K from '../../shared/manuscriptKit';

export type Pt = readonly [number, number] | readonly [number, number, number];

/** Перевод опорных точек из долей клетки в пиксели текстуры. */
export function cellPen(ppc: number, pts: readonly Pt[], closed = true, perSeg = 7): K.Vec[] {
  return K.pen(
    pts.map((p) => (p.length === 3 ? ([p[0] * ppc, p[1] * ppc, p[2]] as const) : ([p[0] * ppc, p[1] * ppc] as const))),
    closed,
    perSeg,
  );
}

/** Толщина чернильного контура: 4–7% клетки (7.3.4). */
export function inkW(ppc: number, k = 1): number {
  return Math.max(1.2, ppc * 0.05 * k);
}

/** Короткий чернильный штрих под персонажем или предметом вместо тени (7.5.13). */
export function contactLine(ctx: CanvasRenderingContext2D, rng: K.Rand, cx: number, cy: number, halfW: number, ppc: number): void {
  const pts = K.spline(
    [
      { x: cx - halfW, y: cy + ppc * 0.004 },
      { x: cx - halfW * 0.3, y: cy + ppc * 0.012 },
      { x: cx + halfW * 0.4, y: cy + ppc * 0.01 },
      { x: cx + halfW, y: cy - ppc * 0.002 },
    ],
    false,
    6,
  );
  K.nibStroke(ctx, K.wobble(rng, pts, ppc * 0.004, false), ppc * 0.012, ppc * 0.034, K.NIB_ANGLE, {
    color: palette.ink,
    alpha: 0.85,
    taper: 0.3,
  });
}

/** Залитая точка (глаз, гвоздь, заклёпка). */
export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string = palette.ink): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.4, r), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Штрих пером по опорным точкам в долях клетки. */
export function strokeCells(
  ctx: CanvasRenderingContext2D,
  ppc: number,
  pts: readonly Pt[],
  wMin: number,
  wMax: number,
  color: string = palette.ink,
  taper = 0.2,
): void {
  K.nibStroke(ctx, cellPen(ppc, pts, false, 6), wMin, wMax, K.NIB_ANGLE, { color, taper });
}

/** Блик на тёмном стекле очков, на металле — маленькая светлая точка. */
export function gleam(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  dot(ctx, x, y, r, palette.derived.paperWhite);
}
