/**
 * Библиотекарь (план, 7.5.9): высокий, худой, сутулый. Ультрамариновая мантия с кремовой
 * каймой, длинный нос, огромные уши с розовым внутри, крошечные тёмные круглые очки,
 * длинные пальцы, связка ключей на поясе, тапочки. Ворчливый и смешной, а не страшный.
 * Все части смотрят вправо; вид отражает фигуру по направлению взгляда.
 */
import { palette } from '../../config/palette';
import * as K from '../../shared/manuscriptKit';
import { cellPen, dot, gleam, inkW, strokeCells } from './common';

const L = palette.librarian;

export function drawRobe(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const lw = inkW(ppc, 0.8);
  const robe = cellPen(ppc, [
    [0.4, 0.05],
    [0.29, 0.1],
    [0.21, 0.25],
    [0.18, 0.46],
    [0.14, 0.72],
    [0.09, 0.98, 1],
    [0.26, 1.01],
    [0.42, 1.0],
    [0.58, 1.01],
    [0.71, 0.97, 1],
    [0.62, 0.72],
    [0.58, 0.5],
    [0.6, 0.3],
    [0.56, 0.13],
    [0.5, 0.05, 1],
  ]);
  K.tempera(ctx, rng, robe, L.robe, { rim: ppc * 0.035, mottle: 0.6, streak: Math.PI / 2 - 0.15 });
  ctx.save();
  ctx.beginPath();
  K.tracePath(ctx, robe, true);
  ctx.clip();
  // Сутулая спина — тёмная складка.
  const hump = cellPen(ppc, [
    [0.2, 0.2],
    [0.34, 0.12],
    [0.36, 0.3],
    [0.26, 0.5],
    [0.16, 0.5],
  ]);
  K.tempera(ctx, rng, hump, L.robeDark, { rim: 0, mottle: 0.3, alpha: 0.55 });
  // Кремовая кайма по переду и по подолу.
  const trim = cellPen(ppc, [
    [0.48, 0.05, 1],
    [0.55, 0.06, 1],
    [0.61, 0.32],
    [0.61, 0.52],
    [0.69, 0.99, 1],
    [0.61, 1.0, 1],
    [0.55, 0.53],
    [0.54, 0.32],
  ]);
  K.shape(ctx, rng, trim, L.trim, inkW(ppc, 0.45), { rim: ppc * 0.01, ink: { pools: false } });
  const hem = cellPen(ppc, [
    [0.0, 0.955, 1],
    [0.8, 0.955, 1],
    [0.8, 1.04, 1],
    [0.0, 1.04, 1],
  ]);
  K.tempera(ctx, rng, hem, L.trim, { rim: 0, mottle: 0.2 });
  K.nibStroke(ctx, cellPen(ppc, [[0.06, 0.96], [0.42, 0.97], [0.76, 0.955]], false, 8), ppc * 0.006, ppc * 0.016, K.NIB_ANGLE);
  // Складки.
  for (const [a, b] of [
    [[0.3, 0.6], [0.25, 0.92]],
    [[0.42, 0.62], [0.44, 0.92]],
    [[0.24, 0.34], [0.22, 0.48]],
  ] as const) {
    strokeCells(ctx, ppc, [a, [(a[0] + b[0]) / 2 - 0.01, (a[1] + b[1]) / 2], b], ppc * 0.006, ppc * 0.02, L.robeDark, 0.3);
  }
  ctx.restore();
  // Пояс-шнур с узлом.
  const belt = cellPen(ppc, [[0.18, 0.52], [0.38, 0.555], [0.6, 0.545]], false, 8);
  K.nibStroke(ctx, belt, ppc * 0.03, ppc * 0.045, K.NIB_ANGLE, { color: L.robeDark });
  K.nibStroke(ctx, belt, ppc * 0.006, ppc * 0.012, K.NIB_ANGLE, { color: palette.ink, alpha: 0.6 });
  strokeCells(ctx, ppc, [[0.5, 0.55], [0.52, 0.66], [0.49, 0.74]], ppc * 0.012, ppc * 0.026, L.robeDark);
  strokeCells(ctx, ppc, [[0.52, 0.55], [0.57, 0.65], [0.56, 0.72]], ppc * 0.012, ppc * 0.026, L.robeDark);
  dot(ctx, ppc * 0.51, ppc * 0.55, ppc * 0.025, L.robeDark);
  // Воротник.
  const collar = cellPen(ppc, [
    [0.36, 0.08],
    [0.44, 0.03],
    [0.54, 0.06],
    [0.52, 0.12],
    [0.42, 0.13],
  ]);
  K.shape(ctx, rng, collar, L.trim, inkW(ppc, 0.45), { rim: 0, ink: { pools: false } });
  K.inkOutline(ctx, rng, robe, lw, { closed: true });
}

