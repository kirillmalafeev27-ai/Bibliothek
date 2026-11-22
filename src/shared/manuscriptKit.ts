/**
 * Рукописный кит — общий модуль серии для игр в стиле средневековой рукописи
 * (план, 7.4): пергамент, железо-галловые чернила, перо, темпера, сусальное золото,
 * лозы, бандероли, маникулы. Всё рисуется процедурно на Canvas 2D; разнообразие
 * дают сиды. Собственных цветов у кита нет: игра передаёт их через configureKit().
 */

export interface Vec {
  x: number;
  y: number;
}

export type Rand = () => number;

export interface KitColors {
  parchment: string;
  parchmentShade: string;
  parchmentEdge: string;
  /** Самый светлый тон бумаги — им «высветляют» краску. */
  paperWhite: string;
  ink: string;
  inkFaded: string;
  rubric: string;
  gold: { base: string; light: string; dark: string };
  /** Акценты орнамента на полях: синий и красный бутоны. */
  accentBlue: string;
  accentRed: string;
}

let C: KitColors | null = null;

/** Задаёт краски кита. Вызывается один раз при запуске игры. */
export function configureKit(colors: KitColors): void {
  C = colors;
}

function kc(): KitColors {
  if (!C) throw new Error('manuscriptKit: вызови configureKit() до рисования');
  return C;
}

/** Угол пера по умолчанию — 30° (7.1). */
export const NIB_ANGLE = Math.PI / 6;

// ───────────────────────────── случайность ─────────────────────────────

/** Сидированный генератор случайных чисел (общий с другими китами серии). */
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rnd = (rng: Rand, a: number, b: number): number => a + rng() * (b - a);
export const rndInt = (rng: Rand, a: number, b: number): number => Math.floor(rnd(rng, a, b + 1));
export const pick = <T>(rng: Rand, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)] as T;

/** Строка → сид (для кэшей и ключей текстур). */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ───────────────────────────── холст и цвет ─────────────────────────────

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('manuscriptKit: нет контекста 2D');
  return ctx;
}

