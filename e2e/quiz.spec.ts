/**
 * Сквозной тест вопросов от ИИ-генератора (движок Morskoy, docs/GENERATION.md). Сервер генерации
 * подменён: /api/quiz/status, /api/generate-questions и /api/tts отвечают из теста, так что ключ
 * AITUNNEL_API_KEY не нужен. Проверяется путь игрока — выбор тем, запросы к серверу, раунд с
 * заданиями — и раскладка всех девяти форматов каталога на телефоне и в ландшафте.
 */
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { EXERCISE_FORMATS } from '../server/generation/exerciseFormats';

interface Lib {
  inspect: () => { phase: string; state: { stats: { timeSec: number } } | null };
  questionInfo: () => {
    kind: string;
    genLayout: boolean;
    config: { level: string; lexicalTopic: string | null; grammarTopics: string[] } | null;
  };
  debugShowQuestion: (q: unknown) => void;
}

const FORMAT_IDS = Object.keys(EXERCISE_FORMATS) as (keyof typeof EXERCISE_FORMATS)[];

/** Задания каталога в формате ответа API (как у Morskoy): по кругу все девять форматов. */
function apiQuestions(count: number, from = 0) {
  return Array.from({ length: count }, (_, i) => {
    const id = FORMAT_IDS[(from + i) % FORMAT_IDS.length]!;
    const f = EXERCISE_FORMATS[id].example;
    return { format: id, text: f.text, display: f.display, options: f.options, correct: f.correct };
  });
}

interface Server {
  bodies: Record<string, unknown>[];
  tts: string[];
}

/**
 * Подменить сервер генерации. configured — есть ли ключ; delayMs — сколько «думает» модель;
 * gate — ответы с заданиями ждут, пока тест его не откроет.
 */
async function fakeServer(
  page: Page,
  configured: boolean,
  delayMs = 300,
  gate: Promise<void> = Promise.resolve(),
): Promise<Server> {
  const server: Server = { bodies: [], tts: [] };
  let served = 0;
  await page.route('**/api/quiz/status', (r) =>
    r.fulfill({ json: { ok: true, generationConfigured: configured, ttsConfigured: false } }),
  );
  const generate = async (r: Route) => {
    const body = JSON.parse(r.request().postData() || '{}') as Record<string, unknown>;
    server.bodies.push(body);
    if (!configured) {
      await r.fulfill({ status: 503, json: { error: 'AITUNNEL_API_KEY is not set' } });
      return;
    }
    await new Promise((res) => setTimeout(res, delayMs));
    await gate;
    const count = Number(body.count) || 10;
    await r.fulfill({ json: { questions: apiQuestions(count, served) } });
    served += count;
  };
  await page.route('**/api/generate-questions', generate);
  await page.route('**/api/generate-audio-questions', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}') as Record<string, unknown>;
    server.bodies.push({ ...body, audio: true });
    await r.fulfill({
      json: {
        questions: Array.from({ length: 5 }, (_, i) => ({
          mode: 'audio',
          text: 'Прослушай немецкое предложение и выбери точный русский перевод.',
          display: 'Немецкая фраза звучит вслух. Выбери точный перевод.',
          audioText: `Ich bringe das Buch ${i + 1} in die Bibliothek zurück.`,
          options: [
            'Я возвращаю книгу в библиотеку.',
            'Я приношу книгу из библиотеки.',
            'Я забираю книгу в библиотеке.',
            'Я оставляю книгу в библиотеке.',
          ],
          correct: 0,
        })),
      },
    });
  });
  await page.route('**/api/tts', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}') as { text?: string };
    server.tts.push(String(body.text));
    // Озвучки на сервере «нет»: игра переходит на голос браузера.
    await r.fulfill({ status: 503, json: { error: 'ELEVENLABS_API_KEY is not set' } });
  });
  return server;
}

/** Чистое хранилище и пройденное обучение: пузыри не мешают. */
async function freshStorage(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript(
    (items: Record<string, string>) => {
      if (sessionStorage.getItem('e2e-init')) return;
      sessionStorage.setItem('e2e-init', '1');
      localStorage.clear();
      for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
    },
    {
      'library:settings': JSON.stringify({
        tutorial: { move: true, listen: true, earshot: true, throw: true, caught: true },
      }),
      ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, JSON.stringify(v)])),
    },
  );
}

const phase = (page: Page, p: string, timeout = 60_000) =>
  page.waitForFunction(
    (x) => (window as unknown as { __lib?: Lib }).__lib?.inspect().phase === x,
    p,
    { timeout },
  );

