/**
 * Предметы и мебель: стол библиотекаря (Ausleihe), свечи, дверь, листы, словари,
 * читательский билет, штамп «Ungültig» (план, 7.5.5–7.5.8).
 */
import { palette } from '../../config/palette';
import { FONT } from '../../shared/fonts';
import * as K from '../../shared/manuscriptKit';
import { drawBookIcon, drawCardIcon } from '../icons';
import { cellPen, contactLine, dot, gleam, inkW } from './common';
import { drawPagePiece } from './mapArt';

/** Стол библиотекаря спереди: конторка, штемпель, чернильница с пером, картотека, колокольчик. */
export function drawDeskFront(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const W = 1.1 * ppc;
  const H = 0.96 * ppc;
  const lw = inkW(ppc, 0.7);
  contactLine(ctx, rng, W / 2, H - ppc * 0.02, ppc * 0.48, ppc);
  // Столешница и лицевая панель.
  const front = cellPen(ppc, [
    [0.08, 0.5, 1],
    [1.02, 0.5, 1],
    [0.98, 0.93, 1],
    [0.12, 0.93, 1],
  ]);
  K.shape(ctx, rng, front, palette.shelf.wood, lw, { rim: ppc * 0.025, streak: Math.PI / 2 });
  // Резная арочка на панели.
  const arch = K.lancetPath(W / 2 - ppc * 0.14, ppc * 0.6, ppc * 0.28, ppc * 0.28);
  K.shape(ctx, rng, arch, palette.shelf.top, inkW(ppc, 0.4), { rim: 0 });
  // Табличка «Ausleihe».
  const plate = K.roundRectPath(W / 2 - ppc * 0.2, ppc * 0.53, ppc * 0.4, ppc * 0.08, ppc * 0.02);
  K.shape(ctx, rng, plate, palette.derived.paperWhite, inkW(ppc, 0.3), { rim: 0, mottle: 0 });
  K.rubric(
    ctx,
    'Ausleihe',
    `600 ${Math.round(ppc * 0.06)}px "${FONT.ui}"`,
    palette.rubric,
    W / 2,
    ppc * 0.575,
    {
      align: 'center',
      baseline: 'middle',
      maxWidth: ppc * 0.36,
    },
  );
  const top = cellPen(ppc, [
    [0.02, 0.44, 1],
    [1.08, 0.44, 1],
    [1.06, 0.53, 1],
    [0.04, 0.53, 1],
  ]);
  K.shape(ctx, rng, top, palette.shelf.woodLight, lw, { rim: ppc * 0.015 });
  // Картотека: ящички с латунными ручками.
  const cab = K.rectPath(ppc * 0.66, ppc * 0.2, ppc * 0.34, ppc * 0.25);
  K.shape(ctx, rng, cab, palette.shelf.wood, inkW(ppc, 0.5), { rim: 0 });
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const x = ppc * (0.69 + c * 0.155);
      const y = ppc * (0.23 + r * 0.105);
      K.shape(
        ctx,
        rng,
        K.rectPath(x, y, ppc * 0.13, ppc * 0.085),
        palette.shelf.woodLight,
        inkW(ppc, 0.3),
        { rim: 0 },
      );
      dot(ctx, x + ppc * 0.065, y + ppc * 0.045, ppc * 0.014, palette.derived.brass);
    }
  }
  // Огромный штемпель.
  const handle = K.ellipsePath(ppc * 0.36, ppc * 0.12, ppc * 0.07, ppc * 0.06, 16);
  const stem = K.rectPath(ppc * 0.335, ppc * 0.15, ppc * 0.05, ppc * 0.16);
  const block = K.roundRectPath(ppc * 0.24, ppc * 0.3, ppc * 0.24, ppc * 0.14, ppc * 0.02);
  K.shape(ctx, rng, stem, palette.shelf.woodLight, inkW(ppc, 0.4), { rim: 0 });
  K.shape(ctx, rng, handle, palette.shelf.wood, inkW(ppc, 0.45), { rim: 0 });
  K.shape(ctx, rng, block, palette.shelf.woodLight, inkW(ppc, 0.5), { rim: 0 });
  // Чернильница с пером.
  const pot = K.pen(
    [
      [0.1 * ppc, 0.44 * ppc, 1],
      [0.1 * ppc, 0.36 * ppc],
      [0.135 * ppc, 0.33 * ppc],
      [0.17 * ppc, 0.36 * ppc],
      [0.17 * ppc, 0.44 * ppc, 1],
    ],
    true,
    6,
  );
  K.shape(ctx, rng, pot, palette.derived.iron, inkW(ppc, 0.4), { rim: 0 });
  const quill = cellPen(ppc, [
    [0.14, 0.34, 1],
    [0.1, 0.14],
    [0.04, 0.02, 1],
    [0.12, 0.08],
    [0.16, 0.2],
  ]);
  K.shape(ctx, rng, quill, palette.derived.paperWhite, inkW(ppc, 0.35), {
    rim: 0,
    ink: { pools: false },
  });
  // Колокольчик.
  const bell = cellPen(ppc, [
    [0.54, 0.44, 1],
    [0.56, 0.37],
    [0.6, 0.34],
    [0.64, 0.37],
    [0.66, 0.44, 1],
  ]);
  K.shape(ctx, rng, bell, palette.derived.brass, inkW(ppc, 0.4), { rim: 0 });
  dot(ctx, ppc * 0.6, ppc * 0.325, ppc * 0.014, palette.derived.iron);
  gleam(ctx, ppc * 0.585, ppc * 0.39, ppc * 0.01);
}

