/**
 * Тема раскладки «пергамент» — общая для игр серии в стиле рукописи (план, 11.1.4).
 * Просветы — пергамент с лозой по краю, панель мира — миниатюра в золотой рамке,
 * панель вопроса — столбец текста. Краски передаёт игра; своих цветов у темы нет.
 */
import * as K from '../manuscriptKit';

export interface ThemeColors {
  parchment: string;
  parchmentShade: string;
  parchmentEdge: string;
  paperWhite: string;
  ink: string;
  inkFaded: string;
  rubric: string;
  gold: { base: string; light: string; dark: string };
  goldInk: string;
  alarmDark: string;
  good: string;
  bad: string;
  /** Ультрамарин: фон инициала и обводка фокуса. */
  blue: string;
  blueDeep: string;
}

/** CSS-переменные темы. Вызывается сразу, до загрузки шрифтов и текстур. */
export function applyParchmentVars(root: HTMLElement, c: ThemeColors): void {
  const set = (name: string, value: string): void => root.style.setProperty(name, value);
  set('--ink', c.ink);
  set('--ink-faded', c.inkFaded);
  set('--ink-hair', K.withAlpha(c.ink, 0.34));
  set('--ink-shadow', K.withAlpha(c.ink, 0.55));
  set('--parchment', c.parchment);
  set('--parchment-shade', c.parchmentShade);
  set('--panel', K.withAlpha(c.paperWhite, 0.62));
  set('--panel-solid', K.blend(c.parchment, c.paperWhite, 0.62));
  set('--tablet', K.blend(c.parchment, c.paperWhite, 0.5));
  set('--tablet-hi', c.paperWhite);
  set('--tablet-lo', K.blend(c.parchment, c.parchmentShade, 0.45));
  set('--rubric', c.rubric);
  set('--alarm-dark', c.alarmDark);
  set('--gold', c.gold.base);
  set('--gold-light', c.gold.light);
  set('--gold-dark', c.gold.dark);
  set('--gold-ink', c.goldInk);
  set('--gold-glow', K.withAlpha(c.gold.base, 0.45));
  set('--good', c.good);
  set('--good-glow', K.withAlpha(c.good, 0.5));
  set('--bad', c.bad);
  set('--robe', c.blue);
  set('--edge-soft', K.withAlpha(c.parchmentEdge, 0.55));
  set('--edge-hard', K.withAlpha(c.parchmentEdge, 0.9));
  set('--veil', K.withAlpha(c.ink, 0.5));
  set('--veil-strong', K.withAlpha(c.ink, 0.86));
  set('--glint', K.withAlpha(c.paperWhite, 0.75));
  set('--vine-size', '18px');
}

function url(canvas: HTMLCanvasElement): string {
  return `url(${canvas.toDataURL('image/png')})`;
}

/** Уголок: золотой треугольник с завитком — на панели, карточки и таблички. */
function cornerTexture(size: number, seed: number): HTMLCanvasElement {
  const canvas = K.makeCanvas(size, size);
  const ctx = K.ctx2d(canvas);
  const rng = K.mulberry32(seed);
  const s = size;
  const tri = K.pen(
    [
      [s * 0.04, s * 0.04, 1],
      [s * 0.96, s * 0.04, 1],
      [s * 0.62, s * 0.2],
      [s * 0.3, s * 0.3],
      [s * 0.2, s * 0.62],
      [s * 0.04, s * 0.96, 1],
    ],
    true,
    6,
  );
  K.goldShape(ctx, rng, tri, Math.max(1, s * 0.05), { cracks: s > 24 ? 3 : 1, ink: { pools: false } });
  if (s >= 24) {
    const curl = K.curlPath(s * 0.3, s * 0.3, s * 0.3, Math.PI * 0.25, 1, 1.1);
    K.nibStroke(ctx, curl, s * 0.02, s * 0.05, K.NIB_ANGLE, { taper: 0.12 });
  }
  return canvas;
}

