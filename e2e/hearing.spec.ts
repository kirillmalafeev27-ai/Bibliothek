/**
 * Тест читаемости слуха (план, 8.4). Сцена ?scene=hearing фотографируется дважды:
 * с элементом и без него. Пиксели, которые изменились, — это линия; их цвет на кадре
 * с элементом сравнивается с цветом тех же пикселей без него (фон рядом с линией).
 * Контраст по WCAG считается отдельно для плитки каждого из двух тонов.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface Region {
  cx: number;
  cy: number;
  r0: number;
  r1: number;
  /** Только тёмные пиксели элемента (контур маникулы). */
  dark?: boolean;
  box?: { x: number; y: number; w: number; h: number };
}

interface ToneResult {
  a: number | null;
  b: number | null;
  counts: { a: number; b: number };
}

declare global {
  interface Window {
    __hearing?: {
      show: (what: string, on: boolean) => void;
      geometry: () => Record<string, unknown>;
    };
  }
}

interface Board {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

async function analyze(
  page: Page,
  withEl: Buffer,
  without: Buffer,
  region: Region,
  board: Board,
  cell: number,
): Promise<ToneResult> {
  return page.evaluate(
    async ({ a, b, region, board, cell }) => {
      const load = (src: string): Promise<ImageData> =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            resolve(ctx.getImageData(0, 0, c.width, c.height));
          };
          img.src = src;
        });
      const A = await load(`data:image/png;base64,${a}`);
      const B = await load(`data:image/png;base64,${b}`);
      const lin = (v: number): number => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const lum = (r: number, g: number, bl: number): number =>
        0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
      type Acc = { l: [number, number, number]; g: [number, number, number]; n: number };
      const acc: { a: Acc; b: Acc } = {
        a: { l: [0, 0, 0], g: [0, 0, 0], n: 0 },
        b: { l: [0, 0, 0], g: [0, 0, 0], n: 0 },
      };
      const x0 = Math.max(0, Math.floor(region.box ? region.box.x : region.cx - region.r1 - 2));
      const y0 = Math.max(0, Math.floor(region.box ? region.box.y : region.cy - region.r1 - 2));
      const x1 = Math.min(
        A.width - 1,
        Math.ceil(region.box ? region.box.x + region.box.w : region.cx + region.r1 + 2),
      );
      const y1 = Math.min(
        A.height - 1,
        Math.ceil(region.box ? region.box.y + region.box.h : region.cy + region.r1 + 2),
      );
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (!region.box) {
            const d = Math.hypot(x + 0.5 - region.cx, y + 0.5 - region.cy);
            if (d < region.r0 || d > region.r1) continue;
          }
          const i = (y * A.width + x) * 4;
          const diff =
            Math.abs(A.data[i]! - B.data[i]!) +
            Math.abs(A.data[i + 1]! - B.data[i + 1]!) +
            Math.abs(A.data[i + 2]! - B.data[i + 2]!);
          if (diff < 45) continue;
          if (region.dark && lum(A.data[i]!, A.data[i + 1]!, A.data[i + 2]!) > 0.06) continue;
          const tx = Math.floor((x - board.x) / cell);
          const ty = Math.floor((y - board.y) / cell);
          // Только плитка пола: стены и рамку не считаем.
          if (tx < 1 || ty < 1 || tx > board.cols - 2 || ty > board.rows - 2) continue;
          const tone = (tx + ty) % 2 === 0 ? 'a' : 'b';
          const t = acc[tone];
          t.l[0] += A.data[i]!;
          t.l[1] += A.data[i + 1]!;
          t.l[2] += A.data[i + 2]!;
          t.g[0] += B.data[i]!;
          t.g[1] += B.data[i + 1]!;
          t.g[2] += B.data[i + 2]!;
          t.n++;
        }
      }
      const contrast = (t: Acc): number | null => {
        if (t.n < 25) return null;
        const la = lum(t.l[0] / t.n, t.l[1] / t.n, t.l[2] / t.n);
        const lb = lum(t.g[0] / t.n, t.g[1] / t.n, t.g[2] / t.n);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
      };
      return { a: contrast(acc.a), b: contrast(acc.b), counts: { a: acc.a.n, b: acc.b.n } };
    },
    { a: withEl.toString('base64'), b: without.toString('base64'), region, board, cell },
  );
}

