/**
 * Иконки интерфейса в стиле рукописи: части карты, словари, билеты с портретом героя,
 * штамп «Ungültig», звёзды, кнопки. Рисуются рукописным китом и отдаются в CSS как
 * data URL (переменные --icon-*), поэтому интерфейс и мир нарисованы одной рукой.
 */
import { palette } from '../config/palette';
import { FONT } from '../shared/fonts';
import * as K from '../shared/manuscriptKit';
import { drawPagePiece } from './recipes/mapArt';

export interface IconSet {
  page: [string, string, string];
  book: string;
  card: string;
  void: string;
  star: string;
  starOff: string;
  throw: string;
  stay: string;
  pause: string;
  settings: string;
}

const S = 96;

function make(draw: (ctx: CanvasRenderingContext2D, rng: K.Rand) => void, w = S, h = S, seed = 1): string {
  const canvas = K.makeCanvas(w, h);
  draw(K.ctx2d(canvas), K.mulberry32(seed));
  return canvas.toDataURL('image/png');
}

/** Словарь: толстая зелёная книга с латунными уголками (7.5.8). */
export function drawBookIcon(ctx: CanvasRenderingContext2D, rng: K.Rand, x: number, y: number, w: number, h: number, label = true): void {
  const lw = Math.max(1.2, w * 0.045);
  // Обрез страниц снизу.
  const pages = K.roundRectPath(x + w * 0.06, y + h * 0.62, w * 0.9, h * 0.3, w * 0.04);
  K.shape(ctx, rng, pages, palette.book.pages, lw, { rim: 1, mottle: 0.2 });
  for (let i = 1; i < 4; i++) {
    const yy = y + h * (0.66 + i * 0.06);
    K.nibStroke(ctx, [{ x: x + w * 0.14, y: yy }, { x: x + w * 0.9, y: yy }], 0.4, Math.max(0.6, w * 0.012), K.NIB_ANGLE, { color: palette.inkFaded });
  }
  // Переплёт.
  const cover = K.roundRectPath(x, y + h * 0.08, w * 0.94, h * 0.62, w * 0.06);
  K.shape(ctx, rng, cover, palette.book.cover, lw, { rim: w * 0.05, streak: 0.2 });
  // Корешок.
  K.nibStroke(ctx, [{ x: x + w * 0.16, y: y + h * 0.12 }, { x: x + w * 0.16, y: y + h * 0.66 }], lw * 0.5, lw, K.NIB_ANGLE);
  // Латунные уголки.
  for (const [cx, cy, sx, sy] of [
    [x + w * 0.94, y + h * 0.08, -1, 1],
    [x + w * 0.94, y + h * 0.7, -1, -1],
  ] as const) {
    const c = K.pen([
      [cx, cy, 1],
      [cx + sx * w * 0.2, cy, 1],
      [cx, cy + sy * h * 0.26, 1],
    ]);
    K.shape(ctx, rng, c, palette.book.corner, lw * 0.7, { rim: 0, mottle: 0 });
  }
  if (label && w >= 40) {
    K.rubric(ctx, 'Wörterbuch', `600 ${Math.round(w * 0.12)}px "${FONT.ui}"`, palette.take.light, x + w * 0.55, y + h * 0.44, {
      align: 'center',
      baseline: 'middle',
      maxWidth: w * 0.66,
    });
  }
}

