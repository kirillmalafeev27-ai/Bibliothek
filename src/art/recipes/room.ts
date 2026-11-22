/**
 * Запечённый фон комнаты (план, 7.5.1–7.5.4, 7.5.6): плитка двух тонов со швами,
 * скрипучие половицы, высокие стеллажи по краю, стрельчатые окна с ультрамариновой
 * ночью и звёздами, часы на дальней стене, каменный проём двери с тёплым светом.
 * Стены рисуются по сторонам экрана: верхняя — лицом к зрителю, остальные — сверху.
 */
import { palette } from '../../config/palette';
import type { RoomView } from '../../render/room';
import { tileOf, wallSideOf } from '../../render/room';
import * as K from '../../shared/manuscriptKit';
import { dot, inkW } from './common';

const SP = palette.spines;

function cellRng(seed: number, x: number, y: number, salt = 0): K.Rand {
  return K.mulberry32((seed ^ Math.imul(x + 31, 73856093) ^ Math.imul(y + 17, 19349663) ^ Math.imul(salt + 1, 83492791)) >>> 0);
}

// ───────────────────────────── пол ─────────────────────────────

/** Плитка: чуть неровный квадрат, плоская темпера, редкий узор и щербинки. */
function drawTile(ctx: CanvasRenderingContext2D, rng: K.Rand, px: number, py: number, ppc: number, light: boolean): void {
  const g = ppc * 0.04;
  const j = ppc * 0.012;
  const pts: K.Vec[] = [
    { x: px + g + (rng() - 0.5) * j, y: py + g + (rng() - 0.5) * j },
    { x: px + ppc - g + (rng() - 0.5) * j, y: py + g + (rng() - 0.5) * j },
    { x: px + ppc - g + (rng() - 0.5) * j, y: py + ppc - g + (rng() - 0.5) * j },
    { x: px + g + (rng() - 0.5) * j, y: py + ppc - g + (rng() - 0.5) * j },
  ];
  // Плитка с чуть скруглёнными углами: квадрат, а не восьмиугольник.
  const r = ppc * 0.05;
  const rounded: K.Vec[] = [];
  for (let i = 0; i < 4; i++) {
    const a = pts[(i + 3) % 4] as K.Vec;
    const b = pts[i] as K.Vec;
    const c = pts[(i + 1) % 4] as K.Vec;
    const da = Math.hypot(a.x - b.x, a.y - b.y);
    const dc = Math.hypot(c.x - b.x, c.y - b.y);
    rounded.push({ x: b.x + ((a.x - b.x) / da) * r, y: b.y + ((a.y - b.y) / da) * r });
    rounded.push({ x: b.x + ((c.x - b.x) / dc) * r, y: b.y + ((c.y - b.y) / dc) * r });
  }
  const tile = K.wobble(rng, K.resample(K.chaikin(rounded, 2, true), ppc * 0.05, true), ppc * 0.005, true);
  const base = light ? palette.floor.a : palette.floor.b;
  K.tempera(ctx, rng, tile, base, { rim: ppc * 0.035, mottle: 0.55, streak: rng() * Math.PI });
  // Энкаустический узор на части плиток — тихо, тоном той же краски.
  if (rng() < 0.28) {
    const cx = px + ppc / 2;
    const cy = py + ppc / 2;
    const tone = light ? K.blend(base, palette.floor.b, 0.45) : K.blend(base, palette.floor.a, 0.4);
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const petal = K.ellipsePath(cx + Math.cos(a) * ppc * 0.12, cy + Math.sin(a) * ppc * 0.12, ppc * 0.1, ppc * 0.06, 12, a);
      ctx.beginPath();
      K.tracePath(ctx, petal, true);
      ctx.fillStyle = tone;
      ctx.fill();
    }
    dot(ctx, cx, cy, ppc * 0.035, tone);
    ctx.restore();
  }
  // Щербинка или трещинка.
  if (rng() < 0.22) {
    const x0 = px + ppc * (0.2 + rng() * 0.6);
    const y0 = py + ppc * (0.2 + rng() * 0.6);
    const crack = [
      { x: x0, y: y0 },
      { x: x0 + ppc * (rng() - 0.5) * 0.18, y: y0 + ppc * (0.06 + rng() * 0.08) },
      { x: x0 + ppc * (rng() - 0.5) * 0.24, y: y0 + ppc * (0.12 + rng() * 0.1) },
    ];
    K.nibStroke(ctx, crack, ppc * 0.004, ppc * 0.012, K.NIB_ANGLE, { color: palette.inkFaded, alpha: 0.45, taper: 0.3 });
  }
}