/** Подол: волнуется при ходьбе и хлопает на бегу. За мантией видны только края. */
export function drawHem(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const hem = cellPen(ppc, [
    [0.08, 0.03],
    [0.78, 0.03],
    [0.82, 0.15],
    [0.64, 0.19],
    [0.43, 0.175],
    [0.22, 0.19],
    [0.04, 0.15],
  ]);
  K.tempera(ctx, rng, hem, L.robeDark, { rim: ppc * 0.02, mottle: 0.4 });
  K.nibStroke(ctx, cellPen(ppc, [[0.06, 0.145], [0.22, 0.175], [0.43, 0.16], [0.64, 0.175], [0.8, 0.145]], false, 8), ppc * 0.012, ppc * 0.022, K.NIB_ANGLE, {
    color: L.trim,
  });
  K.inkOutline(ctx, rng, hem, inkW(ppc, 0.6), { closed: true, pools: false });
}

/** Голова: лысина с седыми пучками, длинный нос, крошечные тёмные очки. */
export function drawLibHead(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number, kind: 'calm' | 'angry' | 'sleep'): void {
  const lw = inkW(ppc, 0.75);
  const skin = kind === 'angry' ? K.blend(L.skin, L.angry, 0.72) : L.skin;
  // Шея — под воротником.
  K.shape(ctx, rng, cellPen(ppc, [[0.24, 0.44], [0.34, 0.46], [0.36, 0.6, 1], [0.24, 0.6, 1]]), skin, inkW(ppc, 0.5), { rim: 0 });
  // Седые пряди на затылке и над ухом — мягкие, без колючек.
  for (const [cx, cy, a, len] of [
    [0.13, 0.18, -2.5, 0.08],
    [0.11, 0.25, -2.8, 0.09],
    [0.12, 0.32, -3.0, 0.07],
    [0.17, 0.12, -2.1, 0.06],
  ] as const) {
    const wisp = K.spline(
      [
        { x: cx * ppc, y: cy * ppc },
        { x: (cx + Math.cos(a) * len * 0.6) * ppc, y: (cy + Math.sin(a) * len * 0.6 - 0.01) * ppc },
        { x: (cx + Math.cos(a + 0.4) * len) * ppc, y: (cy + Math.sin(a + 0.4) * len) * ppc },
      ],
      false,
      6,
    );
    K.nibStroke(ctx, wisp, ppc * 0.012, ppc * 0.03, K.NIB_ANGLE, { color: palette.derived.hair, taper: 0.4 });
    K.nibStroke(ctx, wisp, ppc * 0.003, ppc * 0.008, K.NIB_ANGLE, { color: palette.inkFaded, taper: 0.4 });
  }
  const skull = cellPen(ppc, [
    [0.11, 0.3],
    [0.13, 0.15],
    [0.23, 0.06],
    [0.36, 0.045],
    [0.47, 0.1],
    [0.53, 0.2],
    [0.53, 0.3],
    [0.5, 0.41],
    [0.45, 0.5],
    [0.34, 0.54],
    [0.22, 0.51],
    [0.14, 0.43],
  ]);
  K.shape(ctx, rng, skull, skin, lw, { rim: ppc * 0.03, mottle: 0.4 });
  // Морщины на лбу.
  for (const y of [0.13, 0.17]) strokeCells(ctx, ppc, [[0.36, y], [0.41, y - 0.01], [0.46, y + 0.005]], ppc * 0.004, ppc * 0.01, palette.inkFaded, 0.3);
  // Длинный нос с картошкой на конце.
  const nose = cellPen(ppc, [
    [0.5, 0.235],
    [0.6, 0.29],
    [0.67, 0.35],
    [0.69, 0.41],
    [0.65, 0.445],
    [0.58, 0.42],
    [0.52, 0.37],
  ]);
  K.shape(ctx, rng, nose, skin, inkW(ppc, 0.6), { rim: ppc * 0.015 });
  dot(ctx, ppc * 0.62, ppc * 0.415, ppc * 0.008, palette.inkFaded);
  // Крошечные тёмные очки на дужке до уха.
  strokeCells(ctx, ppc, [[0.44, 0.255], [0.33, 0.27], [0.22, 0.28]], ppc * 0.006, ppc * 0.012, L.glasses, 0.05);
  if (kind === 'sleep') {
    // Спит: очки сползли, глаз закрыт.
    dot(ctx, ppc * 0.47, ppc * 0.3, ppc * 0.036, L.glasses);
    strokeCells(ctx, ppc, [[0.42, 0.24], [0.45, 0.255], [0.49, 0.245]], ppc * 0.006, ppc * 0.016);
  } else {
    dot(ctx, ppc * 0.465, ppc * 0.255, ppc * 0.04, L.glasses);
    gleam(ctx, ppc * 0.453, ppc * 0.243, ppc * 0.011);
  }
  // Бровь: кустистая, седая; у сердитого — сдвинута к носу.
  const brow =
    kind === 'angry'
      ? cellPen(ppc, [[0.39, 0.16], [0.47, 0.19], [0.53, 0.225, 1], [0.47, 0.215], [0.39, 0.19]])
      : cellPen(ppc, [[0.39, 0.19], [0.45, 0.165], [0.52, 0.18, 1], [0.46, 0.19], [0.4, 0.205]]);
  K.shape(ctx, rng, brow, palette.derived.hair, inkW(ppc, 0.4), { rim: 0, ink: { pools: false } });
  // Рот.
  if (kind === 'sleep') {
    const mouth = K.ellipsePath(ppc * 0.47, ppc * 0.47, ppc * 0.025, ppc * 0.03, 12);
    K.shape(ctx, rng, mouth, palette.alarm.dark, inkW(ppc, 0.35), { rim: 0, ink: { pools: false } });
  } else if (kind === 'angry') {
    strokeCells(ctx, ppc, [[0.41, 0.47], [0.46, 0.455], [0.52, 0.475]], ppc * 0.008, ppc * 0.022);
    strokeCells(ctx, ppc, [[0.42, 0.485], [0.5, 0.49]], ppc * 0.004, ppc * 0.01, palette.derived.paperWhite);
  } else {
    strokeCells(ctx, ppc, [[0.41, 0.455], [0.46, 0.45], [0.5, 0.47]], ppc * 0.006, ppc * 0.02);
  }
}

