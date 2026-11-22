/**
 * Маргиналии и мелкие эффекты (план, 7.5.11, 9.2): улитка, заяц с трубой, обезьянка
 * с книгой — мелкие и приглушённые; пар злости, пылинки, чернильная звёздочка, «z-z-z».
 */
import { palette } from '../../config/palette';
import * as K from '../../shared/manuscriptKit';
import { cellPen, dot, inkW, strokeCells } from './common';

const D = palette.derived;
const FADED = palette.inkFaded;

function soft(ctx: CanvasRenderingContext2D, rng: K.Rand, path: K.Vec[], color: string, ppc: number): void {
  K.shape(ctx, rng, path, color, inkW(ppc, 0.45), { rim: ppc * 0.012, mottle: 0.3, ink: { color: FADED, pools: false } });
}

/** Улитка: раковина-спираль, рожки. Испугавшись, прячет рожки. */
export function drawSnail(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number, startled: boolean): void {
  const body = startled
    ? cellPen(ppc, [[0.2, 0.6], [0.3, 0.5], [0.62, 0.52], [0.66, 0.58], [0.6, 0.61], [0.22, 0.62]])
    : cellPen(ppc, [[0.12, 0.6], [0.3, 0.5], [0.66, 0.5], [0.78, 0.42], [0.84, 0.48], [0.8, 0.58], [0.6, 0.61], [0.14, 0.62]]);
  soft(ctx, rng, body, D.hare, ppc);
  if (!startled) {
    strokeCells(ctx, ppc, [[0.78, 0.44], [0.8, 0.3], [0.82, 0.24]], ppc * 0.008, ppc * 0.018, FADED);
    strokeCells(ctx, ppc, [[0.8, 0.45], [0.88, 0.33], [0.9, 0.28]], ppc * 0.008, ppc * 0.018, FADED);
    dot(ctx, ppc * 0.82, ppc * 0.235, ppc * 0.018, FADED);
    dot(ctx, ppc * 0.9, ppc * 0.275, ppc * 0.018, FADED);
  }
  const shell = K.ellipsePath(ppc * 0.42, ppc * 0.36, ppc * 0.22, ppc * 0.2, 30);
  soft(ctx, rng, shell, D.snail, ppc);
  const spiral: K.Vec[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = -Math.PI / 2 + t * Math.PI * 4.2;
    const r = ppc * 0.17 * (1 - t * 0.9);
    spiral.push({ x: ppc * 0.42 + Math.cos(a) * r, y: ppc * 0.37 + Math.sin(a) * r * 0.92 });
  }
  K.nibStroke(ctx, spiral, ppc * 0.005, ppc * 0.016, K.NIB_ANGLE, { color: FADED, taper: 0.1 });
}

/** Заяц с длинной трубой. Испугавшись, зажимает уши лапами, труба падает. */
export function drawHare(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number, startled: boolean): void {
  const body = cellPen(ppc, [[0.24, 0.98], [0.2, 0.72], [0.28, 0.52], [0.44, 0.5], [0.54, 0.66], [0.56, 0.98]]);
  soft(ctx, rng, body, D.hare, ppc);
  const head = K.ellipsePath(ppc * 0.42, ppc * 0.42, ppc * 0.12, ppc * 0.1, 20);
  // Уши.
  if (startled) {
    soft(ctx, rng, cellPen(ppc, [[0.34, 0.36], [0.24, 0.3], [0.16, 0.34], [0.22, 0.4]]), D.hare, ppc);
    soft(ctx, rng, cellPen(ppc, [[0.44, 0.33], [0.38, 0.24], [0.3, 0.24], [0.36, 0.34]]), D.hare, ppc);
  } else {
    soft(ctx, rng, cellPen(ppc, [[0.36, 0.36], [0.3, 0.16], [0.32, 0.04], [0.38, 0.14], [0.41, 0.34]]), D.hare, ppc);
    soft(ctx, rng, cellPen(ppc, [[0.43, 0.34], [0.46, 0.14], [0.52, 0.06], [0.52, 0.18], [0.47, 0.36]]), D.hare, ppc);
  }
  soft(ctx, rng, head, D.hare, ppc);
  dot(ctx, ppc * 0.47, ppc * 0.4, ppc * 0.014, FADED);
  if (startled) {
    // Лапы на ушах, глаза зажмурены.
    soft(ctx, rng, K.ellipsePath(ppc * 0.31, ppc * 0.4, ppc * 0.05, ppc * 0.06, 14), D.hare, ppc);
    soft(ctx, rng, K.ellipsePath(ppc * 0.53, ppc * 0.36, ppc * 0.05, ppc * 0.06, 14), D.hare, ppc);
    const horn = cellPen(ppc, [[0.6, 0.94, 1], [0.96, 0.9, 1], [0.97, 0.98, 1], [0.6, 0.98, 1]]);
    soft(ctx, rng, horn, D.stone, ppc);
  } else {
    const horn = cellPen(ppc, [[0.52, 0.45, 1], [0.86, 0.36], [0.97, 0.3, 1], [0.97, 0.48, 1], [0.86, 0.42], [0.53, 0.49, 1]]);
    soft(ctx, rng, horn, D.stone, ppc);
    soft(ctx, rng, K.ellipsePath(ppc * 0.5, ppc * 0.58, ppc * 0.05, ppc * 0.05, 12), D.hare, ppc);
  }
}