/** Скрипучая половица: доски с трещинами и шляпками гвоздей (7.5.2). */
function drawPlanks(ctx: CanvasRenderingContext2D, rng: K.Rand, px: number, py: number, ppc: number): void {
  const g = ppc * 0.03;
  const n = 3;
  const h = (ppc - g * 2) / n;
  for (let i = 0; i < n; i++) {
    const y = py + g + i * h;
    const plank = K.wobble(rng, K.resample(K.rectPath(px + g, y + ppc * 0.008, ppc - g * 2, h - ppc * 0.016), ppc * 0.05, true), ppc * 0.004, true);
    const tone = K.blend(palette.squeak.plank, i % 2 ? palette.shelf.woodLight : palette.squeak.plank, 0.3 + rng() * 0.2);
    K.tempera(ctx, rng, plank, tone, { rim: ppc * 0.02, mottle: 0.5, streak: 0 });
    // Волокна дерева.
    for (let k = 0; k < 3; k++) {
      const yy = y + h * (0.25 + k * 0.25) + (rng() - 0.5) * h * 0.1;
      const grain = K.spline(
        [
          { x: px + g + ppc * 0.05, y: yy },
          { x: px + ppc * (0.35 + rng() * 0.2), y: yy + (rng() - 0.5) * h * 0.25 },
          { x: px + ppc - g - ppc * 0.05, y: yy + (rng() - 0.5) * h * 0.2 },
        ],
        false,
        8,
      );
      K.nibStroke(ctx, grain, ppc * 0.003, ppc * 0.008, K.NIB_ANGLE, { color: palette.ink, alpha: 0.28, taper: 0.4 });
    }
    // Шляпки гвоздей на концах доски.
    for (const fx of [0.11, 0.89]) {
      dot(ctx, px + ppc * fx, y + h / 2, ppc * 0.024, palette.squeak.nail);
      dot(ctx, px + ppc * fx - ppc * 0.007, y + h / 2 - ppc * 0.007, ppc * 0.008, palette.derived.paperWhite);
    }
    K.inkOutline(ctx, rng, plank, inkW(ppc, 0.42), { closed: true, pools: false });
  }
  // Трещина через доску — знак, что пол скрипит.
  const cy = py + g + h * (1 + Math.floor(rng() * 2)) - h * 0.5;
  const crack: K.Vec[] = [];
  let x = px + ppc * (0.22 + rng() * 0.1);
  for (let k = 0; k < 6; k++) {
    crack.push({ x, y: cy + (rng() - 0.5) * h * 0.4 });
    x += ppc * (0.07 + rng() * 0.04);
  }
  K.nibStroke(ctx, crack, ppc * 0.006, ppc * 0.02, K.NIB_ANGLE, { color: palette.squeak.crack, taper: 0.25 });
}

// ───────────────────────────── стены ─────────────────────────────

/** Ряд корешков на полке дальней стены. */
function spineRow(ctx: CanvasRenderingContext2D, rng: K.Rand, x0: number, x1: number, yBase: number, hMax: number, ppc: number): void {
  let x = x0;
  while (x < x1 - ppc * 0.03) {
    const w = Math.min(x1 - x, ppc * (0.045 + rng() * 0.045));
    const h = hMax * (0.72 + rng() * 0.28);
    const color = K.pick(rng, SP);
    const spine = K.rectPath(x, yBase - h, w - ppc * 0.006, h);
    K.tempera(ctx, rng, spine, color, { rim: 0, mottle: 0.3 });
    // Светлые полоски названий.
    if (w > ppc * 0.04) {
      ctx.fillStyle = K.withAlpha(palette.parchment, 0.55);
      ctx.fillRect(x + w * 0.2, yBase - h * 0.78, w * 0.5, ppc * 0.012);
      if (rng() < 0.5) ctx.fillRect(x + w * 0.2, yBase - h * 0.3, w * 0.5, ppc * 0.01);
    }
    x += w;
    if (rng() < 0.08) x += ppc * 0.04;
  }
}