/** Тот же стол боком — для ландшафта. */
export function drawDeskSide(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const W = 0.7 * ppc;
  const H = 0.96 * ppc;
  const lw = inkW(ppc, 0.7);
  contactLine(ctx, rng, W / 2, H - ppc * 0.02, ppc * 0.32, ppc);
  const side = cellPen(ppc, [
    [0.06, 0.48, 1],
    [0.64, 0.48, 1],
    [0.62, 0.93, 1],
    [0.08, 0.93, 1],
  ]);
  K.shape(ctx, rng, side, palette.shelf.wood, lw, { rim: ppc * 0.025, streak: Math.PI / 2 });
  for (let r = 0; r < 3; r++) {
    const y = ppc * (0.54 + r * 0.12);
    K.shape(
      ctx,
      rng,
      K.rectPath(ppc * 0.14, y, ppc * 0.42, ppc * 0.09),
      palette.shelf.woodLight,
      inkW(ppc, 0.35),
      { rim: 0 },
    );
    dot(ctx, ppc * 0.35, y + ppc * 0.045, ppc * 0.014, palette.derived.brass);
  }
  const top = cellPen(ppc, [
    [0.02, 0.42, 1],
    [0.68, 0.42, 1],
    [0.66, 0.5, 1],
    [0.04, 0.5, 1],
  ]);
  K.shape(ctx, rng, top, palette.shelf.woodLight, lw, { rim: ppc * 0.015 });
  const handle = K.ellipsePath(ppc * 0.42, ppc * 0.12, ppc * 0.07, ppc * 0.06, 16);
  K.shape(
    ctx,
    rng,
    K.rectPath(ppc * 0.395, ppc * 0.15, ppc * 0.05, ppc * 0.15),
    palette.shelf.woodLight,
    inkW(ppc, 0.4),
    { rim: 0 },
  );
  K.shape(ctx, rng, handle, palette.shelf.wood, inkW(ppc, 0.45), { rim: 0 });
  K.shape(
    ctx,
    rng,
    K.roundRectPath(ppc * 0.3, ppc * 0.29, ppc * 0.24, ppc * 0.13, ppc * 0.02),
    palette.shelf.woodLight,
    inkW(ppc, 0.5),
    { rim: 0 },
  );
  const quill = cellPen(ppc, [
    [0.14, 0.4, 1],
    [0.1, 0.2],
    [0.05, 0.08, 1],
    [0.12, 0.14],
    [0.16, 0.26],
  ]);
  K.shape(
    ctx,
    rng,
    K.rectPath(ppc * 0.1, ppc * 0.34, ppc * 0.08, ppc * 0.08),
    palette.derived.iron,
    inkW(ppc, 0.4),
    { rim: 0 },
  );
  K.shape(ctx, rng, quill, palette.derived.paperWhite, inkW(ppc, 0.35), {
    rim: 0,
    ink: { pools: false },
  });
}

