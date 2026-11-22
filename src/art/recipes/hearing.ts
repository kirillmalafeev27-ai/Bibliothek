/**
 * Слух на экране (план, 8.2): нимб, кольцо громкого слуха, маникулы, отпечатки тапочек,
 * след героя, прицел и путь броска, вспышка «услышал». На поле золото — только слух,
 * кармин — только тревога. Линии слуха — густые чернила тёмного золота: они должны быть
 * видны на плитке любого тона (тест 8.4).
 */
import { palette } from '../../config/palette';
import * as K from '../../shared/manuscriptKit';
import { LOUD_RING_PAD } from '../ArtFactory';
import { cellPen, dot, inkW } from './common';

const GOLD_INK = palette.derived.goldInk;

/** Нимб радиусом hearR: контур пером, полоса сусального золота, золотая заливка 15%. */
export function drawHalo(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number, sizeCells: number, radiusCells: number): void {
  const c = (sizeCells * ppc) / 2;
  const r = radiusCells * ppc;
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fillStyle = K.withAlpha(palette.gold.base, 0.15);
  ctx.fill();
  ctx.restore();
  // Полоса сусального золота внутри контура.
  const band = ppc * 0.05;
  const outer = K.arcPath(c, c, r - ppc * 0.012, 0, Math.PI * 2 - 1e-4, 5);
  const inner = K.arcPath(c, c, r - ppc * 0.012 - band, 0, Math.PI * 2 - 1e-4, 5);
  ctx.save();
  ctx.beginPath();
  K.tracePath(ctx, outer, true);
  K.tracePath(ctx, inner.slice().reverse(), true);
  ctx.clip('evenodd');
  K.goldLeaf(ctx, rng, K.rectPath(c - r - 4, c - r - 4, r * 2 + 8, r * 2 + 8), { cracks: 20 });
  ctx.restore();
  // Точечная чеканка по золоту.
  const dots = Math.round((Math.PI * 2 * r) / (ppc * 0.16));
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * Math.PI * 2;
    dot(ctx, c + Math.cos(a) * (r - ppc * 0.037), c + Math.sin(a) * (r - ppc * 0.037), ppc * 0.008, palette.gold.dark);
  }
  // Контур пером — густым тёмным золотом.
  const ring = K.wobble(rng, K.arcPath(c, c, r, 0, Math.PI * 2 - 1e-4, 4), ppc * 0.004, true, 60);
  K.nibStroke(ctx, ring, ppc * 0.045, ppc * 0.07, K.NIB_ANGLE, { closed: true, color: GOLD_INK });
  const innerLine = K.arcPath(c, c, r - ppc * 0.012 - band, 0, Math.PI * 2 - 1e-4, 5);
  K.nibStroke(ctx, innerLine, ppc * 0.006, ppc * 0.014, K.NIB_ANGLE, { closed: true, color: GOLD_INK, alpha: 0.8 });
}

/** Кольцо громкого слуха: тонкий золотой пунктир радиусом loudR. */
export function drawLoudRing(ctx: CanvasRenderingContext2D, radius: number, ppc: number): void {
  const c = (radius + LOUD_RING_PAD) * ppc;
  K.soundRings(ctx, radius * ppc, 'dashed', {
    cx: c,
    cy: c,
    color: GOLD_INK,
    wMax: ppc * 0.06,
    wMin: ppc * 0.04,
    dash: ppc * 0.22,
    gap: ppc * 0.12,
    seed: Math.round(radius * 10),
  });
}

/** Маникула ☞: чернильная (бродит), золотая (учуял), кармином (бежит на звук). */
export function drawManicule(ctx: CanvasRenderingContext2D, ppc: number, tone: 'ink' | 'gold' | 'alarm'): void {
  const size = 0.92 * ppc;
  const color = tone === 'alarm' ? palette.alarm.base : palette.derived.paperWhite;
  K.manicule(ctx, size, color, {
    goldFill: tone === 'gold',
    ink: palette.ink,
    line: inkW(ppc, 1.65),
    cuff: tone === 'alarm' ? palette.alarm.light : palette.derived.paperWhite,
    seed: tone === 'ink' ? 11 : tone === 'gold' ? 12 : 13,
  });
}

/** Отпечаток тапочки библиотекаря: носок вверх (по направлению пути). */
export function drawSlipperPrint(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const print = cellPen(ppc, [
    [0.18, 0.03],
    [0.26, 0.08],
    [0.27, 0.2],
    [0.24, 0.3],
    [0.18, 0.32],
    [0.12, 0.3],
    [0.09, 0.2],
    [0.1, 0.08],
  ]);
  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  K.tracePath(ctx, print, true);
  ctx.fillStyle = palette.librarian.robeDark;
  ctx.fill();
  ctx.restore();
  // Стёжка по краю.
  const inner = K.resample(K.transformPath(print, { sx: 0.8, sy: 0.84, ox: 0.18 * ppc, oy: 0.17 * ppc }), ppc * 0.03, true);
  for (let i = 0; i + 1 < inner.length; i += 2) {
    K.nibStroke(ctx, [inner[i] as K.Vec, inner[i + 1] as K.Vec], 0.5, ppc * 0.01, K.NIB_ANGLE, { color: palette.derived.paperWhite, alpha: 0.8 });
  }
  K.inkOutline(ctx, rng, print, inkW(ppc, 0.3), { closed: true, pools: false, alpha: 0.7 });
}