/** Голова героя для портрета на билете: шапочка, лицо, оранжевый шарф. */
function drawHeroBust(ctx: CanvasRenderingContext2D, rng: K.Rand, cx: number, cy: number, s: number): void {
  const lw = Math.max(1, s * 0.06);
  const H = palette.hero;
  const scarf = K.pen([
    [cx - s * 0.5, cy + s * 0.38],
    [cx, cy + s * 0.5],
    [cx + s * 0.5, cy + s * 0.38],
    [cx + s * 0.42, cy + s * 0.62],
    [cx - s * 0.42, cy + s * 0.62],
  ]);
  K.shape(ctx, rng, scarf, H.scarf, lw, { rim: s * 0.04 });
  const face = K.ellipsePath(cx, cy, s * 0.4, s * 0.38, 20);
  K.shape(ctx, rng, face, H.skin, lw, { rim: s * 0.04 });
  const cap = K.pen([
    [cx - s * 0.44, cy - s * 0.06],
    [cx - s * 0.3, cy - s * 0.42],
    [cx + s * 0.1, cy - s * 0.56],
    [cx + s * 0.48, cy - s * 0.3],
    [cx + s * 0.44, cy - s * 0.06, 1],
    [cx, cy - s * 0.16],
  ]);
  K.shape(ctx, rng, cap, H.cap, lw, { rim: s * 0.04 });
  for (const ex of [-0.14, 0.14]) {
    ctx.fillStyle = palette.ink;
    ctx.beginPath();
    ctx.arc(cx + ex * s, cy + s * 0.04, Math.max(0.8, s * 0.045), 0, Math.PI * 2);
    ctx.fill();
  }
  K.nibStroke(
    ctx,
    K.spline([{ x: cx - s * 0.1, y: cy + s * 0.18 }, { x: cx, y: cy + s * 0.23 }, { x: cx + s * 0.1, y: cy + s * 0.18 }], false, 6),
    lw * 0.4,
    lw * 0.8,
  );
}

/** Читательский билет с портретом героя. */
export function drawCardIcon(ctx: CanvasRenderingContext2D, rng: K.Rand, x: number, y: number, w: number, h: number): void {
  const lw = Math.max(1, w * 0.04);
  const card = K.roundRectPath(x, y, w, h, w * 0.06);
  K.shape(ctx, rng, card, palette.derived.paperWhite, lw, { rim: w * 0.03, mottle: 0.3 });
  // Рамка портрета.
  const px = x + w * 0.08;
  const py = y + h * 0.16;
  const ps = h * 0.68;
  K.shape(ctx, rng, K.rectPath(px, py, ps, ps), palette.parchmentShade, lw * 0.6, { rim: 1 });
  drawHeroBust(ctx, rng, px + ps / 2, py + ps * 0.46, ps * 0.62);
  // Строки «заполненного» билета.
  for (let i = 0; i < 3; i++) {
    const yy = y + h * (0.3 + i * 0.2);
    K.nibStroke(ctx, [{ x: px + ps + w * 0.08, y: yy }, { x: x + w * (0.9 - i * 0.1), y: yy }], 0.5, Math.max(0.8, w * 0.02), K.NIB_ANGLE, {
      color: i === 0 ? palette.rubric : palette.inkFaded,
    });
  }
}

/** Штамп «Ungültig» кармином. */
function drawVoid(ctx: CanvasRenderingContext2D, rng: K.Rand, w: number, h: number): void {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.21);
  const bw = w * 0.92;
  const bh = h * 0.36;
  const box = K.roundRectPath(-bw / 2, -bh / 2, bw, bh, bh * 0.16);
  ctx.save();
  ctx.globalAlpha = 0.9;
  K.inkOutline(ctx, rng, box, Math.max(1.5, h * 0.045), { color: palette.alarm.base, pools: false, jitter: 0.8 });
  ctx.font = `700 ${Math.round(bh * 0.6)}px "${FONT.ui}"`;
  ctx.fillStyle = palette.alarm.base;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Ungültig', 0, bh * 0.04, bw * 0.86);
  ctx.restore();
  ctx.restore();
}

/** Звезда: сусальное золото с чернильным контуром или пустой контур. */
function drawStar(ctx: CanvasRenderingContext2D, rng: K.Rand, on: boolean): void {
  const star = K.starPath(S / 2, S / 2 + 3, S * 0.44, 5, 0.46);
  const soft = K.chaikin(star, 1, true);
  if (on) K.goldShape(ctx, rng, soft, S * 0.05, { cracks: 3, ink: { pools: false } });
  else K.inkOutline(ctx, rng, soft, S * 0.04, { color: palette.inkFaded, pools: false });
}