/** Подсвечник со свечой. */
export function drawCandle(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const lw = inkW(ppc, 0.45);
  const W = 0.3 * ppc;
  const H = 0.46 * ppc;
  contactLine(ctx, rng, W / 2, H - ppc * 0.015, ppc * 0.11, ppc);
  const base = K.pen(
    [
      [W * 0.12, H * 0.97, 1],
      [W * 0.88, H * 0.97, 1],
      [W * 0.7, H * 0.86],
      [W * 0.56, H * 0.62, 1],
      [W * 0.86, H * 0.56],
      [W * 0.14, H * 0.56],
      [W * 0.44, H * 0.62, 1],
      [W * 0.3, H * 0.86],
    ],
    true,
    6,
  );
  K.shape(ctx, rng, base, palette.derived.iron, lw, { rim: 0 });
  const wax = K.pen(
    [
      [W * 0.36, H * 0.56, 1],
      [W * 0.36, H * 0.16],
      [W * 0.5, H * 0.12],
      [W * 0.64, H * 0.16],
      [W * 0.64, H * 0.56, 1],
    ],
    true,
    6,
  );
  K.shape(ctx, rng, wax, palette.candle.wax, lw, { rim: ppc * 0.01, mottle: 0.2 });
  // Потёк воска.
  K.nibStroke(
    ctx,
    [
      { x: W * 0.6, y: H * 0.18 },
      { x: W * 0.6, y: H * 0.3 },
    ],
    ppc * 0.006,
    ppc * 0.018,
    K.NIB_ANGLE,
    { color: palette.parchmentShade },
  );
  K.nibStroke(
    ctx,
    [
      { x: W * 0.5, y: H * 0.12 },
      { x: W * 0.5, y: H * 0.05 },
    ],
    ppc * 0.004,
    ppc * 0.01,
  );
}

/** Стилизованный язычок пламени — светлый, лимонный (7.1). */
export function drawFlame(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const W = 0.22 * ppc;
  const H = 0.32 * ppc;
  const outer = K.pen(
    [
      [W * 0.5, H * 0.02, 1],
      [W * 0.72, H * 0.38],
      [W * 0.84, H * 0.66],
      [W * 0.5, H * 0.96],
      [W * 0.16, H * 0.66],
      [W * 0.3, H * 0.38],
    ],
    true,
    8,
  );
  K.shape(ctx, rng, outer, palette.candle.flame, inkW(ppc, 0.32), {
    rim: 0,
    mottle: 0,
    ink: { color: palette.inkFaded, pools: false },
  });
  const core = K.pen(
    [
      [W * 0.5, H * 0.36, 1],
      [W * 0.64, H * 0.66],
      [W * 0.5, H * 0.86],
      [W * 0.36, H * 0.66],
    ],
    true,
    8,
  );
  ctx.save();
  ctx.beginPath();
  K.tracePath(ctx, core, true);
  ctx.fillStyle = palette.derived.flameCore;
  ctx.fill();
  ctx.restore();
}

/** Стрельчатая дверь с железными полосами — «откинутая» наружу: порог сверху (7.5.6). */
export function drawDoorLeaf(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const W = 0.9 * ppc;
  const H = 1.0 * ppc;
  const lw = inkW(ppc, 0.6);
  const outline = K.pen(
    [
      [W * 0.04, H * 0.02, 1],
      [W * 0.96, H * 0.02, 1],
      [W * 0.96, H * 0.5],
      [W * 0.5, H * 0.93, 1],
      [W * 0.04, H * 0.5],
    ],
    true,
    10,
  );
  K.tempera(ctx, rng, outline, palette.door.wood, { rim: ppc * 0.03, streak: Math.PI / 2 });
  ctx.save();
  ctx.beginPath();
  K.tracePath(ctx, outline, true);
  ctx.clip();
  // Доски.
  for (let i = 1; i < 5; i++) {
    const x = (W * i) / 5;
    K.nibStroke(
      ctx,
      [
        { x, y: 0 },
        { x: x + (rng() - 0.5) * 2, y: H },
      ],
      ppc * 0.006,
      ppc * 0.016,
      K.NIB_ANGLE,
      { color: palette.ink, alpha: 0.75 },
    );
  }
  // Железные полосы с заклёпками.
  for (const y of [0.16, 0.44]) {
    K.shape(ctx, rng, K.rectPath(-2, H * y, W + 4, ppc * 0.07), palette.door.iron, inkW(ppc, 0.4), {
      rim: 0,
      mottle: 0.2,
    });
    for (let i = 0; i < 6; i++) {
      dot(ctx, W * (0.1 + i * 0.16), H * y + ppc * 0.035, ppc * 0.014, palette.derived.stoneLight);
    }
  }
  ctx.restore();
  K.inkOutline(ctx, rng, outline, lw, { closed: true });
  // Кольцо-ручка.
  const ring = K.ellipsePath(W * 0.72, H * 0.64, ppc * 0.06, ppc * 0.06, 16);
  K.nibStroke(ctx, ring, ppc * 0.01, ppc * 0.026, K.NIB_ANGLE, {
    closed: true,
    color: palette.door.iron,
  });
  dot(ctx, W * 0.72, H * 0.585, ppc * 0.02, palette.door.iron);
}