const info = (page: Page) =>
  page.evaluate(() => (window as unknown as { __lib: Lib }).__lib.questionInfo());

/** Задание в панели: встаёт ли целиком, какой шрифт, нужна ли прокрутка. */
function measure(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.lib-question') as HTMLElement;
    const body = panel.querySelector('.lib-q-body') as HTMLElement;
    const pr = panel.getBoundingClientRect();
    const buttons = [...panel.querySelectorAll<HTMLElement>('.lib-opt')];
    const scroll = body.classList.contains('is-scroll');
    return {
      task: panel.classList.contains('is-task'),
      column: panel.querySelector('.lib-q-options')!.classList.contains('is-column'),
      scroll,
      optionPx: parseFloat(getComputedStyle(buttons[0]!).fontSize),
      clipped: !scroll && buttons.some((b) => b.getBoundingClientRect().bottom > pr.bottom + 1),
      wide: buttons.some((b) => b.scrollWidth > b.clientWidth + 1),
      instruction: (panel.querySelector('.lib-q-instruction') as HTMLElement).hidden
        ? null
        : panel.querySelector('.lib-q-instruction')!.textContent,
    };
  });
}

test('первое «Играть» открывает выбор тем; темы уходят генератору, раунд идёт с заданиями', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await freshStorage(page);
  const server = await fakeServer(page, true);
  await page.goto('/');
  await phase(page, 'menu');
  await expect(page.locator('.lib-quiz-summary')).toHaveText('Вопросы: встроенный набор');
  await page.getByRole('button', { name: 'Играть' }).click();

  const dialog = page.getByRole('dialog', { name: 'Вопросы' });
  await expect(dialog).toBeVisible();
  const done = dialog.getByRole('button', { name: 'Готово' });
  await expect(done).toBeDisabled();
  await dialog.getByRole('radio', { name: /^B1/ }).click();
  // Дополнительная лексическая тема — из мира библиотеки.
  await dialog.getByRole('radio', { name: 'Bibliothek und Bücher' }).click();
  await dialog.getByRole('button', { name: 'Dativ', exact: true }).click();
  await dialog.getByRole('button', { name: 'Kasus unterscheiden', exact: true }).click();
  await expect(dialog.getByText('Темы — выбрано 2 из 5')).toBeVisible();
  await done.click();

  await phase(page, 'intro');
  expect(await info(page)).toMatchObject({
    kind: 'generated',
    genLayout: true,
    config: {
      level: 'B1',
      lexicalTopic: 'Bibliothek und Bücher',
      grammarTopics: ['Dativ', 'Kasus unterscheiden'],
    },
  });
  await page.keyboard.press('Enter');
  await phase(page, 'play');
  await expect(page.locator('.lib-question.is-task')).toBeVisible();
  await expect(page.locator('.lib-q-instruction')).toBeVisible();
  await expect(page.locator('.lib-opt')).toHaveCount(4);

  // Каждая тема — свой поток со своим блоком; уровень и лексическая тема — в каждом запросе.
  const topics = server.bodies.map((b) => b.grammarTopic).sort();
  expect(topics).toEqual(['Dativ', 'Kasus unterscheiden']);
  for (const b of server.bodies)
    expect(b).toMatchObject({ level: 'B1', lexicalTopic: 'Bibliothek und Bücher', count: 10 });

  // Верный ответ на задание генератора принят.
  const index = await page.evaluate(() =>
    Number(document.querySelector<HTMLElement>('.lib-opt[data-correct]')!.dataset.index),
  );
  await page.waitForTimeout(200);
  await page.keyboard.press(String(index + 1));
  await expect(page.locator('.lib-opt.is-correct')).toHaveCount(1);

  // В меню — выбранные темы; второй раз «Играть» выбор тем не открывает.
  await page.keyboard.press('KeyP');
  await page.getByRole('button', { name: 'В меню' }).click();
  await phase(page, 'menu');
  await expect(page.locator('.lib-quiz-summary')).toHaveText(
    'Вопросы: B1 · Dativ, Kasus unterscheiden · Bibliothek und Bücher',
  );
  await page.getByRole('button', { name: 'Играть' }).click();
  await phase(page, 'intro');
  expect(errors).toEqual([]);
});

