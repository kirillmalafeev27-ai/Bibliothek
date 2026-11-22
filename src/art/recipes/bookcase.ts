/**
 * Ряды стеллажей (план, 7.5.3): тёмные деревянные рамы высотой полклетки. Сверху видны
 * верхние обрезы книг, спереди — корешки приглушённых цветов со светлыми полосками
 * названий. Кое-где книги прикованы цепью, как в старых библиотеках, — это декор.
 */
import { palette } from '../../config/palette';
import { SHELF } from '../manifest';
import * as K from '../../shared/manuscriptKit';
import { dot, inkW } from './common';

const SP = palette.spines;

/** Верхние обрезы книг: ряд обложек с кремовым блоком страниц внутри. */
function bookTops(
  ctx: CanvasRenderingContext2D,
  rng: K.Rand,
  x0: number,
  y0: number,
  len: number,
  depth: number,
  ppc: number,
  vertical: boolean,
): void {
  let t = 0;
  while (t < len - ppc * 0.02) {
    const thick = Math.min(len - t, ppc * (0.05 + rng() * 0.06));
    const d = depth * (0.72 + rng() * 0.26);
    const off = (depth - d) * (0.3 + rng() * 0.5);
    const cover = K.pick(rng, SP);
    const r = vertical
      ? K.rectPath(x0 + off, y0 + t, d, thick - ppc * 0.006)
      : K.rectPath(x0 + t, y0 + off, thick - ppc * 0.006, d);
    ctx.save();
    ctx.beginPath();
    K.tracePath(ctx, r, true);
    ctx.fillStyle = cover;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = K.withAlpha(palette.parchmentShade, 0.62);
    if (vertical)
      ctx.fillRect(x0 + off + ppc * 0.02, y0 + t + thick * 0.24, d - ppc * 0.03, thick * 0.42);
    else ctx.fillRect(x0 + t + thick * 0.24, y0 + off + ppc * 0.02, thick * 0.42, d - ppc * 0.03);
    t += thick;
    // Иногда — прислонённая книга или пустое место.
    if (rng() < 0.06) t += ppc * 0.05;
  }
}

/** Корешки на лицевой полке. */
function spines(
  ctx: CanvasRenderingContext2D,
  rng: K.Rand,
  x0: number,
  x1: number,
  base: number,
  hMax: number,
  ppc: number,
): number[] {
  const chained: number[] = [];
  let x = x0;
  while (x < x1 - ppc * 0.03) {
    const w = Math.min(x1 - x, ppc * (0.055 + rng() * 0.06));
    const h = hMax * (0.7 + rng() * 0.3);
    const color = K.pick(rng, SP);
    const spine = K.roundRectPath(x, base - h, w - ppc * 0.008, h, ppc * 0.006, 2);
    K.tempera(ctx, rng, spine, color, { rim: ppc * 0.006, mottle: 0.35 });
    // Полоски названий и бинты корешка.
    ctx.fillStyle = K.withAlpha(palette.parchment, 0.6);
    ctx.fillRect(x + w * 0.18, base - h * 0.8, w * 0.52, Math.max(1, ppc * 0.012));
    ctx.fillRect(x + w * 0.18, base - h * 0.62, w * 0.52, Math.max(1, ppc * 0.008));
    if (rng() < 0.5) ctx.fillRect(x + w * 0.18, base - h * 0.24, w * 0.52, Math.max(1, ppc * 0.01));
    K.nibStroke(
      ctx,
      [
        { x: x + w - ppc * 0.006, y: base - h },
        { x: x + w - ppc * 0.006, y: base },
      ],
      ppc * 0.003,
      ppc * 0.008,
      K.NIB_ANGLE,
      {
        color: palette.ink,
        alpha: 0.6,
      },
    );
    if (rng() < 0.09) chained.push(x + w / 2);
    x += w;
    if (rng() < 0.05) {
      // Наклонённая книга.
      x += ppc * 0.035;
    }
  }
  return chained;
}

/** Цепь от корешка к перекладине — книги «на цепи», как в старых библиотеках. */
function chain(
  ctx: CanvasRenderingContext2D,
  x: number,
  yTop: number,
  yBottom: number,
  ppc: number,
): void {
  const links = Math.max(2, Math.round((yBottom - yTop) / (ppc * 0.035)));
  for (let i = 0; i < links; i++) {
    const y = yTop + ((yBottom - yTop) * (i + 0.5)) / links;
    const sway = Math.sin(i * 0.9) * ppc * 0.012;
    const ring = K.ellipsePath(x + sway, y, ppc * (i % 2 ? 0.008 : 0.014), ppc * 0.018, 10);
    K.nibStroke(ctx, ring, ppc * 0.003, ppc * 0.008, K.NIB_ANGLE, {
      closed: true,
      color: palette.derived.iron,
    });
  }
}

