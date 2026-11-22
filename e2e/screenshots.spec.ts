/**
 * Скриншоты в целевых размерах и проверки раскладки (план, 0.9, 16 «Устройства»):
 * клетка не меньше 36 CSS px, нет горизонтальной прокрутки, панели не перекрываются.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __lib?: {
      inspect: () => {
        phase: string;
        state: { status: string; hero: { cell: { x: number; y: number } } } | null;
        layout: {
          cell: number;
          orientation: string;
          world: { x: number; y: number; w: number; h: number };
          question: { x: number; y: number; w: number; h: number };
        } | null;
        scene: { orient: string | null } | null;
      };
    };
  }
}

const SIZES: [number, number][] = [
  [360, 640],
  [390, 844],
  [768, 1024],
  [1280, 720],
  [1920, 1080],
];

async function boot(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => window.__lib && window.__lib.inspect().phase !== 'boot', null, {
    timeout: 60_000,
  });
  // Подсказки обучения не мешают снимкам.
  await page.evaluate(() =>
    setInterval(() => {
      const b = document.querySelector<HTMLButtonElement>('.lib-bubble button');
      b?.click();
    }, 80),
  );
}

for (const [w, h] of SIZES) {
  test(`раскладка ${w}×${h}: клетка ≥ 36 px, панели на месте`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page, '/?level=2');
    await page.waitForFunction(() => window.__lib!.inspect().phase === 'play', null, {
      timeout: 60_000,
    });
    await page.waitForTimeout(600);
    const info = await page.evaluate(() => window.__lib!.inspect());
    const layout = info.layout!;
    expect(layout.cell).toBeGreaterThanOrEqual(36);
    expect(layout.orientation).toBe(w / h >= 1.2 ? 'landscape' : 'portrait');
    // Панели не перекрываются и не выходят за экран.
    const q = layout.question;
    const wr = layout.world;
    expect(q.x).toBeGreaterThanOrEqual(0);
    expect(q.y + q.h).toBeLessThanOrEqual(h + 0.5);
    expect(wr.x + wr.w).toBeLessThanOrEqual(w + 0.5);
    if (layout.orientation === 'portrait') expect(wr.y + wr.h).toBeLessThanOrEqual(q.y);
    else expect(wr.x + wr.w).toBeLessThanOrEqual(q.x);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollW).toBeLessThanOrEqual(w);
    // Таблички вариантов — не ниже 56 px (11.2.4).
    const heights = await page.$$eval('.lib-opt', (els) =>
      els.map((e) => e.getBoundingClientRect().height),
    );
    for (const hh of heights) expect(hh).toBeGreaterThanOrEqual(56);
    // Содержимое панели вопроса в неё помещается.
    const fits = await page.evaluate(() => {
      const panel = document.querySelector('.lib-question')!.getBoundingClientRect();
      return [...document.querySelectorAll('.lib-opt')].every(
        (e) => e.getBoundingClientRect().bottom <= panel.bottom + 0.5,
      );
    });
    expect(fits).toBe(true);
    await page.screenshot({ path: `e2e/__shots__/play-${w}x${h}.png` });
  });
}

test('меню и выбор уровня', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, '/');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/__shots__/menu-390x844.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/__shots__/menu-1280x720.png' });
});

test('поворот экрана посреди раунда: библиотека поворачивается, раунд продолжается', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, '/?level=1');
  await page.waitForFunction(() => window.__lib!.inspect().phase === 'play', null, {
    timeout: 60_000,
  });
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => window.__lib!.inspect());
  expect(before.scene?.orient).toBe('portrait');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => window.__lib!.inspect());
  expect(after.phase).toBe('play');
  expect(['left', 'right']).toContain(after.scene?.orient);
  expect(after.state?.hero.cell).toEqual(before.state?.hero.cell);
  expect(after.layout!.cell).toBeGreaterThanOrEqual(36);
  await page.screenshot({ path: 'e2e/__shots__/rotated-844x390.png' });
});

test('длинные немецкие слова и вопросы с 2, 3 и 4 вариантами не ломают панель', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await boot(page, '/?level=1&q=edge');
  await page.waitForFunction(() => window.__lib!.inspect().phase === 'play', null, {
    timeout: 60_000,
  });
  const seen = new Set<number>();
  for (let i = 0; i < 6 && seen.size < 3; i++) {
    await page.waitForSelector('.lib-opt[aria-disabled="false"]');
    const count = await page.$$eval('.lib-opt', (els) => els.length);
    seen.add(count);
    // Ничего не вылезает за панель.
    const overflow = await page.evaluate(() => {
      const panel = document.querySelector('.lib-question')!.getBoundingClientRect();
      return [...document.querySelectorAll('.lib-opt, .lib-q-text')].some((e) => {
        const r = e.getBoundingClientRect();
        return r.right > panel.right + 1 || r.left < panel.left - 1 || r.bottom > panel.bottom + 1;
      });
    });
    await page.screenshot({ path: `e2e/__shots__/edge-${count}.png` });
    expect(overflow, `варианты: ${count}`).toBe(false);
    // Задать намерение (идти вдоль ближнего прохода) и ответить верно — следующий вопрос.
    await page.evaluate(() => {
      const w = window as unknown as {
        __lib: { currentRound: { tap: (c: { x: number; y: number }) => void } };
      };
      w.__lib.currentRound.tap({ x: 1, y: 9 });
    });
    await page.click('.lib-opt[data-correct]');
    await page.waitForTimeout(500);
  }
  expect([...seen].sort()).toEqual([2, 3, 4]);
});
