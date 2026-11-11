/**
 * Все числа баланса и тайминги игры (план, разделы 2–4, 9, 13).
 * В сценах и логике магических чисел быть не должно — только ссылки сюда.
 * Длительности с суффиксом `A` заданы в единицах темпа игрока (раздел 3),
 * с суффиксом `Ms`/`Sec` — в реальном времени.
 */
export const balance = {
  /** Размер библиотеки в клетках (2.1.1). */
  grid: { w: 9, h: 11 },
  /** Ряды стеллажей и число проходов в ряду (раздел 5). */
  shelfRows: [2, 4, 6, 8],
  gapsPerRow: { min: 2, max: 3 },

  /** Радиус тихого слуха — нимб (2.3.2, 2.4.1). */
  hearR: 2.25,
  /** Сколько клеток библиотекарь проходит между остановками (2.3.1). */
  burst: 3,
  listenA: 1.5,
  searchA: 2.5,
  firstListenA: 2,
  fileCardA: 4,

  /** Радиус броска словаря (2.5.2) и вместимость рук (2.5.1). */
  throwR: 5,
  maxBooks: 3,

  /** Злость: множитель длительности шага бега при злости 0 / 1 / 2 (2.3.6). */
  angerMul: [1, 0.75, 0.6],
  maxAnger: 2,

  /** Нюх: радиус вокруг героя, в котором выбирается точка маршрута (2.3.5). */
  sniffR: 2,
  /** Обычная точка маршрута — в стольких шагах от библиотекаря (2.3.5). */
  waypoint: { minSteps: 4, maxSteps: 10 },
  /** Сколько библиотекарь ждёт, если клетка занята вторым библиотекарем, в A (2.3.9). */
  blockedRetryA: 0.2,

  /** Листы карты и длина обхода (2.6.1, раздел 5). */
  pages: 3,
  pageMinSteps: 4,
  tour: { min: 16, max: 22 },
  genAttempts: 200,
  genWiden: 2,

  /** Маршрут героя обходит скрипучие половицы, если обход длиннее не больше чем на столько шагов (2.2.2). */
  squeakDetourMax: 2,
  /** Путь броска считается опасным, если проходит ближе этого к герою (2.8.6). */
  throwDangerR: 1.5,
  /** «Knapp!» — библиотекарь ближе этого к двери в момент победы (9.2). */
  knappR: 2,

  /** Темп игрока (раздел 3). */
  pace: {
    defaultTmedSec: 5,
    minTmedSec: 3,
    maxTmedSec: 10,
    tmedWindow: 20,
    defaultP: 0.8,
    minP: 0.5,
    maxP: 1,
    pWindow: 30,
  },
  unitOverheadSec: 0.45,

  /** Честность времени (2.7, 2.6.3). */
  wrongFeedbackMs: 1000,
  questionSwapMs: 150,
  correctFlashMs: 150,
  doubleTapGuardMs: 120,
  maxFrameDtSec: 0.1,
  catchSceneSec: 1.5,
  introSec: 2.5,
  outroSec: 2,

  /** Вопросы (раздел 12). */
  questions: { noRepeatWithin: 10, wrongReturnMin: 4, wrongReturnMax: 6 },

  /** Анимации вида (разделы 7–9). На логику не влияют. */
  view: {
    heroStepMs: 200,
    heroThrowMs: 250,
    bookArcMs: 300,
    haloInMs: 200,
    haloOutMs: 150,
    soundRingMs: 400,
    shelfFadeMs: 160,
    shelfBehindAlpha: 0.45,
    actionAnimMaxMs: 400,
    maxBanderoles: 3,
    maxSoundRings: 6,
    maxParticles: 150,
    goldGlintEverySec: { min: 3, max: 5 },
    klimperEverySec: 8,
    /** Тряска камеры в CSS-пикселях (9.2). */
    shake: { squeak: 1, throw: 2, error: 2, anger: 2, caught: 4, lost: 6 },
    /** Сколько клеток пути библиотекаря показывают отпечатки тапочек (2.8.4). */
    slipperPrints: 3,
    /** Вспышки — не чаще 3 раз в секунду (11.6.2). */
    minFlashGapMs: 334,
  },

  /** Производительность (13.6). */
  perf: {
    cellPx: 96,
    cellPxLow: 64,
    lowFpsThreshold: 45,
    lowFpsSeconds: 3,
    maxDpr: 2,
    textureBudgetMs: 1500,
  },

  /** Звук (раздел 10). */
  audio: {
    pitchJitter: 0.05,
    earshotAmbientDuck: 0.4,
    keysMaxDist: 9,
  },
} as const;

export type Balance = typeof balance;