export function drawShelf(
  ctx: CanvasRenderingContext2D,
  dir: 'h' | 'v',
  len: number,
  ppc: number,
  seed: number,
): void {
  const rng = K.mulberry32(seed);
  const lw = inkW(ppc, 0.6);
  const front = SHELF.front * ppc;
  if (dir === 'h') {
    const W = len * ppc;
    const H = (1 + SHELF.overhang) * ppc;
    const topH = H - front;
    // Верхняя грань: рама и обрезы книг.
    const top = K.roundRectPath(
      ppc * 0.02,
      ppc * 0.04,
      W - ppc * 0.04,
      topH - ppc * 0.02,
      ppc * 0.04,
    );
    K.shape(ctx, rng, top, palette.shelf.top, lw, { rim: ppc * 0.02, streak: 0 });
    bookTops(ctx, rng, ppc * 0.07, ppc * 0.1, W - ppc * 0.14, topH - ppc * 0.2, ppc, false);
    // Перегородки.
    for (let i = 1; i < len; i++) {
      const x = i * ppc;
      ctx.fillStyle = palette.shelf.wood;
      ctx.fillRect(x - ppc * 0.025, ppc * 0.06, ppc * 0.05, topH - ppc * 0.06);
    }
    // Лицевая грань: рама и корешки.
    const face = K.rectPath(ppc * 0.02, topH, W - ppc * 0.04, front - ppc * 0.02);
    K.shape(ctx, rng, face, palette.shelf.wood, lw, { rim: ppc * 0.02, streak: Math.PI / 2 });
    const inset = ppc * 0.06;
    ctx.fillStyle = palette.shelf.top;
    ctx.fillRect(inset, topH + ppc * 0.05, W - inset * 2, front - ppc * 0.13);
    const base = topH + front - ppc * 0.08;
    const chained = spines(
      ctx,
      rng,
      inset + ppc * 0.01,
      W - inset - ppc * 0.01,
      base,
      front - ppc * 0.16,
      ppc,
    );
    // Нижняя перекладина и цепи.
    K.shape(
      ctx,
      rng,
      K.rectPath(ppc * 0.03, base, W - ppc * 0.06, ppc * 0.055),
      palette.shelf.woodLight,
      inkW(ppc, 0.4),
      { rim: 0 },
    );
    for (const cx of chained) chain(ctx, cx, base - front * 0.45, base + ppc * 0.03, ppc);
    for (let i = 0; i <= len; i++) {
      const x = Math.min(W - ppc * 0.05, Math.max(ppc * 0.05, i * ppc));
      K.shape(
        ctx,
        rng,
        K.rectPath(x - ppc * 0.03, topH, ppc * 0.06, front - ppc * 0.02),
        palette.shelf.woodLight,
        inkW(ppc, 0.4),
        { rim: 0 },
      );
      dot(ctx, x, topH + ppc * 0.06, ppc * 0.012, palette.derived.brass);
    }
    K.inkOutline(ctx, rng, K.rectPath(ppc * 0.02, ppc * 0.04, W - ppc * 0.04, H - ppc * 0.06), lw, {
      closed: true,
      pools: false,
    });
    K.grainOver(ctx, rng, W, H, 0.05);
    return;
  }
  // Вертикальный ряд (ландшафт): длинная верхняя грань и торец спереди.
  const W = ppc;
  const H = (len + SHELF.overhang) * ppc;
  const topH = H - front;
  const top = K.roundRectPath(ppc * 0.04, ppc * 0.02, W - ppc * 0.08, topH, ppc * 0.04);
  K.shape(ctx, rng, top, palette.shelf.top, lw, { rim: ppc * 0.02, streak: Math.PI / 2 });
  // Книги стоят в два ряда — корешками в обе стороны.
  bookTops(ctx, rng, ppc * 0.1, ppc * 0.08, topH - ppc * 0.12, ppc * 0.38, ppc, true);
  bookTops(ctx, rng, ppc * 0.52, ppc * 0.08, topH - ppc * 0.12, ppc * 0.38, ppc, true);
  ctx.fillStyle = palette.shelf.wood;
  ctx.fillRect(ppc * 0.48, ppc * 0.04, ppc * 0.04, topH - ppc * 0.04);
  for (let i = 1; i < len; i++) {
    ctx.fillRect(ppc * 0.06, i * ppc - ppc * 0.02, W - ppc * 0.12, ppc * 0.04);
  }
  // Торец: резная доска с четырёхлистником.
  const face = K.rectPath(ppc * 0.04, topH, W - ppc * 0.08, front - ppc * 0.02);
  K.shape(ctx, rng, face, palette.shelf.wood, lw, { rim: ppc * 0.02, streak: Math.PI / 2 });
  const cx = W / 2;
  const cy = topH + front * 0.48;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const lobe = K.ellipsePath(
      cx + Math.cos(a) * ppc * 0.07,
      cy + Math.sin(a) * ppc * 0.07,
      ppc * 0.07,
      ppc * 0.07,
      14,
    );
    K.shape(ctx, rng, lobe, palette.shelf.top, inkW(ppc, 0.3), { rim: 0, ink: { pools: false } });
  }
  K.inkOutline(ctx, rng, K.rectPath(ppc * 0.04, ppc * 0.02, W - ppc * 0.08, H - ppc * 0.04), lw, {
    closed: true,
    pools: false,
  });
  K.grainOver(ctx, rng, W, H, 0.05);
}
