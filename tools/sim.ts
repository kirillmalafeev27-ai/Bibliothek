/**
 * Симуляция раундов ботами на настоящем движке правил, без графики (план, раздел 14).
 *
 *   npm run sim -- --level 4 --runs 2000
 *   npm run sim -- --all --runs 1000            все уровни, все боты, сверка с целями
 *   npm run sim -- --level 3 --bot cautious --p 0.65 --tmed 8
 *   npm run sim -- --escalation --runs 3000     проверка эскалации (14.5)
 *   npm run sim -- --level 3 --gen --tmed 12    раунд с заданиями ИИ-генератора
 *   npm run sim -- --compare-gen --runs 1000    банк против генератора на всех уровнях
 */
import { balance } from '../src/config/balance';
import type { LevelConfig } from '../src/config/levels';
import { levelById, levels } from '../src/config/levels';
import type { Action, GameEvent, GameState } from '../src/core';
import { Rng, createState, inEarshot, mixSeed, reduce, starsOf } from '../src/core';
import { roundTmed, tMedRangeFor } from '../src/app/pacing';
import type { BotKind } from './bots';
import { BOT_NAMES, TRAITS, planFor } from './bots';

/** Модель ответа (14.2). */
const ANSWER_SIGMA = 0.5;
/**
 * Задания генератора: форматы разной длины, поэтому время ответа разбросано сильнее (оценка
 * «Костров до рассвета» по ответам учеников), а показ ошибки дольше.
 */
const GEN_SIGMA = 0.65;
const GEN_WRONG_SEC = balance.wrongFeedbackGeneratedMs / 1000;
const SWAP_SEC = 0.3;
const WRONG_SEC = balance.wrongFeedbackMs / 1000;
const DT = balance.maxFrameDtSec;
const RETHINK_SEC = 0.25;
/** Раунд длиннее этого считается зависшим (в отчёте — «таймаут»). */
const MAX_ROUND_SEC = 60 * 40;

export interface RoundResult {
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  timeSec: number;
  heard: number;
  throws: number;
  caught: number;
  caughtBy: GameState['stats']['caughtBy'];
  answers: number;
  timeout: boolean;
  /** Эскалация: услышанные ошибки и поимки после них. */
  firstErrors: number;
  firstErrorCatches: number;
  secondErrors: number;
  secondErrorCatches: number;
}

export interface SimOptions {
  level: LevelConfig;
  bot: BotKind;
  p: number;
  tMed: number;
  seed: number;
  /** Без билетов: поимки не кончают раунд (для замера эскалации). */
  infiniteCards?: boolean;
  /** Переопределить выдержку бота, в единицах A. */
  patienceA?: number;
  /** Задания ИИ-генератора: шире пределы T_med, больше разброс, дольше показ ошибки. */
  gen?: boolean;
  /** Запас к T_med для единицы A у заданий генератора (по умолчанию — как в игре). */
  allowance?: number;
}