export function buildIcons(): IconSet {
  return {
    page: [0, 1, 2].map((i) => make((ctx) => drawPagePiece(ctx, i, S, false), S, S, 10 + i)) as [string, string, string],
    book: make((ctx, rng) => drawBookIcon(ctx, rng, S * 0.06, S * 0.14, S * 0.88, S * 0.72), S, S, 2),
    card: make((ctx, rng) => drawCardIcon(ctx, rng, S * 0.04, S * 0.2, S * 0.92, S * 0.62), S, S, 3),
    void: make((ctx, rng) => drawVoid(ctx, rng, S, S), S, S, 4),
    star: make((ctx, rng) => drawStar(ctx, rng, true), S, S, 5),
    starOff: make((ctx, rng) => drawStar(ctx, rng, false), S, S, 6),
    throw: make((ctx, rng) => {
      drawBookIcon(ctx, rng, S * 0.36, S * 0.42, S * 0.56, S * 0.46, false);
      const arc = K.spline([{ x: S * 0.08, y: S * 0.86 }, { x: S * 0.24, y: S * 0.2 }, { x: S * 0.52, y: S * 0.3 }], false, 10);
      const dashes = K.resample(arc, S * 0.08, false);
      for (let i = 0; i + 1 < dashes.length; i += 2) K.nibStroke(ctx, [dashes[i]!, dashes[i + 1]!], 1.2, S * 0.05);
    }, S, S, 7),
    stay: make((ctx, rng) => {
      // Раскрытая ладонь: «стой».
      const palm = K.pen([
        [S * 0.3, S * 0.92],
        [S * 0.24, S * 0.6],
        [S * 0.16, S * 0.42],
        [S * 0.24, S * 0.38],
        [S * 0.34, S * 0.52, 1],
        [S * 0.33, S * 0.16],
        [S * 0.42, S * 0.12],
        [S * 0.46, S * 0.44, 1],
        [S * 0.5, S * 0.08],
        [S * 0.6, S * 0.08],
        [S * 0.6, S * 0.44, 1],
        [S * 0.66, S * 0.14],
        [S * 0.75, S * 0.16],
        [S * 0.72, S * 0.48, 1],
        [S * 0.78, S * 0.28],
        [S * 0.86, S * 0.32],
        [S * 0.8, S * 0.66],
        [S * 0.7, S * 0.92],
      ]);
      K.shape(ctx, rng, palm, palette.derived.paperWhite, S * 0.05, { rim: S * 0.03, ink: { pools: false } });
    }, S, S, 8),
    pause: make((ctx, rng) => {
      for (const x of [0.3, 0.58]) {
        K.shape(ctx, rng, K.roundRectPath(S * x, S * 0.2, S * 0.14, S * 0.6, S * 0.04), palette.ink, 0, { rim: 0 });
      }
    }, S, S, 9),
    settings: make((ctx, rng) => {
      // Перо в чернильнице — настройки.
      const quill = K.pen([
        [S * 0.22, S * 0.86, 1],
        [S * 0.4, S * 0.5],
        [S * 0.7, S * 0.14],
        [S * 0.86, S * 0.1, 1],
        [S * 0.8, S * 0.28],
        [S * 0.5, S * 0.6],
      ]);
      K.shape(ctx, rng, quill, palette.derived.paperWhite, S * 0.045, { rim: 1, ink: { pools: false } });
      K.nibStroke(ctx, [{ x: S * 0.24, y: S * 0.84 }, { x: S * 0.76, y: S * 0.2 }], 0.8, S * 0.025);
    }, S, S, 12),
  };
}

/** Иконки — в CSS-переменные корня игры. */
export function applyIcons(root: HTMLElement, icons: IconSet): void {
  const set = (name: string, url: string): void => root.style.setProperty(name, `url(${url})`);
  icons.page.forEach((u, i) => set(`--icon-page-${i}`, u));
  set('--icon-book', icons.book);
  set('--icon-card', icons.card);
  set('--icon-void', icons.void);
  set('--icon-star', icons.star);
  set('--icon-star-off', icons.starOff);
  set('--icon-throw', icons.throw);
  set('--icon-stay', icons.stay);
  set('--icon-pause', icons.pause);
  set('--icon-settings', icons.settings);
}