/** Стрельчатое окно с ультрамариновой ночью и звёздами (7.5.4). */
function drawWindow(ctx: CanvasRenderingContext2D, rng: K.Rand, px: number, py: number, ppc: number, moon: boolean): void {
  const w = ppc * 0.5;
  const h = ppc * 0.74;
  const x = px + (ppc - w) / 2;
  const y = py + ppc * 0.13;
  const surround = K.lancetPath(x - ppc * 0.06, y - ppc * 0.04, w + ppc * 0.12, h + ppc * 0.08);
  K.shape(ctx, rng, surround, palette.derived.stoneLight, inkW(ppc, 0.6), { rim: ppc * 0.02 });
  const glass = K.lancetPath(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  K.tracePath(ctx, glass, true);
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, palette.derived.nightDeep);
  sky.addColorStop(0.7, palette.window.night);
  sky.addColorStop(1, palette.derived.nightGlow);
  ctx.fillStyle = sky;
  ctx.fill();
  ctx.clip();
  // Светлые звёзды и луна.
  for (let i = 0; i < 6; i++) {
    const sx = x + w * (0.15 + rng() * 0.7);
    const sy = y + h * (0.12 + rng() * 0.6);
    const r = ppc * (0.018 + rng() * 0.02);
    ctx.beginPath();
    K.tracePath(ctx, K.starPath(sx, sy, r, 4, 0.35, rng() * 0.5), true);
    ctx.fillStyle = palette.window.star;
    ctx.fill();
  }
  if (moon) {
    const mx = x + w * 0.66;
    const my = y + h * 0.3;
    const mr = ppc * 0.075;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = palette.derived.moon;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = palette.window.night;
    ctx.fill();
  }
  // Свинцовый переплёт ромбами.
  ctx.strokeStyle = K.withAlpha(palette.ink, 0.7);
  ctx.lineWidth = Math.max(0.8, ppc * 0.008);
  const step = w / 3;
  ctx.beginPath();
  for (let d = -h; d < w + h; d += step) {
    ctx.moveTo(x + d, y);
    ctx.lineTo(x + d + h, y + h);
    ctx.moveTo(x + d + h, y);
    ctx.lineTo(x + d, y + h);
  }
  ctx.stroke();
  ctx.restore();
  K.inkOutline(ctx, rng, glass, inkW(ppc, 0.55), { closed: true, pools: false });
  // Подоконник.
  K.shape(ctx, rng, K.rectPath(x - ppc * 0.09, y + h + ppc * 0.01, w + ppc * 0.18, ppc * 0.06), palette.derived.stoneLight, inkW(ppc, 0.45), { rim: 1 });
}

