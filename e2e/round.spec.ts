/**
 * Сквозной тест «пройти раунд» (план, 13.1.5): бот в странице ставит намерения к листам,
 * затем к двери и отвечает верно. Раунд заканчивается победой и экраном итогов.
 */
import { expect, test } from '@playwright/test';

test('пройти раунд уровня 1 от начала до итогов', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?level=1');
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __lib?: { inspect: () => { phase: string } } };
      return w.__lib && w.__lib.inspect().phase === 'intro';
    },
    null,
    { timeout: 60_000 },
  );
  await page.evaluate(() => {
    const w = window as unknown as {
      __lib: {
        inspect: () => { phase: string };
        currentRound: {
          state: {
            hero: {
              cell: { x: number; y: number };
              pages: number[];
              ready: boolean;
              intent: { kind: string; cell?: { x: number; y: number } };
            };
            pages: { cell: { x: number; y: number } }[];
            lib: { door: { x: number; y: number } };
          };
          tap: (c: { x: number; y: number }) => void;
        };
      };
    };
    setInterval(() => {
      document.querySelector<HTMLButtonElement>('.lib-bubble button')?.click();
      if (w.__lib.inspect().phase !== 'play') return;
      const r = w.__lib.currentRound;
      const s = r.state;
      const h = s.hero.cell;
      let target = s.lib.door;
      if (s.hero.pages.length < 3 && s.pages.length) {
        target = s.pages
          .slice()
          .sort(
            (a, b) =>
              Math.abs(a.cell.x - h.x) +
              Math.abs(a.cell.y - h.y) -
              (Math.abs(b.cell.x - h.x) + Math.abs(b.cell.y - h.y)),
          )[0]!.cell;
      }
      const it = s.hero.intent;
      if (
        s.hero.ready ||
        !(it.kind === 'move' && it.cell && it.cell.x === target.x && it.cell.y === target.y)
      )
        r.tap(target);
      const right = document.querySelector<HTMLButtonElement>('.lib-opt[data-correct]');
      if (right && right.getAttribute('aria-disabled') === 'false') right.click();
    }, 120);
  });
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __lib: { inspect: () => { phase: string } } };
      return w.__lib.inspect().phase === 'results';
    },
    null,
    { timeout: 90_000 },
  );
  await expect(page.locator('.lib-results')).toBeVisible();
  await expect(page.locator('.lib-star:not(.is-off)')).toHaveCount(3);
  await page.screenshot({ path: 'e2e/__shots__/results-390x844.png' });
  expect(errors).toEqual([]);
});