/** Огромное ухо с розовым внутри. Основание — снизу слева, ухо смотрит вверх. */
export function drawLibEar(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const ear = cellPen(ppc, [
    [0.07, 0.39],
    [0.03, 0.25],
    [0.05, 0.12],
    [0.13, 0.035],
    [0.23, 0.03],
    [0.3, 0.1],
    [0.32, 0.22],
    [0.27, 0.33],
    [0.18, 0.4],
    [0.11, 0.43],
  ]);
  K.shape(ctx, rng, ear, L.skin, inkW(ppc, 0.6), { rim: ppc * 0.015 });
  const inner = cellPen(ppc, [
    [0.1, 0.34],
    [0.08, 0.22],
    [0.11, 0.12],
    [0.17, 0.08],
    [0.24, 0.1],
    [0.26, 0.2],
    [0.22, 0.29],
    [0.15, 0.34],
  ]);
  K.shape(ctx, rng, inner, L.earInside, inkW(ppc, 0.3), { rim: 0, ink: { pools: false } });
  strokeCells(ctx, ppc, [[0.12, 0.3], [0.13, 0.2], [0.18, 0.13]], ppc * 0.004, ppc * 0.012, palette.inkFaded);
}

/** Рукав и рука с длинными пальцами. Плечо — сверху, рука висит вниз. */
export function drawLibArm(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  // Длинные пальцы.
  for (const [x0, len, bend] of [
    [0.1, 0.13, -0.02],
    [0.135, 0.15, 0],
    [0.17, 0.14, 0.015],
    [0.2, 0.11, 0.03],
  ] as const) {
    strokeCells(ctx, ppc, [[x0, 0.44], [x0 + bend * 0.5, 0.44 + len * 0.6], [x0 + bend, 0.44 + len]], ppc * 0.026, ppc * 0.034, palette.ink, 0.05);
    strokeCells(ctx, ppc, [[x0, 0.445], [x0 + bend * 0.5, 0.44 + len * 0.6], [x0 + bend, 0.43 + len]], ppc * 0.014, ppc * 0.02, L.skin, 0.05);
  }
  const palm = cellPen(ppc, [[0.08, 0.42], [0.22, 0.42], [0.21, 0.5], [0.15, 0.53], [0.09, 0.5]]);
  K.shape(ctx, rng, palm, L.skin, inkW(ppc, 0.45), { rim: 0, ink: { pools: false } });
  const sleeve = cellPen(ppc, [
    [0.08, 0.02],
    [0.2, 0.02],
    [0.22, 0.2],
    [0.27, 0.42, 1],
    [0.03, 0.44, 1],
    [0.05, 0.22],
  ]);
  K.shape(ctx, rng, sleeve, L.robe, inkW(ppc, 0.6), { rim: ppc * 0.02, streak: Math.PI / 2 });
  const cuff = cellPen(ppc, [[0.03, 0.38, 1], [0.26, 0.37, 1], [0.27, 0.44, 1], [0.03, 0.45, 1]]);
  K.shape(ctx, rng, cuff, L.trim, inkW(ppc, 0.45), { rim: 0, ink: { pools: false } });
  strokeCells(ctx, ppc, [[0.13, 0.08], [0.12, 0.2], [0.14, 0.32]], ppc * 0.005, ppc * 0.014, L.robeDark, 0.3);
}