/** След следующего шага героя: отпечаток сапога, чернильный или кармином. */
export function drawFootPrint(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number, alarm: boolean): void {
  const sole = cellPen(ppc, [
    [0.23, 0.04],
    [0.31, 0.08],
    [0.33, 0.17],
    [0.3, 0.25],
    [0.16, 0.25],
    [0.13, 0.17],
    [0.15, 0.08],
  ]);
  const heel = cellPen(ppc, [
    [0.16, 0.29],
    [0.3, 0.29],
    [0.29, 0.37],
    [0.23, 0.39],
    [0.17, 0.37],
  ]);
  const fill = alarm ? palette.alarm.base : palette.ink;
  for (const part of [sole, heel]) {
    ctx.save();
    ctx.globalAlpha = alarm ? 0.95 : 0.6;
    ctx.beginPath();
    K.tracePath(ctx, part, true);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
    K.inkOutline(ctx, rng, part, inkW(ppc, alarm ? 0.45 : 0.3), { closed: true, pools: false, color: alarm ? palette.alarm.dark : palette.ink });
  }
  if (alarm) {
    // Предостерегающие штрихи вокруг красного следа.
    for (const a of [-2.4, -1.57, -0.74]) {
      const cx = ppc * 0.23;
      const cy = ppc * 0.21;
      K.nibStroke(
        ctx,
        [
          { x: cx + Math.cos(a) * ppc * 0.19, y: cy + Math.sin(a) * ppc * 0.19 },
          { x: cx + Math.cos(a) * ppc * 0.24, y: cy + Math.sin(a) * ppc * 0.24 },
        ],
        ppc * 0.01,
        ppc * 0.024,
        K.NIB_ANGLE,
        { color: palette.alarm.base },
      );
    }
  }
}

export function drawRouteDot(ctx: CanvasRenderingContext2D, ppc: number): void {
  dot(ctx, ppc * 0.07, ppc * 0.07, ppc * 0.026, palette.ink);
}

export function drawRouteEnd(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const c = ppc * 0.17;
  K.inkOutline(ctx, rng, K.ellipsePath(c, c, ppc * 0.12, ppc * 0.12, 20), inkW(ppc, 0.35), { closed: true, pools: false });
  dot(ctx, c, c, ppc * 0.03);
}

/** Прицел броска: чернильное перекрестие или кармин, если туда нельзя. */
export function drawAim(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number, ok: boolean): void {
  const c = ppc * 0.48;
  const r = ppc * 0.36;
  const color = ok ? palette.ink : palette.alarm.base;
  if (ok) {
    K.inkOutline(ctx, rng, K.ellipsePath(c, c, r, r, 40), inkW(ppc, 0.6), { closed: true, pools: false, color });
    K.inkOutline(ctx, rng, K.ellipsePath(c, c, r * 0.5, r * 0.5, 30), inkW(ppc, 0.35), { closed: true, pools: false, color });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      K.nibStroke(
        ctx,
        [
          { x: c + Math.cos(a) * r * 0.75, y: c + Math.sin(a) * r * 0.75 },
          { x: c + Math.cos(a) * r * 1.22, y: c + Math.sin(a) * r * 1.22 },
        ],
        ppc * 0.012,
        ppc * 0.03,
        K.NIB_ANGLE,
        { color },
      );
    }
    dot(ctx, c, c, ppc * 0.02, color);
  } else {
    K.soundRings(ctx, r, 'dashed', { cx: c, cy: c, color, wMax: ppc * 0.03, wMin: ppc * 0.014 });
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      K.nibStroke(
        ctx,
        [
          { x: c - Math.cos(a) * r * 0.5, y: c - Math.sin(a) * r * 0.5 },
          { x: c + Math.cos(a) * r * 0.5, y: c + Math.sin(a) * r * 0.5 },
        ],
        ppc * 0.014,
        ppc * 0.034,
        K.NIB_ANGLE,
        { color },
      );
    }
  }
}

export function drawAimDot(ctx: CanvasRenderingContext2D, ppc: number): void {
  dot(ctx, ppc * 0.1, ppc * 0.1, ppc * 0.03, palette.ink);
}

/** Путь библиотекаря к словарю: шеврон по направлению бега (вправо в текстуре). */
export function drawPathMark(ctx: CanvasRenderingContext2D, ppc: number, alarm: boolean): void {
  const s = ppc * 0.26;
  const color = alarm ? palette.alarm.base : palette.ink;
  K.nibStroke(
    ctx,
    [
      { x: s * 0.28, y: s * 0.2 },
      { x: s * 0.72, y: s * 0.5 },
      { x: s * 0.28, y: s * 0.8 },
    ],
    ppc * 0.018,
    ppc * 0.04,
    K.NIB_ANGLE,
    { color },
  );
}

/** Вспышка «услышал» у уха: короткие золотые росчерки. */
export function drawHeardFlash(ctx: CanvasRenderingContext2D, ppc: number): void {
  const c = ppc * 0.35;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
    K.nibStroke(
      ctx,
      [
        { x: c + Math.cos(a) * ppc * 0.13, y: c + Math.sin(a) * ppc * 0.13 },
        { x: c + Math.cos(a) * ppc * 0.3, y: c + Math.sin(a) * ppc * 0.3 },
      ],
      ppc * 0.014,
      ppc * 0.034,
      K.NIB_ANGLE,
      { color: i % 2 ? palette.gold.base : GOLD_INK },
    );
  }
}