function parseHex(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#')) return color;
  const [r, g, b] = parseHex(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Смешение двух цветов '#rrggbb'. */
export function blend(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const m = (p: number, q: number): string =>
    Math.round(p + (q - p) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${m(ar, br)}${m(ag, bg)}${m(ab, bb)}`;
}

/** Краска гуще (к чернилам) или жиже (к бумаге). */
export const darker = (color: string, t: number): string => blend(color, kc().ink, t);
export const lighter = (color: string, t: number): string => blend(color, kc().paperWhite, t);

// ───────────────────────────── геометрия ─────────────────────────────

export const v = (x: number, y: number): Vec => ({ x, y });

/** Сглаживание Чайкина. */
export function chaikin(pts: readonly Vec[], iterations: number, closed: boolean): Vec[] {
  let cur = pts.slice();
  for (let it = 0; it < iterations; it++) {
    const out: Vec[] = [];
    const n = cur.length;
    const last = closed ? n : n - 1;
    if (!closed) out.push(cur[0] as Vec);
    for (let i = 0; i < last; i++) {
      const a = cur[i] as Vec;
      const b = cur[(i + 1) % n] as Vec;
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    if (!closed) out.push(cur[n - 1] as Vec);
    cur = out;
  }
  return cur;
}

/**
 * Неровная замкнутая форма: точки по эллипсу с разбросом радиуса, сглаживание Чайкина.
 * w, h — размеры; центр по умолчанию — середина.
 */
export function blob(
  rng: Rand,
  w: number,
  h: number,
  opts: { points?: number; jitter?: number; smooth?: number; cx?: number; cy?: number } = {},
): Vec[] {
  const n = opts.points ?? 10;
  const jitter = opts.jitter ?? 0.12;
  const cx = opts.cx ?? w / 2;
  const cy = opts.cy ?? h / 2;
  const pts: Vec[] = [];
  const phase = rng() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const r = 1 + (rng() * 2 - 1) * jitter;
    pts.push({ x: cx + Math.cos(a) * (w / 2) * r, y: cy + Math.sin(a) * (h / 2) * r });
  }
  return chaikin(pts, opts.smooth ?? 3, true);
}

export interface PenPoint extends Vec {
  /** Острый угол: кривая приходит в точку и уходит из неё прямо. */
  corner?: boolean;
}

/**
 * Кривая через опорные точки (сплайн Катмулла — Рома). Точки с `corner` дают излом.
 * Так задаются все фигуры: несколько опорных точек — живая, чуть неровная линия.
 */
export function spline(pts: readonly PenPoint[], closed: boolean, perSeg = 8): Vec[] {
  const n = pts.length;
  if (n < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
  const out: Vec[] = [];
  const segs = closed ? n : n - 1;
  const at = (i: number): PenPoint =>
    closed
      ? (pts[((i % n) + n) % n] as PenPoint)
      : (pts[Math.min(n - 1, Math.max(0, i))] as PenPoint);
  for (let i = 0; i < segs; i++) {
    const p1 = at(i);
    const p2 = at(i + 1);
    const p0 = p1.corner ? p1 : at(i - 1);
    const p3 = p2.corner ? p2 : at(i + 2);
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  if (!closed) {
    const last = pts[n - 1] as PenPoint;
    out.push({ x: last.x, y: last.y });
  }
  return out;
}

/** Короткая запись опорных точек: [x, y] — плавная, [x, y, 1] — излом. */
export function pen(
  points: readonly (readonly [number, number] | readonly [number, number, number])[],
  closed = true,
  perSeg = 8,
): Vec[] {
  return spline(
    points.map((p) => ({ x: p[0], y: p[1], corner: p[2] === 1 })),
    closed,
    perSeg,
  );
}

export function ellipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  steps = 40,
  rot = 0,
): Vec[] {
  const out: Vec[] = [];
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push({ x: cx + x * cr - y * sr, y: cy + x * sr + y * cr });
  }
  return out;
}

export function rectPath(x: number, y: number, w: number, h: number): Vec[] {
  return [v(x, y), v(x + w, y), v(x + w, y + h), v(x, y + h)];
}

/** Прямоугольник со скруглёнными углами как ломаная. */
export function roundRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  steps = 5,
): Vec[] {
  const rr = Math.min(r, w / 2, h / 2);
  const out: Vec[] = [];
  const corner = (cx: number, cy: number, a0: number): void => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (Math.PI / 2);
      out.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
  };
  corner(x + w - rr, y + rr, -Math.PI / 2);
  corner(x + w - rr, y + h - rr, 0);
  corner(x + rr, y + h - rr, Math.PI / 2);
  corner(x + rr, y + rr, Math.PI);
  return out;
}

/** Прореживает или уплотняет ломаную до примерно равного шага. */
export function resample(pts: readonly Vec[], step: number, closed: boolean): Vec[] {
  const n = pts.length;
  if (n < 2) return pts.slice();
  const out: Vec[] = [pts[0] as Vec];
  let carry = 0;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i] as Vec;
    const b = pts[(i + 1) % n] as Vec;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = step - carry;
    while (d <= len) {
      const t = d / len;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      d += step;
    }
    carry = len - (d - step);
  }
  if (!closed) out.push(pts[n - 1] as Vec);
  return out;
}

/** Лёгкое дрожание руки: плавное смещение точек вдоль нормали. */
export function wobble(
  rng: Rand,
  pts: readonly Vec[],
  amp: number,
  closed: boolean,
  wavelength = 26,
): Vec[] {
  const n = pts.length;
  if (n < 3 || amp <= 0) return pts.slice();
  const p1 = rng() * 100;
  const p2 = rng() * 100;
  const out: Vec[] = [];
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)] as Vec;
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)] as Vec;
    const p = pts[i] as Vec;
    if (i > 0) {
      const q = pts[i - 1] as Vec;
      dist += Math.hypot(p.x - q.x, p.y - q.y);
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const k =
      (Math.sin(dist / wavelength + p1) * 0.65 + Math.sin(dist / (wavelength * 0.37) + p2) * 0.35) *
      amp;
    out.push({ x: p.x + (-dy / len) * k, y: p.y + (dx / len) * k });
  }
  return out;
}

export function tracePath(ctx: CanvasRenderingContext2D, pts: readonly Vec[], closed = true): void {
  const first = pts[0];
  if (!first) return;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i] as Vec;
    ctx.lineTo(p.x, p.y);
  }
  if (closed) ctx.closePath();
}

export function pathBounds(pts: readonly Vec[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function transformPath(
  pts: readonly Vec[],
  t: { dx?: number; dy?: number; sx?: number; sy?: number; rot?: number; ox?: number; oy?: number },
): Vec[] {
  const sx = t.sx ?? 1;
  const sy = t.sy ?? sx;
  const cr = Math.cos(t.rot ?? 0);
  const sr = Math.sin(t.rot ?? 0);
  const ox = t.ox ?? 0;
  const oy = t.oy ?? 0;
  return pts.map((p) => {
    const x = (p.x - ox) * sx;
    const y = (p.y - oy) * sy;
    return { x: ox + x * cr - y * sr + (t.dx ?? 0), y: oy + x * sr + y * cr + (t.dy ?? 0) };
  });
}

// ───────────────────────────── перо и чернила ─────────────────────────────

export interface NibOptions {
  closed?: boolean;
  color?: string;
  alpha?: number;
  /** Доля длины, на которой штрих сходит на нет у концов (только для открытых). */
  taper?: number;
}

/**
 * Штрих широким пером: толщина wMin + (wMax − wMin) × |sin(θ − nibAngle)|, где θ —
 * направление штриха. Рисуется многоугольником вдоль пути.
 */
export function nibStroke(
  ctx: CanvasRenderingContext2D,
  path: readonly Vec[],
  wMin: number,
  wMax: number,
  nibAngle: number = NIB_ANGLE,
  opts: NibOptions = {},
): void {
  const n = path.length;
  if (n < 2) return;
  const closed = opts.closed ?? false;
  const taper = closed ? 0 : (opts.taper ?? 0.16);
  let total = 0;
  const cum: number[] = [0];
  for (let i = 1; i < n; i++) {
    const a = path[i - 1] as Vec;
    const b = path[i] as Vec;
    total += Math.hypot(b.x - a.x, b.y - a.y);
    cum.push(total);
  }
  const left: Vec[] = [];
  const right: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = path[closed ? (i - 1 + n) % n : Math.max(0, i - 1)] as Vec;
    const b = path[closed ? (i + 1) % n : Math.min(n - 1, i + 1)] as Vec;
    const p = path[i] as Vec;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const theta = Math.atan2(dy, dx);
    let w = wMin + (wMax - wMin) * Math.abs(Math.sin(theta - nibAngle));
    if (taper > 0 && total > 0) {
      const t = (cum[i] as number) / total;
      const k = Math.min(1, t / taper, (1 - t) / taper);
      w *= 0.3 + 0.7 * k * k * (3 - 2 * k);
    }
    const nx = (-dy / len) * (w / 2);
    const ny = (dx / len) * (w / 2);
    left.push({ x: p.x + nx, y: p.y + ny });
    right.push({ x: p.x - nx, y: p.y - ny });
  }
  ctx.save();
  ctx.fillStyle = opts.color ?? kc().ink;
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  ctx.beginPath();
  if (closed) {
    tracePath(ctx, left, true);
    tracePath(ctx, right.slice().reverse(), true);
    ctx.fill('nonzero');
  } else {
    tracePath(ctx, left, false);
    for (let i = n - 1; i >= 0; i--) {
      const p = right[i] as Vec;
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export interface InkOptions {
  closed?: boolean;
  color?: string;
  alpha?: number;
  /** Дрожание руки, px (по умолчанию 0.5). */
  jitter?: number;
  /** Лужицы чернил на углах. */
  pools?: boolean;
  nibAngle?: number;
  /** Отношение тонкого места штриха к толстому. */
  contrast?: number;
  taper?: number;
}

/**
 * Контур железо-галловыми чернилами: nibStroke с дрожанием 0.5 px и чуть более
 * тёмными «лужицами» чернил на углах.
 */
export function inkOutline(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  path: readonly Vec[],
  w: number,
  opts: InkOptions = {},
): void {
  const closed = opts.closed ?? true;
  const color = opts.color ?? kc().ink;
  const contrast = opts.contrast ?? 0.5;
  const pts = wobble(rng, path, opts.jitter ?? 0.5, closed);
  nibStroke(ctx, pts, w * contrast, w * 1.18, opts.nibAngle ?? NIB_ANGLE, {
    closed,
    color,
    alpha: opts.alpha,
    taper: opts.taper,
  });
  if (opts.pools === false) return;
  // Лужицы: там, где перо резко меняет направление, чернил скапливается больше.
  if (w < 2.2) return;
  const n = pts.length;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha *= (opts.alpha ?? 1) * 0.5;
  const stepBack = Math.max(1, Math.round(n / 60));
  for (let i = 0; i < n; i++) {
    if (!closed && (i < stepBack || i >= n - stepBack)) continue;
    const a = pts[(i - stepBack + n) % n] as Vec;
    const p = pts[i] as Vec;
    const b = pts[(i + stepBack) % n] as Vec;
    const a1 = Math.atan2(p.y - a.y, p.x - a.x);
    const a2 = Math.atan2(b.y - p.y, b.x - p.x);
    let turn = Math.abs(a2 - a1);
    if (turn > Math.PI) turn = Math.PI * 2 - turn;
    if (turn > 1.05) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, w * (0.3 + rng() * 0.1), 0, Math.PI * 2);
      ctx.fill();
      i += stepBack * 2;
    }
  }
  ctx.restore();
}

/** Короткий штрих пером между двумя точками (складки, штриховка, усики). */
export function inkLine(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  a: Vec,
  b: Vec,
  w: number,
  opts: InkOptions & { bend?: number } = {},
): void {
  const bend = opts.bend ?? 0;
  const mx = (a.x + b.x) / 2 - (b.y - a.y) * bend;
  const my = (a.y + b.y) / 2 + (b.x - a.x) * bend;
  const pts = spline([a, { x: mx, y: my }, b], false, 6);
  inkOutline(ctx, rng, pts, w, { ...opts, closed: false, pools: false });
}

// ───────────────────────────── темпера ─────────────────────────────

export interface TemperaOptions {
  /** Ширина тёмного ободка у края, px (0 — без ободка). */
  rim?: number;
  /** Сила неравномерности 0–1. */
  mottle?: number;
  /** Мазки кисти под этим углом (радианы); не задано — без мазков. */
  streak?: number;
  alpha?: number;
}

/**
 * Плоская заливка темперой: мягкая неравномерность и тёмный ободок там, где краска
 * скопилась у края. Светотени нет — только фактура краски.
 */
export function tempera(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  path: readonly Vec[],
  color: string,
  opts: TemperaOptions = {},
): void {
  const k = kc();
  const b = pathBounds(path);
  const size = Math.max(b.w, b.h);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  ctx.beginPath();
  tracePath(ctx, path, true);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.clip();
  const mottle = opts.mottle ?? 0.5;
  if (mottle > 0 && size > 6) {
    const blots = Math.max(2, Math.min(7, Math.round(size / 26)));
    for (let i = 0; i < blots; i++) {
      const x = b.x + rng() * b.w;
      const y = b.y + rng() * b.h;
      const r = size * (0.22 + rng() * 0.3);
      const light = rng() < 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const tone = light ? k.paperWhite : k.ink;
      g.addColorStop(0, withAlpha(tone, (light ? 0.13 : 0.09) * mottle));
      g.addColorStop(1, withAlpha(tone, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  if (opts.streak !== undefined && size > 10) {
    // Мазки кисти: редкие длинные полупрозрачные полосы.
    const cs = Math.cos(opts.streak);
    const sn = Math.sin(opts.streak);
    const count = Math.max(3, Math.round(size / 9));
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = b.x + rng() * b.w;
      const y = b.y + rng() * b.h;
      const len = size * (0.25 + rng() * 0.45);
      ctx.strokeStyle = withAlpha(rng() < 0.55 ? k.paperWhite : k.ink, 0.045 + rng() * 0.05);
      ctx.lineWidth = 0.8 + rng() * 1.6;
      ctx.beginPath();
      ctx.moveTo(x - cs * len * 0.5, y - sn * len * 0.5);
      ctx.lineTo(x + cs * len * 0.5, y + sn * len * 0.5);
      ctx.stroke();
    }
  }
  const rim = opts.rim ?? Math.max(1.5, size * 0.07);
  if (rim > 0) {
    // Ободок: несколько полупрозрачных обводок убывающей ширины, обрезанных формой.
    ctx.lineJoin = 'round';
    const tone = k.ink;
    for (const [mul, a] of [
      [2.0, 0.07],
      [1.2, 0.09],
      [0.6, 0.11],
    ] as const) {
      ctx.strokeStyle = withAlpha(tone, a);
      ctx.lineWidth = rim * mul;
      ctx.beginPath();
      tracePath(ctx, path, true);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Форма целиком: темпера + чернильный контур. Самая частая операция рецептов. */
export function shape(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  path: readonly Vec[],
  color: string,
  lineW: number,
  opts: TemperaOptions & { ink?: InkOptions; noOutline?: boolean } = {},
): void {
  tempera(ctx, rng, path, color, opts);
  if (!opts.noOutline && lineW > 0)
    inkOutline(ctx, rng, path, lineW, { closed: true, ...opts.ink });
}

// ───────────────────────────── сусальное золото ─────────────────────────────

export interface GoldOptions {
  /** Точечная чеканка вдоль края: шаг между точками, px (0 — без чеканки). */
  punch?: number;
  /** Сколько трещин кракелюра. */
  cracks?: number;
  alpha?: number;
}

/**
 * Сусальное золото: основа, блик полировки, кракелюр, точечная чеканка.
 * Альфа-канал результата служит маской для бегущего блика.
 */
export function goldLeaf(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  path: readonly Vec[],
  opts: GoldOptions = {},
): void {
  const k = kc();
  const b = pathBounds(path);
  const size = Math.max(b.w, b.h);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  ctx.beginPath();
  tracePath(ctx, path, true);
  const base = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  base.addColorStop(0, blend(k.gold.base, k.gold.light, 0.45));
  base.addColorStop(0.45, k.gold.base);
  base.addColorStop(1, blend(k.gold.base, k.gold.dark, 0.35));
  ctx.fillStyle = base;
  ctx.fill();
  ctx.clip();
  // Полировка: мягкие светлые пятна.
  const shines = Math.max(1, Math.min(5, Math.round(size / 40)));
  for (let i = 0; i < shines; i++) {
    const x = b.x + rng() * b.w;
    const y = b.y + rng() * b.h * 0.7;
    const r = size * (0.12 + rng() * 0.22);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, withAlpha(k.gold.light, 0.6));
    g.addColorStop(1, withAlpha(k.gold.light, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Кракелюр: тонкие ломаные трещинки.
  const cracks = opts.cracks ?? Math.max(2, Math.round((b.w * b.h) / 900));
  ctx.strokeStyle = withAlpha(k.gold.dark, 0.55);
  ctx.lineWidth = Math.max(0.5, size * 0.006);
  ctx.lineCap = 'round';
  for (let i = 0; i < cracks; i++) {
    let x = b.x + rng() * b.w;
    let y = b.y + rng() * b.h;
    let a = rng() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 2 + Math.floor(rng() * 4);
    for (let s = 0; s < segs; s++) {
      a += (rng() - 0.5) * 1.5;
      const len = 3 + rng() * Math.max(4, size * 0.12);
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Чеканка: ряд точек вдоль края, каждая — тёмная ямка со светлым бликом.
  const punch = opts.punch ?? 0;
  if (punch > 0) {
    const inset = punch * 0.8;
    const dots = resample(path, punch, true);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    for (const p of dots) {
      const dx = cx - p.x;
      const dy = cy - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const x = p.x + (dx / len) * inset;
      const y = p.y + (dy / len) * inset;
      const r = Math.max(0.6, punch * 0.16);
      ctx.fillStyle = withAlpha(k.gold.dark, 0.7);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = withAlpha(k.gold.light, 0.9);
      ctx.beginPath();
      ctx.arc(x - r * 0.45, y - r * 0.45, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Золотая форма с чернильным контуром. */
export function goldShape(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  path: readonly Vec[],
  lineW: number,
  opts: GoldOptions & { ink?: InkOptions } = {},
): void {
  goldLeaf(ctx, rng, path, opts);
  if (lineW > 0) inkOutline(ctx, rng, path, lineW, { closed: true, ...opts.ink });
}

// ───────────────────────────── пергамент ─────────────────────────────

export interface ParchmentOptions {
  /** Текстура без швов — для повторяющегося фона. */
  tile?: boolean;
  /** Темнеющий край (для отдельных листов и карточек). */
  edge?: number;
  /** Плотность волокон и пятен 0–1. */
  density?: number;
  base?: string;
}

/** Текстура пергамента: основа, тонкие волокна, редкие пятна, темнеющий край, лёгкое зерно. */
export function parchment(
  rng: Rand,
  w: number,
  h: number,
  opts: ParchmentOptions = {},
): HTMLCanvasElement {
  const k = kc();
  const canvas = makeCanvas(w, h);
  const ctx = ctx2d(canvas);
  const density = opts.density ?? 1;
  const tile = opts.tile ?? false;
  ctx.fillStyle = opts.base ?? k.parchment;
  ctx.fillRect(0, 0, w, h);

  /** Рисует фрагмент; для бесшовной текстуры повторяет его через края. */
  const wrap = (x: number, y: number, r: number, draw: (ox: number, oy: number) => void): void => {
    draw(0, 0);
    if (!tile) return;
    const xs = x < r ? [w] : x > w - r ? [-w] : [];
    const ys = y < r ? [h] : y > h - r ? [-h] : [];
    for (const ox of xs) draw(ox, 0);
    for (const oy of ys) draw(0, oy);
    for (const ox of xs) for (const oy of ys) draw(ox, oy);
  };

  // Крупные мягкие пятна: где пергамент темнее и светлее.
  const blots = Math.round(((w * h) / 26000) * density) + 3;
  for (let i = 0; i < blots; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = (60 + rng() * 150) * Math.min(1.4, Math.max(0.5, Math.min(w, h) / 420));
    const light = rng() < 0.45;
    const tone = light ? k.paperWhite : k.parchmentShade;
    const a = light ? 0.22 + rng() * 0.2 : 0.3 + rng() * 0.35;
    wrap(x, y, r, (ox, oy) => {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, withAlpha(tone, a));
      g.addColorStop(1, withAlpha(tone, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }

  // Волокна: тонкие короткие чуть изогнутые штрихи.
  const fibers = Math.round(((w * h) / 520) * density);
  ctx.lineCap = 'round';
  for (let i = 0; i < fibers; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const a = rng() * Math.PI;
    const len = 5 + rng() * 22;
    const bend = (rng() - 0.5) * 8;
    const dark = rng() < 0.62;
    ctx.strokeStyle = withAlpha(
      dark ? k.parchmentEdge : k.paperWhite,
      dark ? 0.1 + rng() * 0.2 : 0.2 + rng() * 0.3,
    );
    ctx.lineWidth = 0.4 + rng() * 0.8;
    const dx = Math.cos(a) * len;
    const dy = Math.sin(a) * len;
    wrap(x, y, len + 8, (ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.quadraticCurveTo(
        x + ox + dx / 2 - Math.sin(a) * bend,
        y + oy + dy / 2 + Math.cos(a) * bend,
        x + ox + dx,
        y + oy + dy,
      );
      ctx.stroke();
    });
  }

  // Редкие пятнышки и поры.
  const specks = Math.round(((w * h) / 2600) * density);
  for (let i = 0; i < specks; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 0.5 + rng() * 1.6;
    ctx.fillStyle = withAlpha(k.inkFaded, 0.05 + rng() * 0.12);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Лёгкое зерно.
  grain(ctx, rng, w, h, 0.035 * density);

  const edge = opts.edge ?? 0;
  if (edge > 0 && !tile) {
    const g = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.3,
      w / 2,
      h / 2,
      Math.hypot(w, h) * 0.56,
    );
    g.addColorStop(0, withAlpha(k.parchmentEdge, 0));
    g.addColorStop(1, withAlpha(k.parchmentEdge, edge));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  return canvas;
}

let grainTile: HTMLCanvasElement | null = null;

/** Зерно: мелкий шум, одинаково ложится на бумагу и на краску. */
export function grain(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  w: number,
  h: number,
  strength: number,
): void {
  if (strength <= 0) return;
  if (!grainTile) {
    const size = 128;
    grainTile = makeCanvas(size, size);
    const g = ctx2d(grainTile);
    const img = g.createImageData(size, size);
    const local = mulberry32(0x9a17);
    const [dr, dg, db] = parseHex(kc().ink);
    const [lr, lg, lb] = parseHex(kc().paperWhite);
    for (let i = 0; i < size * size; i++) {
      const n = local();
      const dark = n < 0.5;
      img.data[i * 4] = dark ? dr : lr;
      img.data[i * 4 + 1] = dark ? dg : lg;
      img.data[i * 4 + 2] = dark ? db : lb;
      img.data[i * 4 + 3] = Math.round(Math.abs(n - 0.5) * 2 * 255);
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha *= strength;
  const pattern = ctx.createPattern(grainTile, 'repeat');
  if (pattern) {
    ctx.translate(Math.floor(rng() * 64), Math.floor(rng() * 64));
    ctx.fillStyle = pattern;
    ctx.fillRect(-64, -64, w + 128, h + 128);
  }
  ctx.restore();
}

/**
 * Зерно только поверх уже нарисованного (по альфа-каналу холста): краска на спрайте
 * получает ту же фактуру, что и страница, а прозрачные места остаются прозрачными.
 */
export function grainOver(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  w: number,
  h: number,
  strength: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  grain(ctx, rng, w, h, strength);
  ctx.restore();
}

// ───────────────────────────── орнамент ─────────────────────────────

export interface VineOptions {
  /** Толщина стебля, px. */
  stem?: number;
  /** Шаг между побегами вдоль стебля, px. */
  every?: number;
  /** Размер завитка и листа, px. */
  curl?: number;
  leaf?: number;
  /** С какой стороны побеги. */
  sides?: 'both' | 'left' | 'right';
  /** Цвет стебля и усиков. */
  color?: string;
  /** Золотые листья и шарики (на полях страницы золото — просто украшение). */
  gold?: boolean;
  /** Цветные бутоны. */
  buds?: boolean;
  /** Приглушённость 0–1: для маргиналий и фона. */
  alpha?: number;
}

/** Лист плюща — трёхлопастный, остриём по углу `angle`. */
export function ivyLeaf(cx: number, cy: number, size: number, angle: number): Vec[] {
  const s = size / 2;
  const half: [number, number, number?][] = [
    [0, -1.3, 1],
    [0.3, -0.72],
    [0.5, -0.42],
    [1.12, -0.3, 1],
    [0.74, 0.08],
    [0.62, 0.42],
    [0.78, 0.92, 1],
    [0.3, 0.74],
    [0, 0.5, 1],
  ];
  const pts: PenPoint[] = half.map((p) => ({ x: p[0] * s, y: p[1] * s, corner: p[2] === 1 }));
  for (let i = half.length - 2; i >= 1; i--) {
    const p = half[i] as [number, number, number?];
    pts.push({ x: -p[0] * s, y: p[1] * s, corner: p[2] === 1 });
  }
  const path = spline(pts, true, 4);
  return transformPath(path, { rot: angle + Math.PI / 2, dx: cx, dy: cy });
}

/** Спиральный завиток, выходящий из точки под углом `angle`. */
export function curlPath(
  x: number,
  y: number,
  size: number,
  angle: number,
  turn: 1 | -1,
  turns = 1.35,
): Vec[] {
  const pts: Vec[] = [];
  const steps = Math.round(22 * turns);
  // Центр спирали — сбоку от точки выхода, чтобы завиток начинался по касательной.
  const cx =
    x + Math.cos(angle) * size * 0.55 + Math.cos(angle + (turn * Math.PI) / 2) * size * 0.5;
  const cy =
    y + Math.sin(angle) * size * 0.55 + Math.sin(angle + (turn * Math.PI) / 2) * size * 0.5;
  const a0 = Math.atan2(y - cy, x - cx);
  const r0 = Math.hypot(x - cx, y - cy);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + turn * t * turns * Math.PI * 2;
    const r = r0 * (1 - t * 0.86);
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/** Золотой шарик с усиками — бизант, обычный мотив французских полей XV века. */
export function bezant(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  x: number,
  y: number,
  r: number,
  color: string,
  gold: boolean,
): void {
  const k = kc();
  const whiskers = 3 + Math.floor(rng() * 3);
  const a0 = rng() * Math.PI * 2;
  for (let i = 0; i < whiskers; i++) {
    const a = a0 + (i / whiskers) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const len = r * (1.5 + rng() * 1.1);
    nibStroke(
      ctx,
      [
        { x: x + Math.cos(a) * r * 0.9, y: y + Math.sin(a) * r * 0.9 },
        {
          x: x + Math.cos(a + 0.12) * (r + len * 0.55),
          y: y + Math.sin(a + 0.12) * (r + len * 0.55),
        },
        { x: x + Math.cos(a + 0.3) * (r + len), y: y + Math.sin(a + 0.3) * (r + len) },
      ],
      Math.max(0.5, r * 0.16),
      Math.max(0.7, r * 0.3),
      NIB_ANGLE,
      { color },
    );
  }
  const circle = ellipsePath(x, y, r, r, 14);
  if (gold) {
    ctx.save();
    ctx.beginPath();
    tracePath(ctx, circle, true);
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
    g.addColorStop(0, k.gold.light);
    g.addColorStop(0.6, k.gold.base);
    g.addColorStop(1, blend(k.gold.base, k.gold.dark, 0.5));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    tracePath(ctx, circle, true);
    ctx.fillStyle = withAlpha(color, 0.25);
    ctx.fill();
    ctx.restore();
  }
  nibStroke(ctx, circle, Math.max(0.5, r * 0.14), Math.max(0.8, r * 0.3), NIB_ANGLE, {
    closed: true,
    color,
  });
}

/**
 * Орнаментальная лоза: стебель, спиральные завитки, листья плюща, росчерки пера.
 * `path` — ось стебля (ломаная).
 */
export function vine(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  path: readonly Vec[],
  opts: VineOptions = {},
): void {
  const k = kc();
  const color = opts.color ?? k.inkFaded;
  const stem = opts.stem ?? 1.6;
  const every = opts.every ?? 34;
  const curl = opts.curl ?? 12;
  const leaf = opts.leaf ?? 9;
  const sides = opts.sides ?? 'both';
  const gold = opts.gold ?? true;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  const axis = resample(path, 3, false);
  nibStroke(ctx, axis, stem * 0.55, stem * 1.25, NIB_ANGLE, { color, taper: 0.06 });
  // Точки, откуда растут побеги.
  let dist = every * (0.3 + rng() * 0.4);
  let side: 1 | -1 = rng() < 0.5 ? 1 : -1;
  let acc = 0;
  for (let i = 1; i < axis.length; i++) {
    const a = axis[i - 1] as Vec;
    const b = axis[i] as Vec;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    acc += seg;
    if (acc < dist) continue;
    acc = 0;
    dist = every * (0.75 + rng() * 0.5);
    const dir = Math.atan2(b.y - a.y, b.x - a.x);
    if (sides === 'left') side = -1;
    else if (sides === 'right') side = 1;
    else side = side === 1 ? -1 : 1;
    const out = dir + side * (0.75 + rng() * 0.5);
    const kind = rng();
    if (kind < 0.42) {
      // Завиток.
      const c = curlPath(b.x, b.y, curl * (0.8 + rng() * 0.45), out, side);
      nibStroke(ctx, c, stem * 0.4, stem * 1.0, NIB_ANGLE, { color, taper: 0.12 });
      const tip = c[c.length - 1] as Vec;
      if (rng() < 0.5) bezant(ctx, rng, tip.x, tip.y, Math.max(1.2, leaf * 0.2), color, gold);
    } else if (kind < 0.8) {
      // Лист плюща на черешке.
      const len = curl * (0.7 + rng() * 0.5);
      const tx = b.x + Math.cos(out) * len;
      const ty = b.y + Math.sin(out) * len;
      const stalk = spline(
        [
          b,
          {
            x: (b.x + tx) / 2 + Math.cos(out + side * 1.2) * len * 0.18,
            y: (b.y + ty) / 2 + Math.sin(out + side * 1.2) * len * 0.18,
          },
          { x: tx, y: ty },
        ],
        false,
        5,
      );
      nibStroke(ctx, stalk, stem * 0.4, stem * 0.95, NIB_ANGLE, { color, taper: 0.1 });
      const ls = leaf * (0.95 + rng() * 0.4);
      const lp = ivyLeaf(tx + Math.cos(out) * ls * 0.42, ty + Math.sin(out) * ls * 0.42, ls, out);
      if (gold) {
        goldLeaf(ctx, rng, lp, { cracks: 1 });
      } else {
        ctx.save();
        ctx.beginPath();
        tracePath(ctx, lp, true);
        ctx.fillStyle = withAlpha(color, 0.22);
        ctx.fill();
        ctx.restore();
      }
      nibStroke(ctx, lp, stem * 0.35, stem * 0.85, NIB_ANGLE, { closed: true, color });
      // Жилка листа.
      nibStroke(
        ctx,
        [
          { x: tx, y: ty },
          { x: tx + Math.cos(out) * ls * 0.8, y: ty + Math.sin(out) * ls * 0.8 },
        ],
        stem * 0.25,
        stem * 0.6,
        NIB_ANGLE,
        { color, taper: 0.3 },
      );
    } else {
      // Бутон или шарик на коротком усике.
      const len = curl * (0.5 + rng() * 0.35);
      const tx = b.x + Math.cos(out) * len;
      const ty = b.y + Math.sin(out) * len;
      nibStroke(ctx, [b, { x: tx, y: ty }], stem * 0.4, stem * 0.9, NIB_ANGLE, {
        color,
        taper: 0.1,
      });
      if (opts.buds !== false && rng() < 0.55) {
        const tone = rng() < 0.5 ? k.accentBlue : k.accentRed;
        const r = leaf * 0.24;
        for (let p = 0; p < 3; p++) {
          const pa = out + (p - 1) * 0.9;
          const petal = ellipsePath(
            tx + Math.cos(pa) * r * 0.9,
            ty + Math.sin(pa) * r * 0.9,
            r * 0.9,
            r * 0.62,
            10,
            pa,
          );
          ctx.save();
          ctx.beginPath();
          tracePath(ctx, petal, true);
          ctx.fillStyle = tone;
          ctx.fill();
          ctx.restore();
          nibStroke(ctx, petal, stem * 0.3, stem * 0.7, NIB_ANGLE, { closed: true, color });
        }
      } else {
        bezant(ctx, rng, tx, ty, Math.max(1.2, leaf * 0.22), color, gold);
      }
    }
  }
  ctx.restore();
}

/** Росчерк пера — группа из трёх точек и завитушки (заполняет пустоты орнамента). */
export function flourish(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  x: number,
  y: number,
  size: number,
  color?: string,
): void {
  const col = color ?? kc().inkFaded;
  const a = rng() * Math.PI * 2;
  for (let i = 0; i < 3; i++) {
    const r = size * (0.09 + rng() * 0.05);
    const px = x + Math.cos(a + i * 2.1) * size * 0.3;
    const py = y + Math.sin(a + i * 2.1) * size * 0.3;
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export type DiaperKind = 'check' | 'lozenge';

/** Узорный фон: клетка или ромбы с точками — для рамки, инициалов и экранов. */
export function diaper(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  rect: { x: number; y: number; w: number; h: number },
  colors: { a: string; b: string; line?: string; dot?: string },
  kind: DiaperKind,
  cell = 10,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = colors.a;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const cols = Math.ceil(rect.w / cell) + 2;
  const rows = Math.ceil(rect.h / cell) + 2;
  if (kind === 'check') {
    for (let j = -1; j < rows; j++) {
      for (let i = -1; i < cols; i++) {
        if ((i + j) % 2 === 0) continue;
        ctx.fillStyle = colors.b;
        ctx.globalAlpha = 0.9 + rng() * 0.1;
        ctx.fillRect(rect.x + i * cell, rect.y + j * cell, cell, cell);
      }
    }
  } else {
    const half = cell / 2;
    for (let j = -1; j < rows * 2; j++) {
      for (let i = -1; i < cols; i++) {
        const cx = rect.x + i * cell + (j % 2 === 0 ? 0 : half);
        const cy = rect.y + j * half;
        if ((i + Math.floor(j / 2)) % 2 !== 0) continue;
        ctx.fillStyle = colors.b;
        ctx.globalAlpha = 0.9 + rng() * 0.1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - half);
        ctx.lineTo(cx + half, cy);
        ctx.lineTo(cx, cy + half);
        ctx.lineTo(cx - half, cy);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  if (colors.line) {
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = Math.max(0.5, cell * 0.07);
    ctx.beginPath();
    if (kind === 'check') {
      for (let i = 0; i <= cols; i++) {
        ctx.moveTo(rect.x + i * cell, rect.y);
        ctx.lineTo(rect.x + i * cell, rect.y + rect.h);
      }
      for (let j = 0; j <= rows; j++) {
        ctx.moveTo(rect.x, rect.y + j * cell);
        ctx.lineTo(rect.x + rect.w, rect.y + j * cell);
      }
    } else {
      const span = rect.w + rect.h;
      for (let d = -span; d < span; d += cell) {
        ctx.moveTo(rect.x + d, rect.y);
        ctx.lineTo(rect.x + d + rect.h, rect.y + rect.h);
        ctx.moveTo(rect.x + d + rect.h, rect.y);
        ctx.lineTo(rect.x + d, rect.y + rect.h);
      }
    }
    ctx.stroke();
  }
  if (colors.dot) {
    ctx.fillStyle = colors.dot;
    const r = Math.max(0.5, cell * 0.09);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        ctx.beginPath();
        ctx.arc(rect.x + i * cell + cell / 2, rect.y + j * cell + cell / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

// ───────────────────────────── бандероль ─────────────────────────────

export interface BanderoleOptions {
  fill?: string;
  back?: string;
  ink?: string;
  line?: number;
  /** Волна ленты: доля высоты. */
  wave?: number;
  seed?: number;
}

interface BanderoleGeom {
  band: number;
  roll: number;
  x0: number;
  x1: number;
  line: number;
  mid: (x: number) => number;
}

function banderoleGeom(w: number, h: number, curl: number, opts: BanderoleOptions): BanderoleGeom {
  const line = opts.line ?? Math.max(1.2, h * 0.042);
  const band = h * 0.5;
  const roll = band * (0.32 + Math.min(1, Math.max(0, curl)) * 0.2);
  const pad = line + 1;
  const x0 = pad + roll;
  const x1 = w - pad - roll;
  const wave = (opts.wave ?? 0.07) * h;
  const mid = (x: number): number =>
    h / 2 + Math.sin(((x - x0) / Math.max(1, x1 - x0)) * Math.PI * 2) * wave;
  return { band, roll, x0, x1, line, mid };
}

/**
 * Лента-бандероль с закрученными концами: контур чернилами, заливка пергаментом.
 * Рисуется в прямоугольнике (0, 0, w, h) и не выходит за него; текст помещается
 * в прямоугольник banderoleTextBox(). `curl` — размер завитков на концах (0–1).
 */
export function banderole(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  curl: number,
  opts: BanderoleOptions = {},
): void {
  const k = kc();
  const rng = mulberry32(opts.seed ?? 7);
  const fill = opts.fill ?? k.paperWhite;
  const back = opts.back ?? k.parchmentShade;
  const ink = opts.ink ?? k.ink;
  const g = banderoleGeom(w, h, curl, opts);
  const { band, roll, x0, x1, line, mid } = g;
  const steps = 26;
  const upper: Vec[] = [];
  const lower: Vec[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    upper.push({ x, y: mid(x) - band / 2 });
    lower.push({ x, y: mid(x) + band / 2 });
  }
  const body = [...upper, ...lower.slice().reverse()];
  ctx.save();
  ctx.beginPath();
  tracePath(ctx, body, true);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.clip();
  // У свёрнутых концов лента темнее — плоская складка, без светотени.
  for (const [gx, dir] of [
    [x0, 1],
    [x1, -1],
  ] as const) {
    const grad = ctx.createLinearGradient(gx, 0, gx + dir * roll * 2.6, 0);
    grad.addColorStop(0, withAlpha(back, 0.95));
    grad.addColorStop(1, withAlpha(back, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(Math.min(gx, gx + dir * roll * 2.6), 0, roll * 2.6, h);
  }
  ctx.restore();
  inkOutline(ctx, rng, upper, line, { closed: false, color: ink, pools: false, taper: 0.02 });
  inkOutline(ctx, rng, lower, line, { closed: false, color: ink, pools: false, taper: 0.02 });
  // Концы свёрнуты в рулончики: слева лента закручена вверх, справа — вниз.
  for (const [ex, dir] of [
    [x0, -1],
    [x1, 1],
  ] as const) {
    const cy = mid(ex) + dir * (band / 2 - roll * 0.92);
    const circle = ellipsePath(ex, cy, roll, roll, 22);
    ctx.save();
    ctx.beginPath();
    tracePath(ctx, circle, true);
    ctx.fillStyle = back;
    ctx.fill();
    ctx.restore();
    inkOutline(ctx, rng, circle, line * 0.9, { closed: true, color: ink, pools: false });
    // Спираль свитка внутри рулончика.
    const spiral: Vec[] = [];
    const turns = 1.4;
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      const a = -dir * (Math.PI / 2) + dir * t * turns * Math.PI * 2;
      const r = roll * (0.82 - t * 0.66);
      spiral.push({ x: ex + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    nibStroke(ctx, spiral, line * 0.3, line * 0.7, NIB_ANGLE, { color: ink, taper: 0.12 });
    // Свободный край ленты — короткий отрезок от рулончика к противоположной кромке.
    const edgeY0 = cy - dir * roll * 0.2;
    const edgeY1 = mid(ex) - dir * (band / 2);
    nibStroke(
      ctx,
      [
        { x: ex + dir * roll * 0.98, y: edgeY0 },
        { x: ex + dir * roll * 0.3, y: (edgeY0 + edgeY1) / 2 },
        { x: ex, y: edgeY1 },
      ],
      line * 0.5,
      line,
      NIB_ANGLE,
      { color: ink, taper: 0.05 },
    );
  }
}

/** Прямоугольник бандероли, в который вписывается текст. */
export function banderoleTextBox(
  w: number,
  h: number,
  curl: number,
  opts: BanderoleOptions = {},
): { x: number; y: number; w: number; h: number } {
  const g = banderoleGeom(w, h, curl, opts);
  const x = g.x0 + g.roll * 1.25;
  return { x, y: h / 2 - g.band / 2, w: w - x * 2, h: g.band };
}

// ───────────────────────────── маникула ─────────────────────────────

export interface ManiculeOptions {
  ink?: string;
  line?: number;
  /** Золотая маникула — сусальным золотом. */
  goldFill?: boolean;
  cuff?: string;
  seed?: number;
}

/**
 * Указующая рука ☞ — знак на полях средневековых книг. Рисуется в прямоугольнике
 * size × size·0.6, палец смотрит вправо. `color` — заливка кисти.
 */
export function manicule(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
  opts: ManiculeOptions = {},
): void {
  const k = kc();
  const rng = mulberry32(opts.seed ?? 11);
  const ink = opts.ink ?? k.ink;
  const s = size / 100;
  const line = opts.line ?? Math.max(1.3, size * 0.04);
  const P = (
    pts: readonly (readonly [number, number] | readonly [number, number, number])[],
  ): Vec[] =>
    pen(
      pts.map((p) =>
        p.length === 3 ? ([p[0] * s, p[1] * s, p[2]] as const) : ([p[0] * s, p[1] * s] as const),
      ),
      true,
      6,
    );

  // Кисть: ладонь, большой палец сверху, вытянутый указательный, три согнутых пальца снизу.
  const hand = P([
    [17, 17, 1],
    [30, 15],
    [41, 10],
    [52, 5],
    [60, 5],
    [62, 10],
    [56, 15],
    [52, 19, 1],
    [70, 19],
    [90, 20],
    [97, 23],
    [97, 29],
    [90, 32],
    [66, 33, 1],
    [68, 38],
    [64, 43],
    [58, 43, 1],
    [59, 48],
    [54, 52],
    [48, 51, 1],
    [47, 55],
    [41, 57],
    [33, 54],
    [24, 49],
    [17, 45, 1],
  ]);
  if (opts.goldFill) goldLeaf(ctx, rng, hand, { cracks: 3 });
  else tempera(ctx, rng, hand, color, { rim: line, mottle: 0.4 });
  inkOutline(ctx, rng, hand, line, { closed: true, color: ink, pools: false });
  // Складки между пальцами.
  const fold = (a: [number, number], b: [number, number], bend = 0.14): void =>
    inkLine(ctx, rng, { x: a[0] * s, y: a[1] * s }, { x: b[0] * s, y: b[1] * s }, line * 0.62, {
      color: ink,
      bend,
    });
  fold([66, 33], [50, 33]);
  fold([58, 43], [46, 41]);
  fold([48, 51], [38, 47]);
  fold([52, 19], [44, 24], -0.2);
  // Манжета: расширяющийся рукав с каймой.
  const cuff = P([
    [3, 10, 1],
    [18, 15, 1],
    [20, 31],
    [18, 47, 1],
    [3, 52, 1],
    [6, 31],
  ]);
  shape(ctx, rng, cuff, opts.cuff ?? k.paperWhite, line, {
    rim: line * 0.7,
    ink: { color: ink, pools: false },
  });
  inkLine(ctx, rng, { x: 12 * s, y: 14.5 * s }, { x: 12 * s, y: 47.5 * s }, line * 0.55, {
    color: ink,
    bend: -0.08,
  });
}

// ───────────────────────────── текст ─────────────────────────────

/** Строка красной рубрики. Возвращает ширину текста. */
export function rubric(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  color: string | undefined,
  x: number,
  y: number,
  opts: { align?: CanvasTextAlign; baseline?: CanvasTextBaseline; maxWidth?: number } = {},
): number {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color ?? kc().rubric;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = opts.baseline ?? 'alphabetic';
  if (opts.maxWidth !== undefined) ctx.fillText(text, x, y, opts.maxWidth);
  else ctx.fillText(text, x, y);
  const width = ctx.measureText(text).width;
  ctx.restore();
  return width;
}

export interface WordColors {
  /** Первая буква — кармином. */
  initial: string;
  text: string;
  ribbon?: string;
  back?: string;
  ink?: string;
}

export interface WordOptions {
  /** Высота строчных букв, px. */
  px?: number;
  fontFamily?: string;
  /** Запас качества: во сколько раз крупнее рисовать холст. */
  scale?: number;
  curl?: number;
}

const wordCache = new Map<string, HTMLCanvasElement>();

/**
 * Слово-звук на бандероли: шрифт UnifrakturMaguntia, первая буква кармином.
 * Результат кэшируется по тексту, цветам и размеру.
 */
export function frakturWord(
  text: string,
  colors: WordColors,
  opts: WordOptions = {},
): HTMLCanvasElement {
  const px = opts.px ?? 30;
  const family = opts.fontFamily ?? 'UnifrakturMaguntia';
  const scale = opts.scale ?? 1;
  const curl = opts.curl ?? 0.6;
  const key = `${text}|${colors.initial}|${colors.text}|${colors.ribbon ?? ''}|${px}|${family}|${scale}|${curl}`;
  const cached = wordCache.get(key);
  if (cached) return cached;
  const font = `${px * scale}px "${family}", "Ruslan Display", serif`;
  const probe = ctx2d(makeCanvas(4, 4));
  probe.font = font;
  const textW = probe.measureText(text).width;
  const band = px * scale * 1.55;
  const h = band / 0.5 + 4;
  const ribbon: BanderoleOptions = {
    fill: colors.ribbon,
    back: colors.back,
    ink: colors.ink,
    seed: hashSeed(text),
  };
  // Ширина подбирается так, чтобы текст с полями лёг в прямоугольник ленты.
  const probeBox = banderoleTextBox(1000, h, curl, ribbon);
  const w = textW + (1000 - probeBox.w) + px * scale * 0.5;
  const canvas = makeCanvas(w, h);
  const ctx = ctx2d(canvas);
  banderole(ctx, w, h, curl, ribbon);
  const box = banderoleTextBox(w, h, curl, ribbon);
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const first = text.slice(0, 1);
  const rest = text.slice(1);
  const x = box.x + (box.w - textW) / 2;
  const y = h / 2 + px * scale * 0.05;
  ctx.fillStyle = colors.initial;
  ctx.fillText(first, x, y);
  ctx.fillStyle = colors.text;
  ctx.fillText(rest, x + ctx.measureText(first).width, y);
  wordCache.set(key, canvas);
  return canvas;
}

export function clearWordCache(): void {
  wordCache.clear();
}

// ───────────────────────────── кольца звука ─────────────────────────────

export type RingStyle = 'solid' | 'dashed' | 'dotted';

export interface RingOptions {
  cx?: number;
  cy?: number;
  color?: string;
  /** Толщина штриха: тонкое и толстое место пера. */
  wMin?: number;
  wMax?: number;
  /** Длина штриха и пробела для пунктира, px по окружности. */
  dash?: number;
  gap?: number;
  alpha?: number;
  /** Сколько концентрических колец и шаг между ними. */
  count?: number;
  spacing?: number;
  seed?: number;
  phase?: number;
}

/** Точки дуги окружности от a0 до a1. */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  step = 4,
): Vec[] {
  const len = Math.abs(a1 - a0) * r;
  const n = Math.max(2, Math.ceil(len / step));
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

/**
 * Расходящиеся кольца звука пером: сплошные, пунктирные или точечные.
 * Центр по умолчанию — (r, r) с запасом на толщину линии задаёт вызывающий.
 */
export function soundRings(
  ctx: CanvasRenderingContext2D,
  r: number,
  style: RingStyle,
  opts: RingOptions = {},
): void {
  const k = kc();
  const rng = mulberry32(opts.seed ?? 3);
  const cx = opts.cx ?? r;
  const cy = opts.cy ?? r;
  const color = opts.color ?? k.ink;
  const wMax = opts.wMax ?? Math.max(2, r * 0.02);
  const wMin = opts.wMin ?? wMax * 0.45;
  const count = opts.count ?? 1;
  const spacing = opts.spacing ?? wMax * 3;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  for (let c = 0; c < count; c++) {
    const rr = r - c * spacing;
    if (rr <= wMax) break;
    const fade = 1 - c * (0.6 / Math.max(1, count));
    if (style === 'solid') {
      const pts = wobble(
        rng,
        arcPath(cx, cy, rr, 0, Math.PI * 2 - 0.0001, 3),
        wMax * 0.18,
        true,
        40,
      );
      nibStroke(ctx, pts, wMin, wMax, NIB_ANGLE, { closed: true, color, alpha: fade });
    } else if (style === 'dashed') {
      const dash = opts.dash ?? wMax * 5;
      const gap = opts.gap ?? wMax * 3.2;
      const circ = Math.PI * 2 * rr;
      const n = Math.max(6, Math.round(circ / (dash + gap)));
      const unit = (Math.PI * 2) / n;
      const share = dash / (dash + gap);
      for (let i = 0; i < n; i++) {
        const a0 = (opts.phase ?? 0) + i * unit + (rng() - 0.5) * unit * 0.06;
        const pts = arcPath(cx, cy, rr + (rng() - 0.5) * wMax * 0.25, a0, a0 + unit * share, 2.5);
        nibStroke(ctx, pts, wMin, wMax, NIB_ANGLE, { color, alpha: fade, taper: 0.22 });
      }
    } else {
      const gap = opts.gap ?? wMax * 3.4;
      const circ = Math.PI * 2 * rr;
      const n = Math.max(8, Math.round(circ / gap));
      ctx.fillStyle = color;
      ctx.globalAlpha *= fade;
      for (let i = 0; i < n; i++) {
        const a = (opts.phase ?? 0) + (i / n) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(a) * rr,
          cy + Math.sin(a) * rr,
          wMax * (0.42 + rng() * 0.12),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha /= fade;
    }
  }
  ctx.restore();
}

// ───────────────────────────── мелочи ─────────────────────────────

/** Четырёхлучевая звёздочка — чернильная пометка и звёзды в окнах. */
export function starPath(
  cx: number,
  cy: number,
  r: number,
  points = 4,
  inner = 0.38,
  rot = 0,
): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inner;
    out.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return out;
}

/** Стрельчатая арка: прямые бока и два дуговых плеча, остриём вверх. */
export function lancetPath(x: number, y: number, w: number, h: number, steps = 12): Vec[] {
  const spring = y + h * 0.42;
  const out: Vec[] = [v(x, y + h), v(x, spring)];
  // Дуги с центрами в противоположных пятах арки.
  for (let i = 1; i <= steps; i++) {
    const a = Math.PI + (i / steps) * (Math.PI / 3);
    out.push({
      x: x + w + Math.cos(a) * w,
      y: spring + Math.sin(a) * w * ((spring - y) / (w * 0.866)),
    });
  }
  for (let i = steps - 1; i >= 0; i--) {
    const a = -(i / steps) * (Math.PI / 3);
    out.push({
      x: x + Math.cos(a) * w,
      y: spring + Math.sin(a) * w * ((spring - y) / (w * 0.866)),
    });
  }
  out.push(v(x + w, y + h));
  return out;
}

/** Картинка холста как data URL — для CSS-фонов интерфейса. */
export function toDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}