export function simulateRound(o: SimOptions): RoundResult {
  // Игра берёт для единицы A медиану с запасом (src/app/pacing.ts), а ученик отвечает с
  // медианой o.tMed — как в GameApp.startLevel.
  let s = createState(o.level, o.seed, {
    tMedSec: o.gen
      ? o.allowance !== undefined
        ? o.allowance * o.tMed
        : roundTmed('generated', o.tMed)
      : o.tMed,
    tMedRange: o.gen ? tMedRangeFor('generated') : undefined,
  });
  const sigma = o.gen ? GEN_SIGMA : ANSWER_SIGMA;
  const wrongSec = o.gen ? GEN_WRONG_SEC : WRONG_SEC;
  if (o.infiniteCards) s = { ...s, debug: { ...s.debug, infiniteCards: true } };
  const rng = new Rng(mixSeed(o.seed, 0xb07));
  const traits = TRAITS[o.bot];
  const patienceSec = (o.patienceA ?? traits.patienceA) * s.unitA;
  const answerTime = (): number => o.tMed * Math.exp(sigma * rng.gauss());

  let now = 0;
  let answerAt = answerTime();
  let rethinkAt = 0;
  let answers = 0;

  // Эскалация (14.5): каждая услышанная ошибка — «первая» или «вторая в пределах 4 единиц».
  let lastHeardErrorAt = -Infinity;
  let pending: 'first' | 'second' | null = null;
  const esc = { firstErrors: 0, firstErrorCatches: 0, secondErrors: 0, secondErrorCatches: 0 };

  const dispatch = (a: Action): GameEvent[] => {
    const r = reduce(s, a);
    s = r.state;
    for (const e of r.events) {
      if (e.type === 'SOUND' && e.kind === 'error' && e.heardBy.length > 0) {
        const second = s.time - lastHeardErrorAt <= 4 * s.unitA;
        lastHeardErrorAt = s.time;
        pending = second ? 'second' : 'first';
        if (second) esc.secondErrors++;
        else esc.firstErrors++;
      } else if (e.type === 'CAUGHT') {
        if (e.cause === 'error' && pending) {
          if (pending === 'second') esc.secondErrorCatches++;
          else esc.firstErrorCatches++;
        }
        pending = null;
      } else if (e.type === 'CALM') {
        pending = null;
      }
    }
    return r.events;
  };

  const applyPlan = (): boolean => {
    const plan = planFor(o.bot, s);
    if (plan.kind === 'wait') return false;
    // Выдержка: в кольце громкого слуха не отвечает, если не нужно действовать сейчас, —
    // но ждёт не дольше своей выдержки с момента, когда ответ уже готов.
    if (!plan.urgent && !s.hero.ready && inEarshot(s) && now - answerAt < patienceSec) return false;
    dispatch({ type: 'SET_INTENT', kind: plan.kind, cell: plan.cell });
    return true;
  };

  while ((s.status === 'playing' || s.status === 'catchScene') && now < MAX_ROUND_SEC) {
    if (s.status === 'playing' && now >= rethinkAt) {
      if (s.hero.ready) {
        // Готовое действие: выполнится, как только бот задаст намерение.
        applyPlan();
        rethinkAt = now + RETHINK_SEC;
      } else if (now >= answerAt) {
        if (applyPlan()) {
          const correct = rng.chance(o.p);
          dispatch({ type: 'ANSWER', correct, timeMs: 0 });
          answers++;
          answerAt = now + (correct ? SWAP_SEC : wrongSec) + answerTime();
        } else {
          rethinkAt = now + RETHINK_SEC;
        }
      }
    }
    dispatch({ type: 'TICK', dt: DT });
    now += DT;
  }

  return {
    won: s.status === 'won',
    stars: starsOf(s),
    timeSec: now,
    heard: s.stats.heard,
    throws: s.stats.throws,
    caught: s.stats.caught,
    caughtBy: s.stats.caughtBy,
    answers,
    timeout: s.status === 'playing' || s.status === 'catchScene',
    ...esc,
  };
}

export interface Summary {
  level: number;
  bot: BotKind;
  p: number;
  tMed: number;
  runs: number;
  win: number;
  star2: number;
  star3: number;
  heard: number;
  throws: number;
  caught: number;
  minutes: number;
  timeouts: number;
  caughtBy: Record<string, number>;
  escFirst: number;
  escSecond: number;
}

export function simulate(
  level: LevelConfig,
  bot: BotKind,
  runs: number,
  p = 0.8,
  tMed = 5,
  seed0 = 1,
  infiniteCards = false,
  patienceA?: number,
  gen: boolean | { allowance: number } = false,
): Summary {
  let win = 0;
  let star2 = 0;
  let star3 = 0;
  let heard = 0;
  let throws = 0;
  let caught = 0;
  let time = 0;
  let timeouts = 0;
  const caughtBy: Record<string, number> = { error: 0, squeak: 0, step: 0, sniff: 0, other: 0 };
  const esc = { f: 0, fc: 0, s: 0, sc: 0 };
  for (let i = 0; i < runs; i++) {
    const r = simulateRound({
      level,
      bot,
      p,
      tMed,
      seed: seed0 + i,
      infiniteCards,
      patienceA,
      gen: gen !== false,
      allowance: typeof gen === 'object' ? gen.allowance : undefined,
    });
    if (r.won) win++;
    if (r.stars >= 2) star2++;
    if (r.stars >= 3) star3++;
    heard += r.heard;
    throws += r.throws;
    caught += r.caught;
    time += r.timeSec;
    if (r.timeout) timeouts++;
    for (const k of Object.keys(caughtBy)) caughtBy[k]! += r.caughtBy[k as keyof typeof r.caughtBy];
    esc.f += r.firstErrors;
    esc.fc += r.firstErrorCatches;
    esc.s += r.secondErrors;
    esc.sc += r.secondErrorCatches;
  }
  const pct = (n: number): number => (100 * n) / runs;
  return {
    level: level.id,
    bot,
    p,
    tMed,
    runs,
    win: pct(win),
    star2: pct(star2),
    star3: pct(star3),
    heard: heard / runs,
    throws: throws / runs,
    caught: caught / runs,
    minutes: time / runs / 60,
    timeouts,
    caughtBy,
    escFirst: esc.f ? (100 * esc.fc) / esc.f : 0,
    escSecond: esc.s ? (100 * esc.sc) / esc.s : 0,
  };
}

