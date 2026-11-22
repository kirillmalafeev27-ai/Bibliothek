/**
 * Карта сокровищ из трёх рваных листов (план, 7.5.7). Один рисунок на всю карту —
 * тропа пунктиром, холмы, крест, роза ветров; листы — его куски. Так листы на полу,
 * в плашке и на экране итогов складываются в одну и ту же карту.
 */
import { palette } from '../../config/palette';
import * as K from '../../shared/manuscriptKit';

/** Карта в долях: ширина 3 (три листа по ширине), высота 2. */
const MAP_H = 2;

/** Неровная граница разрыва между листами i и i+1 (x в долях карты). */
function tearLine(i: number): K.Vec[] {
  const rng = K.mulberry32(0x7ea4 + i * 31);
  const pts: K.Vec[] = [];
  const x0 = i + 1;
  for (let k = 0; k <= 9; k++) {
    const y = (k / 9) * MAP_H;
    pts.push({ x: x0 + (rng() - 0.5) * 0.22 + (k % 2 === 0 ? 0.06 : -0.06), y });
  }
  return pts;
}

/** Контур листа `piece` в долях карты. */
export function piecePath(piece: number): K.Vec[] {
  const rng = K.mulberry32(0x51a3 + piece);
  const left = piece === 0 ? null : tearLine(piece - 1);
  const right = piece === 2 ? null : tearLine(piece);
  const out: K.Vec[] = [];
  const edge = (a: K.Vec, b: K.Vec, steps: number, amp: number): void => {
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      out.push({ x: a.x + (b.x - a.x) * t + (rng() - 0.5) * amp, y: a.y + (b.y - a.y) * t + (rng() - 0.5) * amp });
    }
  };
  const x0 = piece;
  const x1 = piece + 1;
  // Верхний край.
  edge({ x: left ? (left[0] as K.Vec).x : x0 + 0.04, y: 0.05 }, { x: right ? (right[0] as K.Vec).x : x1 - 0.04, y: 0.05 }, 5, 0.04);
  // Правый край.
  if (right) for (const p of right) out.push({ x: p.x, y: Math.min(MAP_H - 0.05, Math.max(0.05, p.y)) });
  else edge({ x: x1 - 0.04, y: 0.05 }, { x: x1 - 0.04, y: MAP_H - 0.05 }, 6, 0.04);
  // Нижний край.
  edge(
    { x: right ? (right[right.length - 1] as K.Vec).x : x1 - 0.04, y: MAP_H - 0.05 },
    { x: left ? (left[left.length - 1] as K.Vec).x : x0 + 0.04, y: MAP_H - 0.05 },
    5,
    0.04,
  );
  // Левый край.
  if (left) for (let k = left.length - 1; k >= 0; k--) out.push({ x: (left[k] as K.Vec).x, y: Math.min(MAP_H - 0.05, Math.max(0.05, (left[k] as K.Vec).y)) });
  else edge({ x: x0 + 0.04, y: MAP_H - 0.05 }, { x: x0 + 0.04, y: 0.05 }, 6, 0.04);
  return out;
}

