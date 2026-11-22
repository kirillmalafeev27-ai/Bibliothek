/**
 * Dev-лист рукописного кита (`?scene=kit`): все примитивы на одном холсте —
 * чтобы оценивать руку, перо и золото без запуска игры.
 */
import { palette } from '../config/palette';
import { setupKit } from '../art/kit';
import { FONT, loadFonts } from '../shared/fonts';
import * as K from '../shared/manuscriptKit';

export async function showKitSheet(root: HTMLElement): Promise<void> {
  setupKit();
  await loadFonts();
  const W = 1200;
  const H = 1500;
  const page = K.parchment(K.mulberry32(1), W, H, { edge: 0.5 });
  const ctx = K.ctx2d(page);
  const rng = K.mulberry32(42);
  const label = (text: string, x: number, y: number): void => {
    K.rubric(ctx, text, `600 15px "${FONT.ui}"`, undefined, x, y);
  };

  // Перо.
  label('nibStroke / inkOutline', 30, 34);
  for (let i = 0; i < 5; i++) {
    const pts = K.spline(
      [K.v(30, 60 + i * 26), K.v(120, 44 + i * 26), K.v(220, 78 + i * 26), K.v(330, 54 + i * 26)],
      false,
      10,
    );
    K.nibStroke(ctx, pts, 1 + i * 0.6, 3 + i * 1.8);
  }
  K.inkOutline(ctx, rng, K.ellipsePath(430, 110, 60, 46, 60), 5);
  K.inkOutline(
    ctx,
    rng,
    K.pen([
      [520, 60, 1],
      [620, 60, 1],
      [620, 160, 1],
      [520, 160, 1],
    ]),
    5,
  );
  K.inkOutline(ctx, rng, K.blob(rng, 110, 100, { cx: 720, cy: 110, jitter: 0.2 }), 6);

  // Темпера.
  label('tempera + ink (shape)', 30, 214);
  const paints = [
    palette.librarian.robe,
    palette.hero.scarf,
    palette.take.base,
    palette.alarm.base,
    palette.shelf.wood,
    palette.floor.a,
    palette.floor.b,
    palette.hero.cap,
    palette.window.night,
    palette.librarian.skin,
  ];
  paints.forEach((c, i) => {
    const p = K.blob(rng, 88, 84, { cx: 80 + i * 112, cy: 276, jitter: 0.14, points: 9 });
    K.shape(ctx, rng, p, c, 5.5, { streak: 0.4 });
  });

  // Золото.
  label('goldLeaf', 30, 362);
  K.goldShape(ctx, rng, K.roundRectPath(30, 378, 150, 100, 8), 4, { punch: 9 });
  K.goldShape(ctx, rng, K.ellipsePath(270, 428, 56, 50, 50), 4.5, {});
  K.goldShape(ctx, rng, K.starPath(390, 428, 54, 8, 0.55), 3.5, {});
  K.goldShape(ctx, rng, K.lancetPath(470, 378, 70, 100), 4, { punch: 8 });
  ctx.save();
  ctx.translate(580, 378);
  K.diaper(
    ctx,
    rng,
    { x: 0, y: 0, w: 120, h: 100 },
    {
      a: palette.librarian.robe,
      b: palette.window.night,
      line: palette.gold.base,
      dot: palette.gold.light,
    },
    'lozenge',
    16,
  );
  ctx.translate(140, 0);
  K.diaper(
    ctx,
    rng,
    { x: 0, y: 0, w: 120, h: 100 },
    { a: palette.rubric, b: palette.alarm.dark, line: palette.gold.base, dot: palette.gold.light },
    'check',
    14,
  );
  ctx.restore();

  // Лоза.
  label('vine', 30, 520);
  const stem = K.spline(
    Array.from({ length: 14 }, (_, i) => K.v(40 + i * 86, 580 + Math.sin(i * 1.1) * 22)),
    false,
    10,
  );
  K.vine(ctx, rng, stem, { stem: 2, every: 38, curl: 16, leaf: 13 });
  const stem2 = K.spline(
    Array.from({ length: 14 }, (_, i) => K.v(40 + i * 86, 660 + Math.sin(i * 0.9 + 1) * 14)),
    false,
    10,
  );
  K.vine(ctx, rng, stem2, {
    stem: 1.4,
    every: 26,
    curl: 10,
    leaf: 8,
    gold: false,
    buds: false,
    alpha: 0.7,
  });

  // Бандероли и слова.
  label('banderole / frakturWord', 30, 730);
  const words = ['Psst!', 'Wer da?', 'Ausweis, bitte!', 'Rums!', 'Schnupper…', 'Ungültig!'];
  let wx = 30;
  let wy = 750;
  for (const w of words) {
    const c = K.frakturWord(
      w,
      { initial: palette.rubric, text: palette.ink },
      { px: 34, scale: 1 },
    );
    if (wx + c.width > W - 30) {
      wx = 30;
      wy += c.height + 6;
    }
    ctx.drawImage(c, wx, wy);
    wx += c.width + 14;
  }

  // Маникулы.
  label('manicule', 30, 960);
  const hands: [string, boolean][] = [
    [palette.derived.paperWhite, false],
    [palette.gold.base, true],
    [palette.alarm.base, false],
  ];
  hands.forEach(([color, gold], i) => {
    ctx.save();
    ctx.translate(40 + i * 230, 980);
    K.manicule(ctx, 200, color, { goldFill: gold });
    ctx.restore();
    ctx.save();
    ctx.translate(40 + i * 230 + 60, 1110);
    K.manicule(ctx, 58, color, { goldFill: gold });
    ctx.restore();
  });

  // Кольца.
  label('soundRings', 760, 960);
  K.soundRings(ctx, 110, 'solid', {
    cx: 880,
    cy: 1090,
    color: palette.derived.goldInk,
    wMax: 6,
    count: 3,
    spacing: 22,
  });
  K.soundRings(ctx, 110, 'dashed', {
    cx: 1070,
    cy: 1090,
    color: palette.derived.alarmInk,
    wMax: 5,
  });
  K.soundRings(ctx, 70, 'dotted', {
    cx: 1070,
    cy: 1090,
    color: palette.derived.ultramarine,
    wMax: 5,
  });

  // Пергамент без швов.
  label('parchment (tile ×2)', 30, 1230);
  const tile = K.parchment(K.mulberry32(7), 256, 256, { tile: true });
  ctx.drawImage(tile, 30, 1244, 256 * 0.9, 256 * 0.9);
  ctx.drawImage(tile, 30 + 256 * 0.9, 1244, 256 * 0.9, 256 * 0.9);
  K.rubric(ctx, 'Der blinde Bibliothekar', `52px "${FONT.fraktur}"`, palette.ink, 560, 1320);
  K.rubric(ctx, 'Слепой библиотекарь', `48px "${FONT.display}"`, palette.rubric, 560, 1390);
  K.rubric(
    ctx,
    'Ответ — шаг · Тихо: ошибку услышит',
    `600 22px "${FONT.ui}"`,
    undefined,
    560,
    1440,
  );

  page.style.cssText = 'display:block;max-width:none;';
  root.style.overflow = 'auto';
  root.appendChild(page);
  (window as unknown as { __sheetReady?: boolean }).__sheetReady = true;
}