/** Связка ключей на кольце. */
export function drawKeys(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const ring = K.ellipsePath(ppc * 0.12, ppc * 0.075, ppc * 0.05, ppc * 0.045, 16);
  K.nibStroke(ctx, ring, ppc * 0.012, ppc * 0.024, K.NIB_ANGLE, { closed: true, color: L.keys });
  K.nibStroke(ctx, ring, ppc * 0.003, ppc * 0.008, K.NIB_ANGLE, { closed: true, color: palette.ink, alpha: 0.7 });
  for (const [x, len, a] of [
    [0.08, 0.24, 0.25],
    [0.12, 0.27, 0],
    [0.16, 0.22, -0.3],
  ] as const) {
    ctx.save();
    ctx.translate(x * ppc, 0.11 * ppc);
    ctx.rotate(a);
    const shaft = K.rectPath(-ppc * 0.011, 0, ppc * 0.022, len * ppc);
    K.shape(ctx, rng, shaft, L.keys, inkW(ppc, 0.25), { rim: 0, mottle: 0, ink: { pools: false } });
    const bit = K.rectPath(0, len * ppc - ppc * 0.05, ppc * 0.04, ppc * 0.035);
    K.shape(ctx, rng, bit, L.keys, inkW(ppc, 0.25), { rim: 0, mottle: 0, ink: { pools: false } });
    ctx.restore();
  }
}

export function drawLibSlipper(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const slipper = cellPen(ppc, [
    [0.02, 0.13],
    [0.04, 0.07],
    [0.13, 0.045],
    [0.23, 0.06],
    [0.3, 0.1],
    [0.29, 0.15],
    [0.04, 0.165],
  ]);
  K.shape(ctx, rng, slipper, palette.derived.slipper, inkW(ppc, 0.5), { rim: ppc * 0.01 });
  dot(ctx, ppc * 0.26, ppc * 0.075, ppc * 0.032, L.trim);
  K.inkOutline(ctx, rng, K.ellipsePath(ppc * 0.26, ppc * 0.075, ppc * 0.032, ppc * 0.032, 12), inkW(ppc, 0.3), { closed: true, pools: false });
}

/** Огромный штемпель — им штампуют «Ungültig!». */
export function drawLibStamp(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const knob = K.ellipsePath(ppc * 0.13, ppc * 0.06, ppc * 0.06, ppc * 0.05, 16);
  K.shape(ctx, rng, K.rectPath(ppc * 0.11, ppc * 0.08, ppc * 0.04, ppc * 0.13), palette.shelf.woodLight, inkW(ppc, 0.35), { rim: 0 });
  K.shape(ctx, rng, knob, palette.shelf.wood, inkW(ppc, 0.4), { rim: 0 });
  K.shape(ctx, rng, K.roundRectPath(ppc * 0.03, ppc * 0.2, ppc * 0.2, ppc * 0.09, ppc * 0.015), palette.shelf.woodLight, inkW(ppc, 0.45), { rim: 0 });
  K.shape(ctx, rng, K.rectPath(ppc * 0.04, ppc * 0.29, ppc * 0.18, ppc * 0.03), palette.alarm.base, inkW(ppc, 0.3), { rim: 0, mottle: 0 });
}