/** Тёплый свет из-за открытой двери — на пол у порога. */
export function drawDoorLight(ctx: CanvasRenderingContext2D, ppc: number): void {
  const W = ppc;
  const H = 0.5 * ppc;
  const g = ctx.createLinearGradient(0, H, 0, 0);
  g.addColorStop(0, K.withAlpha(palette.door.light, 0.95));
  g.addColorStop(1, K.withAlpha(palette.door.light, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(W * 0.12, H);
  ctx.lineTo(W * 0.88, H);
  ctx.lineTo(W, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
}

/** Словарь на полу: толстая зелёная книга с латунными уголками (7.5.8). */
export function drawFloorBook(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const W = 0.62 * ppc;
  const H = 0.54 * ppc;
  contactLine(ctx, rng, W / 2, H * 0.92, W * 0.42, ppc);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.06);
  ctx.translate(-W / 2, -H / 2);
  drawBookIcon(ctx, rng, W * 0.06, H * 0.04, W * 0.88, H * 0.88, true);
  ctx.restore();
}

/** Книга, упавшая с полки при ошибке: декор, приглушённый корешок. */
export function drawFallBook(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const W = 0.44 * ppc;
  const H = 0.4 * ppc;
  const cover = K.roundRectPath(W * 0.12, H * 0.14, W * 0.76, H * 0.72, ppc * 0.03);
  K.shape(ctx, rng, cover, palette.spines[3] ?? palette.inkFaded, inkW(ppc, 0.5), {
    rim: ppc * 0.02,
  });
  ctx.fillStyle = K.withAlpha(palette.parchment, 0.6);
  ctx.fillRect(W * 0.26, H * 0.3, W * 0.48, ppc * 0.014);
  ctx.fillRect(W * 0.26, H * 0.62, W * 0.48, ppc * 0.012);
  K.nibStroke(
    ctx,
    [
      { x: W * 0.22, y: H * 0.16 },
      { x: W * 0.22, y: H * 0.84 },
    ],
    ppc * 0.006,
    ppc * 0.014,
  );
}

export function drawPage(
  ctx: CanvasRenderingContext2D,
  rng: K.Rand,
  ppc: number,
  piece: number,
): void {
  const S = 0.66 * ppc;
  contactLine(ctx, rng, S / 2, S * 0.9, S * 0.3, ppc);
  drawPagePiece(ctx, piece, S, true);
}

export function drawCard(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const W = 0.46 * ppc;
  const H = 0.34 * ppc;
  drawCardIcon(ctx, rng, W * 0.03, H * 0.05, W * 0.94, H * 0.9);
}

/** Оттиск штампа «Ungültig!» кармином. */
export function drawStampMark(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const W = 0.9 * ppc;
  const H = 0.5 * ppc;
  const box = K.roundRectPath(W * 0.05, H * 0.14, W * 0.9, H * 0.72, H * 0.12);
  ctx.save();
  ctx.globalAlpha = 0.92;
  K.inkOutline(ctx, rng, box, ppc * 0.03, {
    closed: true,
    color: palette.alarm.base,
    pools: false,
    jitter: 0.9,
  });
  K.inkOutline(
    ctx,
    rng,
    K.roundRectPath(W * 0.09, H * 0.22, W * 0.82, H * 0.56, H * 0.1),
    ppc * 0.012,
    {
      closed: true,
      color: palette.alarm.base,
      pools: false,
    },
  );
  ctx.font = `700 ${Math.round(H * 0.34)}px "${FONT.ui}"`;
  ctx.fillStyle = palette.alarm.base;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Ungültig!', W / 2, H * 0.52, W * 0.76);
  ctx.restore();
}