test('без ключа генерации «Играть» сразу начинает раунд с вопросами банка', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freshStorage(page);
  await fakeServer(page, false);
  await page.goto('/');
  await phase(page, 'menu');
  await page.getByRole('button', { name: 'Играть' }).click();
  await phase(page, 'intro');
  await expect(page.getByRole('dialog', { name: 'Вопросы' })).toHaveCount(0);
  expect((await info(page)).kind).toBe('bank');
  await page.keyboard.press('Enter');
  await phase(page, 'play');
  await expect(page.locator('.lib-question')).not.toHaveClass(/is-task/);
  // Экран тем честно говорит, что ключа нет.
  await page.keyboard.press('KeyP');
  await page.getByRole('button', { name: 'В меню' }).click();
  await phase(page, 'menu');
  await page.getByRole('button', { name: 'Вопросы' }).click();
  await expect(page.locator('.lib-quiz-status')).toContainText('AITUNNEL_API_KEY');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Вопросы' })).toHaveCount(0);
});

test('раунд ждёт первое задание: «Готовлю вопросы…», мир стоит', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freshStorage(page, {
    'library:quiz': {
      chosen: true,
      config: {
        level: 'A2',
        lexicalTopic: 'Märchen und Sagen',
        grammarTopics: ['Perfekt'],
        wortstellung: false,
        listening: false,
      },
    },
  });
  let open = (): void => undefined;
  const gate = new Promise<void>((resolve) => (open = resolve));
  await fakeServer(page, true, 0, gate);
  await page.goto('/?level=1');
  await phase(page, 'intro');
  await page.keyboard.press('Enter');
  await expect(page.locator('.lib-intro__wait')).toHaveText('Готовлю вопросы…');
  await expect(page.locator('.lib-q-material')).toHaveText('Готовлю вопросы…');
  await page.waitForTimeout(1500);
  expect(
    await page.evaluate(
      () => (window as unknown as { __lib: Lib }).__lib.inspect().state!.stats.timeSec,
    ),
  ).toBe(0);
  // Задания пришли — раунд начинается сам.
  open();
  await phase(page, 'play', 15_000);
  await expect(page.locator('.lib-question.is-task')).toBeVisible();
});

test('аудирование: фраза звучит сама, на экране — инструкция и кнопка «Слушать»', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freshStorage(page, {
    'library:quiz': {
      chosen: true,
      config: {
        level: 'A2',
        lexicalTopic: null,
        grammarTopics: [],
        wortstellung: false,
        listening: true,
      },
    },
  });
  const server = await fakeServer(page, true);
  await page.goto('/?level=1');
  await phase(page, 'intro');
  await page.keyboard.press('Enter');
  await phase(page, 'play');
  const listen = page.getByRole('button', { name: 'Слушать' });
  await expect(listen).toBeVisible();
  await expect(page.locator('.lib-q-material')).toBeHidden();
  await expect.poll(() => server.tts.length).toBeGreaterThanOrEqual(1);
  expect(server.tts[0]).toMatch(/^Ich bringe das Buch \d in die Bibliothek zurück\.$/);
  expect(server.bodies.some((b) => b.audio === true)).toBe(true);
});

for (const [w, h, scrollOk] of [
  [390, 844, false],
  [844, 390, false],
  [1280, 800, false],
  [360, 640, true],
] as [number, number, boolean][]) {
  test(`все девять форматов каталога встают в панель ${w}×${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await freshStorage(page, {
      'library:quiz': {
        chosen: true,
        config: {
          level: 'B1',
          lexicalTopic: null,
          grammarTopics: ['Dativ'],
          wortstellung: false,
          listening: false,
        },
      },
    });
    await fakeServer(page, true);
    await page.goto('/?level=1');
    await phase(page, 'intro');
    await page.keyboard.press('Enter');
    await phase(page, 'play');
    expect((await info(page)).genLayout).toBe(true);
    for (const id of FORMAT_IDS) {
      const f = EXERCISE_FORMATS[id].example;
      await page.evaluate((q) => (window as unknown as { __lib: Lib }).__lib.debugShowQuestion(q), {
        id: `fmt-${id}`,
        prompt: f.display,
        promptLang: 'de',
        instruction: f.text,
        options: f.options,
        optionsLang: 'de',
        correctIndex: f.correct,
        format: id,
      });
      const m = await measure(page);
      expect(m.task, id).toBe(true);
      expect(m.instruction, id).toBe(f.text);
      expect(m.clipped, id).toBe(false);
      expect(m.wide, id).toBe(false);
      expect(m.optionPx, id).toBeGreaterThanOrEqual(12);
      // Варианты-предложения — столбиком, короткие — сеткой (QuestionPanel.isLongOptions).
      expect(m.column, id).toBe(
        f.options.some((o) => {
          const words = o.trim().split(/\s+/).length;
          return words >= 4 || (words >= 3 && o.length > 24);
        }),
      );
      if (!scrollOk) expect(m.scroll, id).toBe(false);
    }
  });
}