function fmt(n: number, d = 0): string {
  return n.toFixed(d);
}

export function triple(x: Summary): string {
  return `${fmt(x.win)} / ${fmt(x.star2)} / ${fmt(x.star3)}`;
}

function printSummary(x: Summary): void {
  const totalCaught = Object.values(x.caughtBy).reduce((a, b) => a + b, 0) || 1;
  const causes = Object.entries(x.caughtBy)
    .map(([k, v]) => `${k} ${fmt((100 * v) / totalCaught)}%`)
    .join(', ');
  console.log(
    `  ${BOT_NAMES[x.bot].padEnd(13)} p=${x.p} T=${x.tMed}с  победа/★★/★★★: ${triple(x).padEnd(14)} ` +
      `услышан ${fmt(x.heard, 2)}  броски ${fmt(x.throws, 2)}  поимки ${fmt(x.caught, 2)}  ` +
      `раунд ${fmt(x.minutes, 1)} мин` +
      (x.timeouts ? `  таймаутов ${x.timeouts}` : ''),
  );
  console.log(`    причины поимок: ${causes}`);
}

function levelName(id: number): string {
  return id === 7 ? '∞' : String(id);
}

interface Args {
  level?: number;
  runs: number;
  bot?: BotKind;
  p: number;
  tmed: number;
  seed: number;
  all: boolean;
  escalation: boolean;
  table: boolean;
  levels?: number[];
  patience?: number;
  gen: boolean;
  compareGen: boolean;
  /** Запас к T_med генератора вместо balance.paceGenerated.allowance (подбор). */
  allowance?: number;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    runs: 1000,
    p: 0.8,
    tmed: 5,
    seed: 1,
    all: false,
    escalation: false,
    table: false,
    gen: false,
    compareGen: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--level' && v) a.level = v === '∞' || v === 'inf' ? 7 : Number(v);
    else if (k === '--runs' && v) a.runs = Number(v);
    else if (k === '--bot' && v) a.bot = v as BotKind;
    else if (k === '--p' && v) a.p = Number(v);
    else if (k === '--tmed' && v) a.tmed = Number(v);
    else if (k === '--seed' && v) a.seed = Number(v);
    else if (k === '--all') a.all = true;
    else if (k === '--escalation') a.escalation = true;
    else if (k === '--table') a.table = true;
    else if (k === '--levels' && v)
      a.levels = v.split(',').map((x) => (x === '∞' || x === 'inf' ? 7 : Number(x)));
    else if (k === '--patience' && v) a.patience = Number(v);
    else if (k === '--gen') a.gen = true;
    else if (k === '--compare-gen') a.compareGen = true;
    else if (k === '--allowance' && v) a.allowance = Number(v);
  }
  return a;
}

/**
 * Банк против заданий ИИ-генератора: тот же ученик (та же доля верных) с темпом банка 5 с и
 * темпом генератора 12 с, разбросом 0.65 и показом ошибки 1.8 с. Единица A растягивается вместе
 * с T_med, поэтому раунд должен остаться тем же по трудности (docs/GENERATION.md, «Темп»).
 */
