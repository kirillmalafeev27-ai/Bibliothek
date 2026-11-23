/**
 * Экраны (план, 11.5): все — DOM поверх живой сцены. Меню, выбор уровня, интро,
 * пауза, итоги, настройки, загрузка.
 */
import type { HintSet, LevelConfig } from '../../config/levels';
import { hintPresets, levels } from '../../config/levels';
import { ru } from '../../i18n/ru';
import type { SettingsData } from '../../app/stores';
import type { AiStatus } from '../../shared/questions/AiQuestionProvider';
import type { CefrLevel, QuizConfig } from '../../shared/questions/topics';
import {
  BASE_LEXICAL_TOPICS,
  CEFR_LEVELS,
  EXTRA_LEXICAL_TOPICS,
  GRAMMAR_GROUPS,
  MAX_GRAMMAR_TOPICS,
  VOCAB_TOPICS,
  isVocabTopic,
} from '../../shared/questions/topics';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(text: string, cls = '', onClick?: () => void): HTMLButtonElement {
  const b = el('button', `lib-btn ${cls}`.trim(), text);
  b.type = 'button';
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

function corners(card: HTMLElement): void {
  for (const c of ['tl', 'tr', 'br', 'bl'])
    card.append(el('span', `lib-card__corner lib-card__corner--${c}`));
}

function stars(count: number, total = 3, animate = false): HTMLElement {
  const box = el('span', 'lib-stars');
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', ru.starsOf(count));
  for (let i = 0; i < total; i++) {
    const s = el(
      'span',
      `lib-star${i < count ? '' : ' is-off'}${animate && i < count ? ' is-new' : ''}`,
    );
    if (animate) s.style.animationDelay = `${0.25 + i * 0.28}s`;
    box.append(s);
  }
  return box;
}

export interface MenuHandlers {
  onPlay: () => void;
  onLevels: () => void;
  onSettings: () => void;
  /**
   * Источник вопросов умеет выбирать темы (ИИ-генерация): под «Играть» — кнопка «Вопросы» и
   * строка с выбранными темами.
   */
  quiz?: { summary: string; onOpen: () => void };
}

export interface QuizHandlers {
  onDone: (config: QuizConfig) => void;
  onBank: () => void;
  onCancel: () => void;
}

export interface LevelEntry {
  level: LevelConfig;
  unlocked: boolean;
  stars: number;
  played: boolean;
  mini: string;
}

export interface ResultData {
  won: boolean;
  near: boolean;
  level: LevelConfig;
  stars: 0 | 1 | 2 | 3;
  snapshot: string | null;
  pages: number[];
  cardsLeft: number;
  cardsTotal: number;
  correct: number;
  wrong: number;
  heard: number;
  throws: number;
  medianMs: number | null;
  timeSec: number;
  bestSec: number | null;
  newRecord: boolean;
  hasNext: boolean;
}

export interface ResultHandlers {
  onAgain: () => void;
  onNext: () => void;
  onMenu: () => void;
}

export interface PauseHandlers {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onMenu: () => void;
}

export interface SettingsHandlers {
  onChange: (patch: Partial<SettingsData>) => void;
  onResetTutorial: () => void;
  onClose: () => void;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export class Screens {
  readonly el: HTMLElement;
  private current: HTMLElement | null = null;
  private stack: HTMLElement[] = [];
  private timers: number[] = [];

  constructor() {
    this.el = el('div', 'lib-screens');
  }

  get open(): boolean {
    return this.current !== null;
  }

  get kind(): string | null {
    return this.current?.dataset.kind ?? null;
  }

  private show(node: HTMLElement, kind: string, keepUnder = false): HTMLElement {
    if (this.current && keepUnder) {
      this.current.style.display = 'none';
      this.stack.push(this.current);
    } else {
      this.clearTimers();
      this.current?.remove();
      for (const n of this.stack) n.remove();
      this.stack = [];
    }
    node.dataset.kind = kind;
    this.current = node;
    this.el.append(node);
    // Фокус — на отмеченный элемент или первую кнопку: всем можно управлять с клавиатуры
    // (11.6.3). Отметка главнее порядка в документе.
    queueMicrotask(() =>
      (
        node.querySelector<HTMLElement>('[data-autofocus]') ??
        node.querySelector<HTMLElement>('button:not(:disabled)')
      )?.focus({ preventScroll: true }),
    );
    return node;
  }

  /** Закрывает верхний экран; если под ним был другой — возвращает его. */
  back(): void {
    this.current?.remove();
    this.current = this.stack.pop() ?? null;
    if (this.current) {
      this.current.style.display = '';
      this.current
        .querySelector<HTMLElement>('button:not(:disabled)')
        ?.focus({ preventScroll: true });
    }
  }

  clear(): void {
    this.clearTimers();
    this.current?.remove();
    for (const n of this.stack) n.remove();
    this.stack = [];
    this.current = null;
  }

  private clearTimers(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
  }

  // ─────────────── загрузка ───────────────

  loading(tip: string): { setProgress: (f: number) => void } {
    const screen = el('div', 'lib-screen lib-loading');
    const card = el('div', 'lib-card');
    corners(card);
    const word = el('p', 'lib-loading__word', ru.loading);
    word.setAttribute('lang', 'de');
    const bar = el('div', 'lib-loading__bar');
    const fill = el('div', 'lib-loading__fill');
    bar.append(fill);
    card.append(
      word,
      el('div', 'lib-rule'),
      el('p', 'lib-text', tip),
      bar,
      el('p', 'lib-note', ru.loadingNote),
    );
    screen.append(card);
    this.show(screen, 'loading');
    return {
      setProgress: (f) => {
        fill.style.width = `${Math.round(Math.min(1, Math.max(0, f)) * 100)}%`;
      },
    };
  }

  // ─────────────── меню ───────────────

  menu(h: MenuHandlers, canChooseLevel: boolean): void {
    const screen = el('div', 'lib-screen lib-menu');
    const plate = el('div', 'lib-menu__plate');
    corners(plate);
    const title = el('h1', 'lib-title');
    const initial = el('span', 'lib-title__initial', ru.title.slice(0, 1));
    title.append(initial, document.createTextNode(ru.title.slice(1)));
    const sub = el('p', 'lib-subtitle', ru.subtitle);
    sub.setAttribute('lang', 'de');
    const play = button(ru.play, 'lib-btn--gold lib-glint', h.onPlay);
    play.dataset.autofocus = '';
    const row = el('div', 'lib-row');
    if (canChooseLevel) row.append(button(ru.levels, 'lib-btn--small', h.onLevels));
    if (h.quiz) row.append(button(ru.menuQuiz, 'lib-btn--small', h.quiz.onOpen));
    row.append(button(ru.settings, 'lib-btn--small', h.onSettings));
    plate.append(
      title,
      sub,
      el('div', 'lib-rule'),
      el('p', 'lib-rubric', ru.menuLead),
      el('p', 'lib-text', ru.menuHow),
      play,
      row,
    );
    if (h.quiz) plate.append(el('p', 'lib-quiz-summary', h.quiz.summary));
    screen.append(plate);
    this.show(screen, 'menu');
  }

  // ─────────────── выбор уровня ───────────────

  levels(entries: LevelEntry[], onPick: (id: number) => void, onBack: () => void): void {
    const screen = el('div', 'lib-screen lib-screen--veil');
    const card = el('div', 'lib-card lib-card--wide');
    corners(card);
    const grid = el('div', 'lib-levels');
    for (const e of entries) {
      const b = el('button', 'lib-level');
      b.type = 'button';
      b.disabled = !e.unlocked;
      const name = ru.levelName(e.level.id);
      const traits = [
        ru.levelTraits.librarians(e.level.librarians),
        ru.levelTraits.cards(e.level.cards),
        ru.levelTraits.hints[e.level.hintPreset],
      ].join(' · ');
      b.setAttribute(
        'aria-label',
        `${name}. ${traits}. ${e.unlocked ? (e.played ? ru.bestStars(e.stars) : ru.notPlayed) : ru.levelLocked}`,
      );
      const num = el('span', 'lib-level__num', ru.levelShort(e.level.id));
      const mini = el('span', 'lib-level__mini');
      mini.style.backgroundImage = `url(${e.mini})`;
      b.append(num, mini, stars(e.stars), el('span', 'lib-level__traits', traits));
      if (e.unlocked) b.addEventListener('click', () => onPick(e.level.id));
      grid.append(b);
    }
    card.append(
      el('h2', 'lib-heading', ru.chooseLevel),
      el('div', 'lib-rule'),
      grid,
      button(ru.back, 'lib-btn--small', onBack),
    );
    screen.append(card);
    this.show(screen, 'levels');
  }

  // ─────────────── интро ───────────────

  /** wait — подпись под заголовком, пока генерация готовит первое задание раунда. */
  intro(text: string, onSkip: () => void, wait?: string): void {
    const screen = el('div', 'lib-screen lib-intro');
    screen.setAttribute('role', 'button');
    screen.setAttribute('aria-label', ru.introSkip);
    screen.tabIndex = 0;
    const card = el('div', 'lib-intro__card');
    card.append(el('p', 'lib-rubric', text));
    if (wait) {
      const w = el('p', 'lib-intro__wait', wait);
      w.setAttribute('role', 'status');
      card.append(w);
    }
    screen.append(card);
    screen.addEventListener('pointerdown', onSkip, { once: true });
    screen.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') onSkip();
    });
    this.show(screen, 'intro');
  }

  // ─────────────── финальная анимация (пропускается тапом) ───────────────

  outroCatcher(onSkip: () => void): void {
    const screen = el('div', 'lib-screen');
    screen.style.background = 'transparent';
    screen.addEventListener('pointerdown', onSkip, { once: true });
    this.show(screen, 'outro');
  }

  // ─────────────── пауза ───────────────

  pause(h: PauseHandlers): void {
    const screen = el('div', 'lib-screen lib-screen--veil');
    const card = el('div', 'lib-card');
    corners(card);
    const resume = button(ru.resume, 'lib-btn--gold lib-glint', h.onResume);
    resume.dataset.autofocus = '';
    const row = el('div', 'lib-row');
    row.append(
      button(ru.restart, 'lib-btn--small', h.onRestart),
      button(ru.settings, 'lib-btn--small', h.onSettings),
    );
    card.append(
      el('h2', 'lib-heading', ru.paused),
      el('div', 'lib-rule'),
      el('p', 'lib-note', ru.pausedNote),
      resume,
      row,
      button(ru.toMenu, 'lib-btn--small lib-btn--quiet', h.onMenu),
    );
    screen.append(card);
    this.show(screen, 'pause');
  }

  // ─────────────── итоги ───────────────

  results(d: ResultData, h: ResultHandlers, reduced: boolean): void {
    const screen = el('div', 'lib-screen lib-screen--veil lib-results');
    const heading = el(
      'h2',
      'lib-heading',
      d.won ? (d.near ? ru.resultWonClose : ru.resultWon) : ru.resultLost,
    );
    const cards = el('div', 'lib-results__cards');

    // Карточка 1: снимок кадра.
    const c1 = el('div', 'lib-result-card');
    c1.style.setProperty('--tilt', '-1.2deg');
    const shot = el('img', 'lib-result-card__shot');
    shot.alt = ru.resultCardSnapshot;
    if (d.snapshot) shot.src = d.snapshot;
    c1.append(el('p', 'lib-rubric', ru.resultCardSnapshot), shot);

    // Карточка 2: собранная карта и оставшиеся билеты.
    const c2 = el('div', 'lib-result-card');
    c2.style.setProperty('--tilt', '0.8deg');
    const map = el('div', 'lib-result-map');
    map.setAttribute('role', 'img');
    map.setAttribute(
      'aria-label',
      d.pages.length === 3 ? ru.resultMapDone : ru.resultMapPart(d.pages.length),
    );
    for (let i = 0; i < 3; i++) {
      const s = el('span', `lib-slot lib-slot--page${d.pages.includes(i) ? '' : ' is-empty'}`);
      s.style.backgroundImage = `var(--icon-page-${i})`;
      map.append(s);
    }
    const ticketRow = el('div', 'lib-result-cards');
    for (let i = 0; i < d.cardsTotal; i++) {
      const s = el('span', `lib-slot lib-slot--card${i >= d.cardsLeft ? ' is-void' : ''}`);
      s.style.backgroundImage = 'var(--icon-card)';
      ticketRow.append(s);
    }
    c2.append(
      el('p', 'lib-rubric', ru.resultCardMap),
      map,
      el(
        'p',
        'lib-note',
        d.pages.length === 3 ? ru.resultMapDone : ru.resultMapPart(d.pages.length),
      ),
      ticketRow,
      el('p', 'lib-note', ru.resultCardsLeft(d.cardsLeft)),
    );

    // Карточка 3: звёзды и статистика.
    const c3 = el('div', 'lib-result-card');
    c3.style.setProperty('--tilt', '-0.5deg');
    const dl = el('dl', 'lib-stats');
    const row = (k: string, v: string): void => {
      dl.append(el('dt', '', k), el('dd', '', v));
    };
    row(ru.statCorrect, String(d.correct));
    row(ru.statWrong, String(d.wrong));
    row(ru.statHeard, ru.times(d.heard));
    row(ru.statThrows, String(d.throws));
    if (d.medianMs !== null) row(ru.statMedian, ru.seconds(d.medianMs / 1000));
    row(ru.statTime, fmtTime(d.timeSec));
    if (d.bestSec !== null) row(d.newRecord ? ru.statBestNew : ru.statBest, fmtTime(d.bestSec));
    const labels = el('div', 'lib-note');
    labels.textContent = ru.starLabels.slice(0, Math.max(1, d.stars)).join(' · ');
    c3.append(
      el('p', 'lib-rubric', ru.resultCardStats),
      stars(d.stars, 3, true),
      d.won ? labels : el('span'),
      dl,
    );

    cards.append(c1, c2, c3);
    const buttons = el('div', 'lib-row');
    const again = button(ru.again, 'lib-btn--gold lib-glint', h.onAgain);
    again.dataset.autofocus = '';
    buttons.append(again);
    buttons.append(
      button(
        d.won && d.hasNext ? ru.next : ru.toMenu,
        '',
        d.won && d.hasNext ? h.onNext : h.onMenu,
      ),
    );
    screen.append(heading, cards, buttons);
    this.show(screen, 'results');
    // Три карточки появляются по очереди; кнопки доступны сразу (2.6.7).
    [c1, c2, c3].forEach((c, i) => {
      if (reduced) c.classList.add('is-in');
      else this.timers.push(window.setTimeout(() => c.classList.add('is-in'), 80 + i * 260));
    });
  }

  // ─────────────── выбор тем вопросов (движок Morskoy) ───────────────

  /**
   * Уровень, лексическая тема, до пяти тем (свои наборы слов и грамматика), порядок слов и
   * аудирование — шаги меню Morskoy на одной карточке. Открывается поверх меню.
   */
  quiz(initial: QuizConfig | null, status: Promise<AiStatus>, h: QuizHandlers): void {
    const t = ru.quiz;
    const cur: QuizConfig = initial
      ? { ...initial, grammarTopics: [...initial.grammarTopics] }
      : {
          level: 'A2',
          lexicalTopic: null,
          grammarTopics: [],
          wortstellung: false,
          listening: false,
        };
    const screen = el('div', 'lib-screen lib-screen--veil');
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');
    screen.setAttribute('aria-label', t.title);
    const card = el('div', 'lib-card lib-card--wide lib-quiz');
    corners(card);
    card.append(el('h2', 'lib-heading', t.title), el('div', 'lib-rule'));
    card.append(el('p', 'lib-quiz-intro', t.intro));
    const note = el('p', 'lib-quiz-status', t.checking);
    note.setAttribute('role', 'status');
    card.append(note);
    void status.then((st) => {
      note.textContent = !st.available ? t.noServer : !st.generationConfigured ? t.noKey : '';
    });

    const section = (title?: string | HTMLElement): HTMLElement => {
      const box = el('section', 'lib-quiz-section');
      if (title) box.append(typeof title === 'string' ? el('h3', 'lib-quiz-title', title) : title);
      card.append(box);
      return box;
    };

    /** Группа кнопок-радио. */
    const radio = <T extends string | null>(
      label: string,
      options: [T, string][],
      value: () => T,
      set: (v: T) => void,
      all: { b: HTMLButtonElement; v: T }[],
    ): HTMLElement => {
      const group = el('div', 'lib-tags');
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', label);
      for (const [v, text] of options) {
        const b = el('button', 'lib-tag', text);
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.addEventListener('click', () => {
          set(v);
          for (const x of all) {
            const on = x.v === value();
            x.b.classList.toggle('is-on', on);
            x.b.setAttribute('aria-checked', String(on));
          }
        });
        const on = v === value();
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', String(on));
        group.append(b);
        all.push({ b, v });
      }
      return group;
    };

    const levelBox = section(t.level);
    const levelGroup = radio<CefrLevel>(
      t.level,
      CEFR_LEVELS.map((l): [CefrLevel, string] => [l, `${l} · ${t.levels[l] ?? ''}`]),
      () => cur.level,
      (v) => (cur.level = v),
      [],
    );
    levelBox.append(levelGroup);

    // Лексическая тема: «Любая», повседневные темы и дополнительные — одна группа-радио.
    const lexBox = section(t.lexical);
    const lexButtons: { b: HTMLButtonElement; v: string | null }[] = [];
    const lex = (title: string | null, options: [string | null, string][]): void => {
      if (title) lexBox.append(el('div', 'lib-quiz-group-title', title));
      const g = radio<string | null>(
        t.lexical,
        options,
        () => cur.lexicalTopic,
        (v) => (cur.lexicalTopic = v),
        lexButtons,
      );
      g.lang = 'de';
      lexBox.append(g);
    };
    lex(null, [[null, t.lexicalAny]]);
    (lexBox.lastElementChild?.firstElementChild as HTMLElement | null)?.setAttribute('lang', 'ru');
    lex(
      t.lexicalBase,
      BASE_LEXICAL_TOPICS.map((x): [string, string] => [x, x]),
    );
    lex(
      t.lexicalExtra,
      EXTRA_LEXICAL_TOPICS.map((x): [string, string] => [x, x]),
    );
    lexBox.append(el('p', 'lib-field__note', t.lexicalNote));

    // Темы: свои наборы слов и грамматика, вместе не больше MAX_GRAMMAR_TOPICS.
    const topicsTitle = el('h3', 'lib-quiz-title');
    const topicsBox = section(topicsTitle);
    const topicButtons: { b: HTMLButtonElement; topic: string }[] = [];
    const group = (title: string, topics: readonly string[], groupNote?: string): void => {
      topicsBox.append(el('div', 'lib-quiz-group-title', title));
      const tags = el('div', 'lib-tags');
      tags.lang = 'de';
      for (const topic of topics) {
        const b = el('button', 'lib-tag', topic);
        b.type = 'button';
        b.addEventListener('click', () => {
          const i = cur.grammarTopics.indexOf(topic);
          if (i >= 0) cur.grammarTopics.splice(i, 1);
          else if (cur.grammarTopics.length < MAX_GRAMMAR_TOPICS) cur.grammarTopics.push(topic);
          syncTopics();
        });
        tags.append(b);
        topicButtons.push({ b, topic });
      }
      topicsBox.append(tags);
      if (groupNote) topicsBox.append(el('p', 'lib-field__note', groupNote));
    };
    group(t.groups.vocab ?? 'vocab', VOCAB_TOPICS, t.vocabNote);
    for (const g of GRAMMAR_GROUPS) group(t.groups[g.id] ?? g.id, g.topics);

    // Порядок слов и аудирование — отдельные потоки заданий поверх выбранных тем.
    const extras = section();
    const check = (
      label: string,
      value: () => boolean,
      set: (v: boolean) => void,
    ): { row: HTMLElement; input: HTMLInputElement; hint: HTMLElement; sync: () => void } => {
      const row = el('label', 'lib-quiz-check');
      const input = el('input');
      input.type = 'checkbox';
      input.addEventListener('change', () => {
        set(input.checked);
        syncTopics();
      });
      const hint = el('span', 'lib-field__note');
      row.append(input, el('span', '', label), hint);
      extras.append(row);
      return { row, input, hint, sync: () => (input.checked = value()) };
    };
    const word = check(
      t.wortstellung,
      () => cur.wortstellung,
      (v) => (cur.wortstellung = v),
    );
    const listen = check(
      t.listening,
      () => cur.listening,
      (v) => (cur.listening = v),
    );
    listen.hint.textContent = t.listeningHint;

    const need = el('p', 'lib-quiz-need');
    need.setAttribute('role', 'status');
    card.append(need);
    const done = button(t.done, 'lib-btn--gold', () =>
      h.onDone({ ...cur, grammarTopics: [...cur.grammarTopics] }),
    );
    const actions = el('div', 'lib-row lib-quiz-actions');
    actions.append(
      done,
      button(t.bank, 'lib-btn--small', h.onBank),
      button(t.cancel, 'lib-btn--small lib-btn--quiet', h.onCancel),
    );
    card.append(actions);

    const syncTopics = (): void => {
      const n = cur.grammarTopics.length;
      topicsTitle.textContent = t.topics(n, MAX_GRAMMAR_TOPICS);
      for (const { b, topic } of topicButtons) {
        const on = cur.grammarTopics.includes(topic);
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
        b.disabled = !on && n >= MAX_GRAMMAR_TOPICS;
      }
      // Порядок слов — на материале первой грамматической темы: у наборов слов его нет.
      const firstGrammar = cur.grammarTopics.find((topic) => !isVocabTopic(topic)) ?? null;
      if (!firstGrammar) cur.wortstellung = false;
      word.input.disabled = !firstGrammar;
      word.row.classList.toggle('is-locked', !firstGrammar);
      word.hint.textContent = t.wortstellungHint(firstGrammar);
      word.sync();
      listen.sync();
      const ok = n > 0 || cur.listening;
      done.disabled = !ok;
      need.textContent = ok ? '' : t.needTopic;
    };
    syncTopics();

    screen.append(card);
    // Фокус — на выбранный уровень: с него начинается выбор.
    levelGroup.querySelector<HTMLElement>('.is-on')?.setAttribute('data-autofocus', '');
    this.show(screen, 'quiz', true);
  }

  // ─────────────── настройки ───────────────

  settings(
    s: SettingsData,
    level: LevelConfig | null,
    h: SettingsHandlers,
    autoLowered: boolean,
  ): void {
    const screen = el('div', 'lib-screen lib-screen--veil');
    const card = el('div', 'lib-card');
    corners(card);
    const form = el('div', 'lib-settings');

    const check = (
      label: string,
      value: boolean,
      onChange: (v: boolean) => void,
      note?: string,
      locked = false,
    ): HTMLElement => {
      const f = el('label', `lib-field${locked ? ' is-locked' : ''}`);
      const input = el('input');
      input.type = 'checkbox';
      input.checked = value && !locked;
      input.disabled = locked;
      input.addEventListener('change', () => onChange(input.checked));
      f.append(el('span', '', label), input);
      if (note) f.append(el('span', 'lib-field__note', note));
      return f;
    };
    const range = (label: string, value: number, onChange: (v: number) => void): HTMLElement => {
      const f = el('label', 'lib-field');
      const input = el('input');
      input.type = 'range';
      input.min = '0';
      input.max = '1';
      input.step = '0.05';
      input.value = String(value);
      input.addEventListener('input', () => onChange(Number(input.value)));
      f.append(el('span', '', label), input);
      return f;
    };
    const select = <T extends string>(
      label: string,
      value: T,
      options: [T, string][],
      onChange: (v: T) => void,
      note?: string,
    ): HTMLElement => {
      const f = el('label', 'lib-field');
      const sel = el('select');
      for (const [v, t] of options) {
        const o = el('option', '', t);
        o.value = v;
        o.selected = v === value;
        sel.append(o);
      }
      sel.addEventListener('change', () => onChange(sel.value as T));
      f.append(el('span', '', label), sel);
      if (note) f.append(el('span', 'lib-field__note', note));
      return f;
    };

    const sound = el('fieldset', 'lib-fieldset');
    sound.append(el('legend', '', ru.setSound));
    sound.append(check(ru.setSoundOn, s.sound, (v) => h.onChange({ sound: v })));
    sound.append(range(ru.setSfx, s.sfx, (v) => h.onChange({ sfx: v })));
    sound.append(range(ru.setAmbient, s.ambient, (v) => h.onChange({ ambient: v })));
    sound.append(
      select(
        ru.setSfxLang,
        s.sfxLang,
        [
          ['de', ru.setSfxLangDe],
          ['ru', ru.setSfxLangRu],
        ],
        (v) => h.onChange({ sfxLang: v }),
      ),
    );

    const view = el('fieldset', 'lib-fieldset');
    view.append(el('legend', '', ru.setQuality));
    const reducedNow =
      s.motion === 'reduced' ||
      (s.motion === 'auto' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    view.append(
      check(
        ru.setMotion,
        reducedNow,
        (v) => h.onChange({ motion: v ? 'reduced' : 'full' }),
        ru.setMotionNote,
      ),
    );
    view.append(
      select(
        ru.setQuality,
        s.quality,
        [
          ['high', ru.setQualityHigh],
          ['low', ru.setQualityLow],
        ],
        (v) => h.onChange({ quality: v, qualityAuto: false }),
        autoLowered || s.qualityAuto ? ru.setQualityAuto : undefined,
      ),
    );

    const hints = el('fieldset', 'lib-fieldset');
    hints.append(el('legend', '', ru.setHints));
    const allowed: HintSet = level ? hintPresets[level.hintPreset] : hintPresets.all;
    const hint = (key: keyof HintSet, label: string): HTMLElement =>
      check(
        label,
        s.hintsOff[key] !== false,
        (v) => h.onChange({ hintsOff: { ...s.hintsOff, [key]: v } }),
        undefined,
        !allowed[key],
      );
    hints.append(
      hint('librarianPath', ru.setHintPath),
      hint('loudRing', ru.setHintRing),
      hint('redStep', ru.setHintStep),
      hint('throwCircle', ru.setHintCircle),
      hint('cautiousStep', ru.setHintCautious),
      el('span', 'lib-field__note', ru.setHintsNote),
    );

    const reset = button(ru.setResetTutorial, 'lib-btn--small lib-btn--quiet');
    reset.addEventListener('click', () => {
      h.onResetTutorial();
      reset.textContent = ru.setResetDone;
      reset.disabled = true;
    });
    form.append(sound, view, hints, reset);
    const close = button(ru.close, 'lib-btn--gold', h.onClose);
    card.append(el('h2', 'lib-heading', ru.settings), form, close);
    screen.append(card);
    this.show(screen, 'settings', true);
  }
}

/** Все уровни, кроме бесконечного, имеют римский номер (для подписей). */
export const LEVELS = levels;