/** Высокие напольные часы — их маятник слышен в эмбиенте. */
function drawClock(ctx: CanvasRenderingContext2D, rng: K.Rand, px: number, py: number, ppc: number): void {
  const w = ppc * 0.44;
  const x = px + (ppc - w) / 2;
  const y = py + ppc * 0.1;
  const h = ppc * 0.9;
  const body = K.pen([
    [x + w * 0.1, y + h, 1],
    [x + w * 0.1, y + h * 0.36, 1],
    [x, y + h * 0.3, 1],
    [x, y + h * 0.12],
    [x + w / 2, y, 1],
    [x + w, y + h * 0.12],
    [x + w, y + h * 0.3, 1],
    [x + w * 0.9, y + h * 0.36, 1],
    [x + w * 0.9, y + h, 1],
  ]);
  K.shape(ctx, rng, body, palette.shelf.wood, inkW(ppc, 0.6), { rim: ppc * 0.02, streak: Math.PI / 2 });
  // Циферблат.
  const cx = x + w / 2;
  const cy = y + h * 0.2;
  const face = K.ellipsePath(cx, cy, w * 0.33, w * 0.33, 24);
  K.shape(ctx, rng, face, palette.derived.paperWhite, inkW(ppc, 0.45), { rim: 1, mottle: 0.2 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    dot(ctx, cx + Math.cos(a) * w * 0.25, cy + Math.sin(a) * w * 0.25, ppc * 0.007);
  }
  K.nibStroke(ctx, [{ x: cx, y: cy }, { x: cx + w * 0.12, y: cy - w * 0.14 }], 0.8, ppc * 0.016);
  K.nibStroke(ctx, [{ x: cx, y: cy }, { x: cx - w * 0.04, y: cy + w * 0.2 }], 0.8, ppc * 0.012);
  // Окошко маятника.
  const win = K.roundRectPath(x + w * 0.28, y + h * 0.46, w * 0.44, h * 0.42, w * 0.08);
  K.shape(ctx, rng, win, palette.shelf.top, inkW(ppc, 0.4), { rim: 1 });
  K.nibStroke(ctx, [{ x: cx, y: y + h * 0.48 }, { x: cx, y: y + h * 0.78 }], 0.8, ppc * 0.01, K.NIB_ANGLE, { color: palette.derived.brass });
  dot(ctx, cx, y + h * 0.8, ppc * 0.035, palette.derived.brass);
}

/** Шкаф с корешками на дальней стене. */
function drawWallCase(ctx: CanvasRenderingContext2D, rng: K.Rand, px: number, py: number, ppc: number): void {
  const x = px + ppc * 0.04;
  const w = ppc * 0.92;
  const y = py + ppc * 0.12;
  const h = ppc * 0.88;
  K.shape(ctx, rng, K.rectPath(x, y, w, h), palette.shelf.wood, inkW(ppc, 0.55), { rim: ppc * 0.02, streak: Math.PI / 2 });
  const rows = 3;
  const inner = h - ppc * 0.06;
  for (let r = 0; r < rows; r++) {
    const top = y + ppc * 0.04 + (inner / rows) * r;
    const base = top + inner / rows - ppc * 0.03;
    ctx.fillStyle = palette.shelf.top;
    ctx.fillRect(x + ppc * 0.05, top, w - ppc * 0.1, base - top);
    spineRow(ctx, rng, x + ppc * 0.06, x + w - ppc * 0.06, base, (base - top) * 0.92, ppc);
    K.nibStroke(ctx, [{ x: x + ppc * 0.03, y: base + ppc * 0.012 }, { x: x + w - ppc * 0.03, y: base + ppc * 0.012 }], ppc * 0.01, ppc * 0.024);
  }
}

/** Верх высокого стеллажа вдоль боковой стены: видны верхние обрезы книг. */
function drawSideCase(ctx: CanvasRenderingContext2D, rng: K.Rand, px: number, py: number, ppc: number, vertical: boolean): void {
  // Рисуем в локальных координатах «вдоль стены» и поворачиваем при необходимости.
  ctx.save();
  if (vertical) {
    ctx.translate(px + ppc, py);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(px, py);
  }
  const frame = K.rectPath(0, ppc * 0.04, ppc, ppc * 0.92);
  K.shape(ctx, rng, frame, palette.shelf.top, inkW(ppc, 0.5), { rim: ppc * 0.02, streak: 0 });
  let x = ppc * 0.04;
  while (x < ppc * 0.96) {
    const w = Math.min(ppc * 0.96 - x, ppc * (0.05 + rng() * 0.05));
    const depth = ppc * (0.5 + rng() * 0.22);
    const y0 = ppc * 0.12 + (ppc * 0.74 - depth) * rng();
    const cover = K.pick(rng, SP);
    ctx.fillStyle = cover;
    ctx.fillRect(x, y0, w - ppc * 0.006, depth);
    ctx.fillStyle = K.withAlpha(palette.parchmentShade, 0.6);
    ctx.fillRect(x + w * 0.22, y0 + ppc * 0.02, w * 0.48, depth - ppc * 0.04);
    x += w;
  }
  K.nibStroke(ctx, [{ x: 0, y: ppc * 0.9 }, { x: ppc, y: ppc * 0.9 }], ppc * 0.01, ppc * 0.03, K.NIB_ANGLE, { color: palette.shelf.woodLight });
  ctx.restore();
}

/** Угловой столб: камень с резной капителью. */
function drawPillar(ctx: CanvasRenderingContext2D, rng: K.Rand, px: number, py: number, ppc: number): void {
  const square = K.roundRectPath(px + ppc * 0.06, py + ppc * 0.06, ppc * 0.88, ppc * 0.88, ppc * 0.08);
  K.shape(ctx, rng, square, palette.derived.stone, inkW(ppc, 0.6), { rim: ppc * 0.03 });
  const boss = K.ellipsePath(px + ppc / 2, py + ppc / 2, ppc * 0.26, ppc * 0.26, 24);
  K.shape(ctx, rng, boss, palette.derived.stoneLight, inkW(ppc, 0.5), { rim: ppc * 0.02 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    K.nibStroke(
      ctx,
      [
        { x: px + ppc / 2 + Math.cos(a) * ppc * 0.08, y: py + ppc / 2 + Math.sin(a) * ppc * 0.08 },
        { x: px + ppc / 2 + Math.cos(a) * ppc * 0.22, y: py + ppc / 2 + Math.sin(a) * ppc * 0.22 },
      ],
      ppc * 0.004,
      ppc * 0.014,
      K.NIB_ANGLE,
      { color: palette.inkFaded },
    );
  }
}

/** Каменный проём двери и тёплый свет за ней (7.5.6). Локально: порог сверху, наружу — вниз. */
function drawDoorway(ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number): void {
  const frame = K.pen([
    [ppc * 0.02, 0, 1],
    [ppc * 0.98, 0, 1],
    [ppc * 0.98, ppc * 0.55],
    [ppc * 0.5, ppc * 1.0, 1],
    [ppc * 0.02, ppc * 0.55],
  ]);
  K.shape(ctx, rng, frame, palette.derived.stone, inkW(ppc, 0.6), { rim: ppc * 0.03 });
  // Тёплый свет снаружи: видно, когда дверь приоткрыта.
  const opening = K.pen([
    [ppc * 0.08, ppc * 0.02, 1],
    [ppc * 0.92, ppc * 0.02, 1],
    [ppc * 0.92, ppc * 0.52],
    [ppc * 0.5, ppc * 0.92, 1],
    [ppc * 0.08, ppc * 0.52],
  ]);
  ctx.save();
  ctx.beginPath();
  K.tracePath(ctx, opening, true);
  const glow = ctx.createLinearGradient(0, 0, 0, ppc);
  glow.addColorStop(0, palette.door.light);
  glow.addColorStop(1, palette.candle.flame);
  ctx.fillStyle = glow;
  ctx.fill();
  ctx.restore();
  K.inkOutline(ctx, rng, opening, inkW(ppc, 0.45), { closed: true, pools: false });
}

/** Полоска тёплого света из-под двери — на пол у порога. */
function drawDoorGlow(ctx: CanvasRenderingContext2D, ppc: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, -ppc * 0.42);
  g.addColorStop(0, K.withAlpha(palette.door.light, 0.85));
  g.addColorStop(1, K.withAlpha(palette.door.light, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(ppc * 0.1, 0);
  ctx.lineTo(ppc * 0.9, 0);
  ctx.lineTo(ppc * 1.02, -ppc * 0.42);
  ctx.lineTo(-ppc * 0.02, -ppc * 0.42);
  ctx.closePath();
  ctx.fill();
}

function withSide(ctx: CanvasRenderingContext2D, px: number, py: number, ppc: number, side: 'top' | 'bottom' | 'left' | 'right', draw: () => void): void {
  // Локальная система: порог — верхняя кромка клетки, наружу — вниз.
  ctx.save();
  ctx.translate(px + ppc / 2, py + ppc / 2);
  const angle = side === 'bottom' ? 0 : side === 'top' ? Math.PI : side === 'left' ? Math.PI / 2 : -Math.PI / 2;
  ctx.rotate(angle);
  ctx.translate(-ppc / 2, -ppc / 2);
  draw();
  ctx.restore();
}

export function drawRoom(ctx: CanvasRenderingContext2D, room: RoomView, ppc: number, seed: number): void {
  const W = room.cols * ppc;
  const H = room.rows * ppc;
  ctx.fillStyle = palette.shelf.top;
  ctx.fillRect(0, 0, W, H);

  // Швы под плиткой.
  ctx.fillStyle = palette.floor.grout;
  for (let y = 0; y < room.rows; y++) {
    for (let x = 0; x < room.cols; x++) {
      const t = tileOf(room, x, y);
      if (t === 'floor' || t === 'squeak' || t === 'shelf') ctx.fillRect(x * ppc - 1, y * ppc - 1, ppc + 2, ppc + 2);
    }
  }
  for (let y = 0; y < room.rows; y++) {
    for (let x = 0; x < room.cols; x++) {
      const t = tileOf(room, x, y);
      const rng = cellRng(seed, x, y);
      if (t === 'floor' || t === 'shelf') drawTile(ctx, rng, x * ppc, y * ppc, ppc, (x + y) % 2 === 0);
      else if (t === 'squeak') drawPlanks(ctx, rng, x * ppc, y * ppc, ppc);
    }
  }

  // Стены по сторонам экрана.
  const cx = Math.floor(room.cols / 2);
  const windows = new Set<number>([cx - 2, cx + 2]);
  if (room.cols >= 11) {
    windows.add(cx - 4);
    windows.add(cx + 4);
  }
  // Каменная кладка дальней стены за шкафами.
  ctx.save();
  ctx.fillStyle = palette.derived.stone;
  ctx.fillRect(0, 0, W, ppc);
  ctx.strokeStyle = K.withAlpha(palette.derived.mortar, 0.9);
  ctx.lineWidth = Math.max(1, ppc * 0.01);
  for (let r = 0; r < 4; r++) {
    const yy = ppc * (0.12 + r * 0.22);
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(W, yy);
    ctx.stroke();
    for (let xx = (r % 2) * ppc * 0.25; xx < W; xx += ppc * 0.5) {
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx, yy + ppc * 0.22);
      ctx.stroke();
    }
  }
  ctx.restore();
  let moonDone = false;
  for (let x = 1; x < room.cols - 1; x++) {
    const rng = cellRng(seed, x, 0, 1);
    if (tileOf(room, x, 0) === 'door') continue;
    if (x === cx) drawClock(ctx, rng, x * ppc, 0, ppc);
    else if (windows.has(x)) {
      drawWindow(ctx, rng, x * ppc, 0, ppc, !moonDone);
      moonDone = true;
    } else drawWallCase(ctx, rng, x * ppc, 0, ppc);
  }
  // Тёмная балка поверху.
  K.shape(ctx, cellRng(seed, 0, 0, 2), K.rectPath(-2, -2, W + 4, ppc * 0.1), palette.shelf.top, inkW(ppc, 0.5), { rim: 0 });

  for (let y = 1; y < room.rows - 1; y++) {
    for (const x of [0, room.cols - 1]) {
      if (tileOf(room, x, y) === 'door') continue;
      drawSideCase(ctx, cellRng(seed, x, y, 3), x * ppc, y * ppc, ppc, true);
    }
  }
  for (let x = 1; x < room.cols - 1; x++) {
    const y = room.rows - 1;
    if (tileOf(room, x, y) === 'door') continue;
    drawSideCase(ctx, cellRng(seed, x, y, 4), x * ppc, y * ppc, ppc, false);
  }
  for (const [x, y] of [
    [0, 0],
    [room.cols - 1, 0],
    [0, room.rows - 1],
    [room.cols - 1, room.rows - 1],
  ] as const) {
    if (wallSideOf(room, x, y) === 'corner') drawPillar(ctx, cellRng(seed, x, y, 5), x * ppc, y * ppc, ppc);
  }

  // Дверь: каменный проём, свет снаружи и полоска света на полу у порога.
  const door = room.door;
  const side = room.doorSide;
  withSide(ctx, door.x * ppc, door.y * ppc, ppc, side, () => {
    drawDoorway(ctx, cellRng(seed, door.x, door.y, 6), ppc);
    drawDoorGlow(ctx, ppc);
  });

  // Единая фактура: зерно пергамента поверх всего.
  K.grainOver(ctx, cellRng(seed, 7, 7, 9), W, H, 0.05);
}