function compareGen(a: Args): void {
  const ids = a.level ? [a.level] : levels.map((l) => l.id);
  const genTmed = balance.paceGenerated.defaultTmedSec;
  const allowance = a.allowance ?? balance.paceGenerated.allowance;
  console.log(
    `Банк (T=${a.tmed} с, σ=${ANSWER_SIGMA}) против генератора (T=${genTmed} с, σ=${GEN_SIGMA}, ` +
      `ошибка ${GEN_WRONG_SEC} с, запас ×${allowance}); p=${a.p}, ${a.runs} раундов; ` +
      `победа / ★★ / ★★★, %`,
  );
  let sum = 0;
  let count = 0;
  for (const id of ids) {
    for (const bot of a.bot ? [a.bot] : BOTS) {
      const bank = simulate(levelById(id), bot, a.runs, a.p, a.tmed, a.seed);
      const gen = simulate(
        levelById(id),
        bot,
        a.runs,
        a.p,
        genTmed,
        a.seed,
        false,
        a.patience,
        a.allowance !== undefined ? { allowance: a.allowance } : true,
      );
      console.log(
        `  ур. ${levelName(id)} ${BOT_NAMES[bot].padEnd(13)} банк ${triple(bank).padEnd(14)} ` +
          `генератор ${triple(gen).padEnd(14)} Δпобед ${fmt(gen.win - bank.win, 1)}`,
      );
      sum += gen.win - bank.win;
      count++;
    }
  }
  console.log(`Средняя разница побед: ${fmt(sum / Math.max(1, count), 1)} п.п.`);
}

const BOTS: BotKind[] = ['cautious', 'impatient', 'nobooks', 'rusher'];

/** Цели раздела 14.5 для осторожного бота при T_med = 5 и p = 0.8. */
const WIN_TARGETS: Record<number, [number, number]> = {
  1: [95, 100],
  2: [95, 100],
  3: [88, 97],
  4: [84, 94],
  5: [78, 90],
  6: [70, 85],
  7: [48, 62],
};

function check(ok: boolean, text: string): boolean {
  console.log(`  ${ok ? '✓' : '✗'} ${text}`);
  return ok;
}