/** Рисунок карты целиком в масштабе `u` пикселей на долю. */
function drawMapInk(ctx: CanvasRenderingContext2D, u: number): void {
  const rng = K.mulberry32(0xa11);
  const ink = palette.page.map;
  const lw = Math.max(0.8, u * 0.022);
  // Тропа пунктиром от левого нижнего угла к кресту.
  const trail = K.spline(
    [
      { x: 0.25 * u, y: 1.7 * u },
      { x: 0.7 * u, y: 1.25 * u },
      { x: 1.3 * u, y: 1.55 * u },
      { x: 1.75 * u, y: 0.95 * u },
      { x: 2.3 * u, y: 1.25 * u },
      { x: 2.62 * u, y: 0.62 * u },
    ],
    false,
    14,
  );
  const dashes = K.resample(trail, u * 0.07, false);
  for (let i = 0; i + 1 < dashes.length; i += 2) {
    K.nibStroke(ctx, [dashes[i] as K.Vec, dashes[i + 1] as K.Vec], lw * 0.6, lw * 1.4, K.NIB_ANGLE, { color: ink });
  }
  // Холмики.
  for (const [x, y, s] of [
    [0.55, 0.55, 0.22],
    [0.85, 0.48, 0.17],
    [1.45, 0.7, 0.2],
    [2.05, 1.7, 0.18],
  ] as const) {
    const hill = K.spline(
      [
        { x: (x - s) * u, y: y * u },
        { x: x * u, y: (y - s * 0.8) * u },
        { x: (x + s) * u, y: y * u },
      ],
      false,
      8,
    );
    K.nibStroke(ctx, hill, lw * 0.5, lw * 1.3, K.NIB_ANGLE, { color: ink });
  }
  // Деревца.
  for (const [x, y] of [
    [1.15, 1.05],
    [1.25, 1.12],
    [2.4, 1.62],
  ] as const) {
    K.inkOutline(ctx, rng, K.ellipsePath(x * u, (y - 0.08) * u, 0.07 * u, 0.09 * u, 12), lw * 0.8, { color: ink, pools: false });
    K.nibStroke(ctx, [{ x: x * u, y: y * u }, { x: x * u, y: (y + 0.08) * u }], lw * 0.5, lw, K.NIB_ANGLE, { color: ink });
  }
  // Крест — кармином: здесь сокровище.
  const cx = 2.62 * u;
  const cy = 0.55 * u;
  const r = 0.12 * u;
  for (const [a, b] of [
    [-1, -1],
    [1, -1],
  ] as const) {
    K.nibStroke(ctx, [{ x: cx + a * r, y: cy + b * r }, { x: cx - a * r, y: cy - b * r }], lw * 1.1, lw * 2.4, K.NIB_ANGLE, { color: palette.rubric });
  }
  // Роза ветров.
  const rx = 0.45 * u;
  const ry = 1.15 * u;
  K.inkOutline(ctx, rng, K.starPath(rx, ry, 0.16 * u, 4, 0.3), lw * 0.8, { color: ink, pools: false });
  K.inkOutline(ctx, rng, K.ellipsePath(rx, ry, 0.05 * u, 0.05 * u, 10), lw * 0.6, { color: ink, pools: false });
}

/**
 * Рисует лист карты `piece` (0–2) в прямоугольнике (0, 0, size, size): кусок пергамента,
 * чернильный рисунок, зелёная ленточка-закладка. `ribbon` — рисовать ли закладку.
 */
export function drawPagePiece(ctx: CanvasRenderingContext2D, piece: number, size: number, ribbon = true): void {
  const rng = K.mulberry32(0x9a9e + piece);
  // Масштаб: лист (1 × 2 доли) вписывается в квадрат с полями и лёгким наклоном.
  const u = size * 0.44;
  const ox = size / 2 - (piece + 0.5) * u;
  const oy = size / 2 - u;
  const tilt = [-0.12, 0.07, -0.05][piece] ?? 0;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(tilt);
  ctx.translate(-size / 2, -size / 2);
  const outline = K.transformPath(piecePath(piece), { sx: u, sy: u, dx: ox, dy: oy });
  ctx.save();
  ctx.beginPath();
  K.tracePath(ctx, outline, true);
  ctx.fillStyle = palette.page.paper;
  ctx.fill();
  ctx.clip();
  // Потемневший край куска.
  const b = K.pathBounds(outline);
  const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * 0.2, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) * 0.62);
  g.addColorStop(0, K.withAlpha(palette.parchmentShade, 0));
  g.addColorStop(1, K.withAlpha(palette.parchmentEdge, 0.75));
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.translate(ox, oy);
  drawMapInk(ctx, u);
  ctx.restore();
  K.inkOutline(ctx, rng, outline, Math.max(1, size * 0.03), { color: palette.ink, pools: false });
  if (ribbon) {
    // Ленточка-закладка ярь-медянкой — то, что можно взять.
    const rx = b.x + b.w * 0.62;
    const top = b.y - size * 0.02;
    const ribbonPath = K.pen([
      [rx, top, 1],
      [rx + size * 0.1, top, 1],
      [rx + size * 0.1, top + size * 0.34, 1],
      [rx + size * 0.05, top + size * 0.27, 1],
      [rx, top + size * 0.34, 1],
    ]);
    K.shape(ctx, rng, ribbonPath, palette.take.base, Math.max(1, size * 0.025), { rim: size * 0.015, ink: { pools: false } });
  }
  ctx.restore();
}