test('8.4: нимб, кольца и маникула читаются на плитке обоих тонов', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?scene=hearing');
  await page.waitForFunction(() => !!window.__hearing, null, { timeout: 60_000 });
  await page.waitForTimeout(1500);
  const geo = (await page.evaluate(() => window.__hearing!.geometry())) as {
    cell: number;
    board: { x: number; y: number };
    librarian: { x: number; y: number };
    hero: { x: number; y: number };
    target: { x: number; y: number };
    hearR: number;
    loudR: number;
  };
  const world = (await page.locator('.lib-world').boundingBox())!;
  const off = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: p.x + world.x,
    y: p.y + world.y,
  });
  const board = { ...off(geo.board), cols: 9, rows: 11 };
  const c = geo.cell;
  const all = ['halo', 'loud', 'rings', 'hands', 'prints'];
  /** Пара кадров для одного элемента: остальные элементы слуха скрыты. */
  const shotWithout = async (what: string): Promise<[Buffer, Buffer]> => {
    await page.evaluate(
      ({ all, what }) => {
        for (const w of all) window.__hearing!.show(w, w === what);
      },
      { all, what },
    );
    await page.waitForTimeout(250);
    const a = await page.screenshot();
    await page.evaluate((w) => window.__hearing!.show(w, false), what);
    await page.waitForTimeout(250);
    const b = await page.screenshot();
    return [a, b];
  };
  const lib = off(geo.librarian);
  const hero = off(geo.hero);
  const target = off(geo.target);

  const results: Record<string, ToneResult> = {};
  {
    const [a, b] = await shotWithout('halo');
    results.halo = await analyze(
      page,
      a,
      b,
      { cx: lib.x, cy: lib.y, r0: geo.hearR * c - 0.03 * c, r1: geo.hearR * c + 0.04 * c },
      board,
      c,
    );
  }
  {
    const [a, b] = await shotWithout('loud');
    results.loud = await analyze(
      page,
      a,
      b,
      { cx: lib.x, cy: lib.y, r0: geo.loudR * c - 0.035 * c, r1: geo.loudR * c + 0.035 * c },
      board,
      c,
    );
  }
  {
    const [a, b] = await shotWithout('rings');
    results.error = await analyze(
      page,
      a,
      b,
      { cx: hero.x, cy: hero.y, r0: geo.loudR * c - 0.06 * c, r1: geo.loudR * c + 0.06 * c },
      board,
      c,
    );
  }
  {
    const [a, b] = await shotWithout('hands');
    results.manicule = await analyze(
      page,
      a,
      b,
      {
        cx: 0,
        cy: 0,
        r0: 0,
        r1: 0,
        dark: true,
        box: { x: target.x - c * 1.2, y: target.y - c * 0.9, w: c * 2.4, h: c * 1.8 },
      },
      board,
      c,
    );
  }
  console.log(JSON.stringify(results, null, 1));
  const need: Record<string, number> = { halo: 3, loud: 3, error: 3, manicule: 4.5 };
  for (const [name, min] of Object.entries(need)) {
    const r = results[name]!;
    expect(r.a !== null || r.b !== null, `${name}: линия не найдена`).toBe(true);
    for (const tone of ['a', 'b'] as const) {
      const v = r[tone];
      if (v === null) continue;
      expect(v, `${name}: контраст к плитке тона ${tone}`).toBeGreaterThanOrEqual(min);
    }
  }
  // Нимб и кольца пересекают плитку обоих тонов.
  for (const name of ['halo', 'loud', 'error']) {
    expect(results[name]!.a, `${name} на светлой плитке`).not.toBeNull();
    expect(results[name]!.b, `${name} на тёмной плитке`).not.toBeNull();
  }
});