function runAll(a: Args): void {
  const t0 = Date.now();
  const rows: string[] = [];
  let failed = 0;
  const cache = new Map<string, Summary>();
  const get = (lvl: number, bot: BotKind, p = 0.8, tMed = 5): Summary => {
    const key = `${lvl}|${bot}|${p}|${tMed}`;
    let x = cache.get(key);
    if (!x) {
      x = simulate(levelById(lvl), bot, a.runs, p, tMed, a.seed, false, a.patience);
      cache.set(key, x);
    }
    return x;
  };

  const chosen = levels.filter((l) => !a.levels || a.levels.includes(l.id));
  for (const level of chosen) {
    console.log(`\nУровень ${levelName(level.id)}`);
    for (const bot of BOTS) printSummary(get(level.id, bot));
    const weak = get(level.id, 'cautious', 0.65);
    const strong = get(level.id, 'cautious', 0.9);
    const fast = get(level.id, 'cautious', 0.8, 3);
    const slow = get(level.id, 'cautious', 0.8, 8);
    printSummary(weak);
    printSummary(strong);
    printSummary(fast);
    printSummary(slow);
    rows.push(
      `| ${levelName(level.id)} | ${triple(get(level.id, 'cautious'))} | ${triple(get(level.id, 'impatient'))} | ` +
        `${triple(get(level.id, 'nobooks'))} | ${triple(get(level.id, 'rusher'))} | ${triple(weak)} | ` +
        `${triple(strong)} | ${fmt(fast.win)} / ${fmt(slow.win)} |`,
    );
  }

  console.log('\nДоля побед, ★★ и ★★★ в процентах:');
  console.log(
    '| Ур. | Осторожный | Без выдержки | Без книг | Напролом | Осторожный, p = 0.65 | Осторожный, p = 0.9 | Медиана 3 с / 8 с |',
  );
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(r);

  console.log('\nЦели раздела 14.5:');
  const ok = (cond: boolean, text: string): void => {
    if (!check(cond, text)) failed++;
  };
  for (const level of chosen) {
    const id = level.id;
    const c = get(id, 'cautious');
    const [lo, hi] = WIN_TARGETS[id]!;
    ok(
      c.win >= lo && c.win <= hi + 0.5,
      `ур. ${levelName(id)}: победы осторожного ${fmt(c.win, 1)}% в ${lo}–${hi}%`,
    );
    if (id >= 3) {
      const r = get(id, 'rusher');
      ok(
        r.star2 <= c.star2 / 2 + 0.5,
        `ур. ${levelName(id)}: «напролом» ★★ ${fmt(r.star2, 1)}% ≤ половины осторожного (${fmt(c.star2 / 2, 1)}%)`,
      );
      const i = get(id, 'impatient');
      ok(
        c.star2 - i.star2 >= 10,
        `ур. ${levelName(id)}: «без выдержки» ★★ ${fmt(i.star2, 1)}% минимум на 10 п. ниже (${fmt(c.star2, 1)}%)`,
      );
    }
    if (id >= 6) {
      const r = get(id, 'rusher');
      ok(
        c.win - r.win >= 20,
        `ур. ${levelName(id)}: «напролом» выигрывает ${fmt(r.win, 1)}% — минимум на 20 п. реже (${fmt(c.win, 1)}%)`,
      );
    }
    if (id >= 4) {
      const n = get(id, 'nobooks');
      ok(
        c.win - n.win >= 15,
        `ур. ${levelName(id)}: «без книг» выигрывает ${fmt(n.win, 1)}% — минимум на 15 п. реже (${fmt(c.win, 1)}%)`,
      );
    }
    const fast = get(id, 'cautious', 0.8, 3);
    const slow = get(id, 'cautious', 0.8, 8);
    ok(
      Math.abs(fast.win - c.win) <= 5 && Math.abs(slow.win - c.win) <= 5,
      `ур. ${levelName(id)}: скорость честная — 3 с: ${fmt(fast.win, 1)}%, 8 с: ${fmt(slow.win, 1)}% (±5 п. от ${fmt(c.win, 1)}%)`,
    );
  }
  const has = (id: number): boolean => chosen.some((l) => l.id === id);
  if (has(4)) {
    ok(
      get(4, 'cautious', 0.9).win >= 92,
      `ур. 4, p = 0.9: ${fmt(get(4, 'cautious', 0.9).win, 1)}% ≥ 92%`,
    );
    ok(
      get(4, 'cautious', 0.65).win <= 70,
      `ур. 4, p = 0.65: ${fmt(get(4, 'cautious', 0.65).win, 1)}% ≤ 70%`,
    );
  }
  if (has(1))
    ok(
      get(1, 'cautious', 0.65).win >= 95,
      `ур. 1, p = 0.65: ${fmt(get(1, 'cautious', 0.65).win, 1)}% ≥ 95%`,
    );
  if (has(2))
    ok(
      get(2, 'cautious', 0.65).win >= 85,
      `ур. 2, p = 0.65: ${fmt(get(2, 'cautious', 0.65).win, 1)}% ≥ 85%`,
    );

  for (const id of [3, 4].filter(has)) {
    const e = simulate(levelById(id), 'impatient', a.runs, 0.8, 5, a.seed, true);
    ok(
      e.escFirst <= 12,
      `ур. ${id}: одна услышанная ошибка кончается поимкой в ${fmt(e.escFirst, 1)}% (≤ 12%)`,
    );
    ok(
      e.escSecond >= 2.5 * e.escFirst,
      `ур. ${id}: вторая в пределах 4 единиц — в ${fmt(e.escSecond, 1)}% (≥ 2.5× первой)`,
    );
  }
  console.log(
    `\n${failed === 0 ? 'Все цели выполнены' : `Не выполнено целей: ${failed}`}; ` +
      `${a.runs} раундов на конфигурацию, ${((Date.now() - t0) / 1000).toFixed(0)} с`,
  );
}

function main(): void {
  const a = parseArgs(process.argv.slice(2));
  if (a.compareGen) {
    compareGen(a);
    return;
  }
  if (a.all) {
    runAll(a);
    return;
  }
  if (a.escalation) {
    for (const id of a.level ? [a.level] : [3, 4]) {
      const e = simulate(levelById(id), a.bot ?? 'impatient', a.runs, a.p, a.tmed, a.seed, true);
      console.log(
        `Уровень ${levelName(id)}, без билетов: первая услышанная ошибка → поимка в ${fmt(e.escFirst, 1)}%, ` +
          `вторая в пределах 4 единиц → в ${fmt(e.escSecond, 1)}%`,
      );
    }
    return;
  }
  const ids = a.level ? [a.level] : levels.map((l) => l.id);
  const t0 = Date.now();
  for (const id of ids) {
    console.log(`\nУровень ${levelName(id)} — ${a.runs} раундов`);
    for (const bot of a.bot ? [a.bot] : BOTS)
      printSummary(
        simulate(levelById(id), bot, a.runs, a.p, a.tmed, a.seed, false, a.patience, a.gen),
      );
  }
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} с`);
}

const invoked = process.argv[1] ?? '';
if (invoked.endsWith('sim.ts') || invoked.endsWith('sim.js')) main();