/** Полоса лозы для края страницы: бесшовная по длине. */
function vineStrip(length: number, thickness: number, seed: number, colors: ThemeColors): HTMLCanvasElement {
  const scale = 2;
  const canvas = K.makeCanvas(length * scale, thickness * scale);
  const ctx = K.ctx2d(canvas);
  ctx.scale(scale, scale);
  // Период синусоиды укладывается в длину целое число раз — полоса замыкается сама на себя.
  const waves = Math.max(2, Math.round(length / 110));
  const draw = (offset: number): void => {
    const rng = K.mulberry32(seed);
    const pts: K.Vec[] = [];
    for (let x = -20; x <= length + 20; x += 6) {
      pts.push({
        x: x + offset,
        y: thickness * 0.5 + Math.sin((x / length) * Math.PI * 2 * waves) * thickness * 0.2,
      });
    }
    K.vine(ctx, rng, pts, {
      stem: 1.1,
      every: 22,
      curl: thickness * 0.34,
      leaf: thickness * 0.42,
      color: colors.inkFaded,
      alpha: 0.9,
    });
  };
  draw(0);
  return canvas;
}

function rotate90(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = K.makeCanvas(src.height, src.width);
  const ctx = K.ctx2d(out);
  ctx.translate(src.height, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return out;
}

/** Линейка-разделитель: росчерк пера с ромбом посередине. */
function ruleTexture(colors: ThemeColors): HTMLCanvasElement {
  const w = 480;
  const h = 24;
  const canvas = K.makeCanvas(w, h);
  const ctx = K.ctx2d(canvas);
  const rng = K.mulberry32(77);
  const mid = h / 2;
  for (const dir of [-1, 1]) {
    const pts = K.spline(
      [
        { x: w / 2 + dir * 16, y: mid },
        { x: w / 2 + dir * 90, y: mid - 2 },
        { x: w / 2 + dir * 170, y: mid + 2 },
        { x: w / 2 + dir * 232, y: mid },
      ],
      false,
      10,
    );
    K.nibStroke(ctx, pts, 0.8, 2.6, K.NIB_ANGLE, { color: colors.inkFaded, taper: 0.3 });
    const curl = K.curlPath(w / 2 + dir * 232, mid, 8, dir > 0 ? 0 : Math.PI, dir > 0 ? -1 : 1, 1.1);
    K.nibStroke(ctx, curl, 0.6, 1.6, K.NIB_ANGLE, { color: colors.inkFaded, taper: 0.12 });
  }
  K.goldShape(ctx, rng, K.starPath(w / 2, mid, 9, 4, 0.5), 1.6, { cracks: 1, ink: { pools: false } });
  return canvas;
}

/**
 * Процедурные текстуры страницы: пергамент, лоза по краю, золотые уголки, фон инициала.
 * Вызывается после configureKit(); занимает несколько десятков миллисекунд.
 */
export function applyParchmentTextures(root: HTMLElement, colors: ThemeColors, seed = 1): void {
  const set = (name: string, value: string): void => root.style.setProperty(name, value);
  const tile = 384;
  set('--tex-parchment', url(K.parchment(K.mulberry32(seed), tile, tile, { tile: true })));
  set(
    '--tex-parchment-light',
    url(
      K.parchment(K.mulberry32(seed + 1), tile, tile, {
        tile: true,
        base: K.blend(colors.parchment, colors.paperWhite, 0.62),
        density: 0.55,
      }),
    ),
  );
  const strip = vineStrip(440, 18, seed + 2, colors);
  set('--tex-vine-h', url(strip));
  set('--tex-vine-v', url(rotate90(strip)));
  set('--tex-corner', url(cornerTexture(68, seed + 3)));
  set('--tex-corner-small', url(cornerTexture(26, seed + 4)));
  set('--tex-rule', url(ruleTexture(colors)));

  // Фон инициала: ромбы ультрамарина с золотой сеткой.
  const initial = K.makeCanvas(96, 96);
  K.diaper(
    K.ctx2d(initial),
    K.mulberry32(seed + 5),
    { x: 0, y: 0, w: 96, h: 96 },
    { a: colors.blue, b: colors.blueDeep, line: K.withAlpha(colors.gold.base, 0.85), dot: colors.gold.light },
    'lozenge',
    24,
  );
  set('--tex-initial', url(initial));

  // Сусальное золото для кнопок и инициала названия.
  const gold = K.makeCanvas(180, 180);
  const gctx = K.ctx2d(gold);
  K.goldLeaf(gctx, K.mulberry32(seed + 6), K.rectPath(-4, -4, 188, 188), { cracks: 26 });
  set('--tex-gold', url(gold));
}