/** Обезьянка с книгой. Испугавшись, закрывает уши, книга — на коленях. */
export function drawMonkey(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number, startled: boolean): void {
  strokeCells(ctx, ppc, [[0.22, 0.86], [0.08, 0.8], [0.06, 0.66], [0.14, 0.6]], ppc * 0.012, ppc * 0.026, D.monkey);
  const body = cellPen(ppc, [[0.22, 0.88], [0.24, 0.62], [0.4, 0.5], [0.56, 0.62], [0.6, 0.88]]);
  soft(ctx, rng, body, D.monkey, ppc);
  const head = K.ellipsePath(ppc * 0.42, ppc * 0.38, ppc * 0.13, ppc * 0.12, 20);
  soft(ctx, rng, head, D.monkey, ppc);
  const face = K.ellipsePath(ppc * 0.45, ppc * 0.4, ppc * 0.08, ppc * 0.07, 16);
  soft(ctx, rng, face, D.hare, ppc);
  dot(ctx, ppc * 0.43, ppc * 0.38, ppc * 0.012, FADED);
  dot(ctx, ppc * 0.49, ppc * 0.38, ppc * 0.012, FADED);
  const book = startled
    ? cellPen(ppc, [[0.28, 0.76, 1], [0.56, 0.74, 1], [0.58, 0.82, 1], [0.26, 0.84, 1]])
    : cellPen(ppc, [[0.4, 0.62, 1], [0.66, 0.5, 1], [0.72, 0.62, 1], [0.46, 0.74, 1]]);
  soft(ctx, rng, book, palette.spines[4] ?? FADED, ppc);
  if (startled) {
    soft(ctx, rng, K.ellipsePath(ppc * 0.28, ppc * 0.36, ppc * 0.05, ppc * 0.06, 12), D.monkey, ppc);
    soft(ctx, rng, K.ellipsePath(ppc * 0.56, ppc * 0.34, ppc * 0.05, ppc * 0.06, 12), D.monkey, ppc);
  } else {
    soft(ctx, rng, K.ellipsePath(ppc * 0.3, ppc * 0.38, ppc * 0.04, ppc * 0.05, 12), D.monkey, ppc);
    soft(ctx, rng, K.ellipsePath(ppc * 0.62, ppc * 0.62, ppc * 0.045, ppc * 0.045, 12), D.monkey, ppc);
  }
}

export function drawSteam(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const c = ppc * 0.15;
  for (const [dx, dy, r] of [
    [0, 0.02, 0.07],
    [-0.05, -0.02, 0.05],
    [0.05, -0.03, 0.055],
  ] as const) {
    const puff = K.ellipsePath(c + dx * ppc, c + dy * ppc, r * ppc, r * ppc * 0.9, 14);
    K.shape(ctx, rng, puff, D.steam, inkW(ppc, 0.3), { rim: 0, mottle: 0, ink: { color: FADED, pools: false } });
  }
}

export function drawDust(ctx: CanvasRenderingContext2D, ppc: number): void {
  const c = ppc * 0.04;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, K.withAlpha(D.paperWhite, 1));
  g.addColorStop(1, K.withAlpha(D.paperWhite, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c * 2, c * 2);
}

export function drawInkStar(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const c = ppc * 0.18;
  K.shape(ctx, rng, K.starPath(c, c, ppc * 0.15, 4, 0.32), palette.ink, 0, { rim: 0, mottle: 0 });
  dot(ctx, c + ppc * 0.12, c - ppc * 0.12, ppc * 0.018);
  dot(ctx, c - ppc * 0.13, c + ppc * 0.1, ppc * 0.014);
}

export function drawZzz(ctx: CanvasRenderingContext2D, ppc: number): void {
  const z = (x: number, y: number, s: number): void => {
    K.nibStroke(
      ctx,
      [
        { x: x, y: y },
        { x: x + s, y: y, corner: true } as K.Vec,
        { x: x, y: y + s },
        { x: x + s, y: y + s },
      ],
      ppc * 0.008,
      ppc * 0.022,
      K.NIB_ANGLE,
      { color: palette.ink },
    );
  };
  z(ppc * 0.04, ppc * 0.16, ppc * 0.12);
  z(ppc * 0.18, ppc * 0.05, ppc * 0.09);
}

export function drawSpark(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const c = ppc * 0.1;
  K.shape(ctx, rng, K.starPath(c, c, ppc * 0.09, 4, 0.3), D.paperWhite, 0, { rim: 0, mottle: 0 });
}

/** Полоса блика для золота рамки. */
export function drawGlint(ctx: CanvasRenderingContext2D, ppc: number): void {
  const W = 1.6 * ppc;
  const H = 3.2 * ppc;
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, K.withAlpha(D.paperWhite, 0));
  g.addColorStop(0.42, K.withAlpha(D.paperWhite, 0.15));
  g.addColorStop(0.5, K.withAlpha(D.paperWhite, 0.9));
  g.addColorStop(0.58, K.withAlpha(D.paperWhite, 0.15));
  g.addColorStop(1, K.withAlpha(D.paperWhite, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
