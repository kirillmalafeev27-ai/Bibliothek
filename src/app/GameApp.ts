/**
 * Приложение игры: раскладка экрана, Phaser, раунд, панель вопроса, плашка, экраны,
 * клавиатура, пауза, обучение, сохранение. Сцены только читают состояние и реагируют
 * на события; всё остальное — здесь (план, 0.3, 13.4).
 */
import Phaser from 'phaser';
import '../ui/parchment.css';
import { applyIcons, buildIcons } from '../art/icons';
import { setupKit } from '../art/kit';
import { levelMiniature } from '../art/miniature';
import type { ArtProvider } from '../art/ArtFactory';
import { grayProvider } from '../art/recipes/gray';
import type { GameAudio } from '../audio/types';
import { NullAudio } from '../audio/types';
import { balance } from '../config/balance';
import type { LevelConfig } from '../config/levels';
import { LEVEL_COUNT, levelById, levels } from '../config/levels';
import { palette } from '../config/palette';
import type { Cell, GameEvent, GameState } from '../core';
import { distance, inEarshot, isListening, starsOf } from '../core';
import { ru } from '../i18n/ru';
import type { SfxKey } from '../i18n/sfx.de';
import { sfxWord } from '../i18n/sfx.de';
import { tipsRu } from '../i18n/tips.ru';
import { BootScene } from '../scenes/BootScene';
import { GameScene } from '../scenes/GameScene';
import type { SceneHost } from '../scenes/host';
import { HOST_KEY } from '../scenes/host';
import { loadFonts } from '../shared/fonts';
import type { Layout } from '../shared/layout';
import { computeLayout, readSafeArea, rectStyle } from '../shared/layout';
import { Pace } from '../shared/pace';
import { Quality } from '../shared/quality';
import { QuestionPanel } from '../shared/QuestionPanel';
import type { QuestionProvider } from '../shared/questions/types';
import type { KeyValueStorage } from '../shared/storage';
import { browserStorage, prefixed } from '../shared/storage';
import { applyParchmentTextures, applyParchmentVars } from '../shared/themes/parchment';
import type { ThemeColors } from '../shared/themes/parchment';
import { GearWidget } from '../ui/GearWidget';
import { Screens, el } from '../ui/screens/Screens';
import { DebugPanel } from './DebugPanel';
import { Round } from './Round';
import type { TutorialKey } from './stores';
import { Progress, STORAGE_PREFIX, Settings } from './stores';

export interface FinishResult {
  level: number;
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  cardsLeft: number;
  heard: number;
  throws: number;
  timeMs: number;
}

export interface MountOptions {
  questions: QuestionProvider;
  storage?: KeyValueStorage;
  /** С какого уровня начать: сразу в игру, минуя меню. */
  level?: number;
  onFinish?: (r: FinishResult) => void;
  /** Набор рисунков: рукописный (по умолчанию) или серый прототип. */
  art?: ArtProvider;
  audio?: GameAudio;
  /** Dev-режим: отладочная панель по клавише `. */
  dev?: boolean;
  /** Сцена теста читаемости слуха (8.4): застывший кадр без вопросов. */
  hearingTest?: boolean;
}

type Phase = 'boot' | 'menu' | 'intro' | 'play' | 'outro' | 'results' | 'test';

const THEME: ThemeColors = {
  parchment: palette.parchment,
  parchmentShade: palette.parchmentShade,
  parchmentEdge: palette.parchmentEdge,
  paperWhite: palette.derived.paperWhite,
  ink: palette.ink,
  inkFaded: palette.inkFaded,
  rubric: palette.rubric,
  gold: palette.gold,
  goldInk: palette.derived.goldInk,
  alarmDark: palette.alarm.dark,
  good: palette.good,
  bad: palette.bad,
  blue: palette.librarian.robe,
  blueDeep: palette.librarian.robeDark,
};

function randomSeed(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] as number;
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export class GameApp {
  readonly root: HTMLElement;
  private readonly worldEl: HTMLElement;
  private readonly vines: HTMLElement[] = [];
  private readonly panel: QuestionPanel;
  private readonly gear: GearWidget;
  private readonly screens: Screens;
  private readonly settings: Settings;
  private readonly progress: Progress;
  private readonly pace: Pace;
  private readonly quality: Quality;
  private readonly audio: GameAudio;
  private readonly provider: ArtProvider;
  private readonly debug: DebugPanel | null;
  private game: Phaser.Game | null = null;
  private scene: GameScene | null = null;
  private layout: Layout | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly cleanups: (() => void)[] = [];

  private _phase: Phase = 'boot';

  private get phase(): Phase {
    return this._phase;
  }

  private set phase(p: Phase) {
    this._phase = p;
    this.root.dataset.phase = p;
  }
  private round: Round | null = null;
  private roundUnsub: (() => void) | null = null;
  private attract: Round | null = null;
  private paused = false;
  private tutorial: { key: TutorialKey; el: HTMLElement } | null = null;
  private tutorialQueue: TutorialKey[] = [];
  private answerTimes: number[] = [];
  private exitNear = false;
  private toastAt = 0;
  private destroyed = false;
  private minis: Map<number, string> | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: MountOptions,
  ) {
    setupKit();
    const storage = options.storage ?? browserStorage();
    const store = prefixed(storage, STORAGE_PREFIX);
    this.settings = new Settings(store);
    this.progress = new Progress(store);
    this.pace = new Pace(storage, balance.pace);
    this.quality = new Quality(balance.perf, this.settings.data.quality, this.settings.data.motion);
    this.audio = options.audio ?? new NullAudio();
    this.provider = options.art ?? grayProvider;

    this.root = el('div', 'lib-root');
    this.root.dataset.phase = 'boot';
    this.root.dataset.pointer = matchMedia('(pointer: fine)').matches ? 'fine' : 'coarse';
    applyParchmentVars(this.root, THEME);
    for (const side of ['top', 'bottom', 'left', 'right']) {
      const v = el('div', `lib-vine lib-vine--${side}`);
      this.vines.push(v);
      this.root.append(v);
    }
    this.worldEl = el('div', 'lib-world');
    this.panel = new QuestionPanel({
      provider: options.questions,
      strings: ru,
      timings: {
        correctFlashMs: balance.correctFlashMs,
        swapMs: balance.questionSwapMs,
        wrongFeedbackMs: balance.wrongFeedbackMs,
        doubleTapGuardMs: balance.doubleTapGuardMs,
      },
      onAnswer: (a) => this.onAnswer(a.correct, a.timeMs),
      exposeAnswer: options.dev === true,
    });
    this.gear = new GearWidget({
      onThrow: () => this.onThrowButton(),
      onStay: () => this.onStay(),
      onPause: () => this.setPaused(!this.paused),
    });
    this.screens = new Screens();
    this.worldEl.append(this.gear.el);
    this.root.append(this.worldEl, this.panel.el, this.screens.el);
    this.debug = options.dev ? new DebugPanel(this.root, (op) => this.debugOp(op)) : null;
    container.append(this.root);
    this.applyMotion();
    this.audio.setSettings({ on: this.settings.data.sound, sfx: this.settings.data.sfx, ambient: this.settings.data.ambient });
    this.cleanups.push(this.settings.onChange(() => this.onSettingsChanged()));
    this.cleanups.push(this.quality.onChange(() => this.applyMotion()));

    this.bindKeys();
    this.bindVisibility();
    this.relayout();
    this.resizeObserver = new ResizeObserver(() => this.relayout());
    this.resizeObserver.observe(this.root);
    void this.boot();
  }

  // ─────────────── загрузка ───────────────

  private async boot(): Promise<void> {
    const tip = tipsRu[Math.floor(Math.random() * tipsRu.length)] ?? '';
    const loading = this.screens.loading(tip);
    loading.setProgress(0.05);
    await loadFonts();
    if (this.destroyed) return;
    applyParchmentTextures(this.root, THEME);
    applyIcons(this.root, buildIcons());
    loading.setProgress(0.15);
    const host: SceneHost = {
      provider: this.provider,
      ppc: this.quality.low ? balance.perf.cellPxLow : balance.perf.cellPx,
      quality: this.quality,
      art: null,
      layout: () => this.layout as Layout,
      dpr: () => this.dpr(),
      word: (key: SfxKey) => sfxWord(key, this.settings.data.sfxLang),
      cyrillic: () => this.settings.data.sfxLang === 'ru',
      sound: (name, at) => this.playSound(name, at ?? null),
      onBootProgress: (done, total) => loading.setProgress(0.15 + 0.85 * (done / total)),
      onBootDone: (ms) => {
        if (ms > balance.perf.textureBudgetMs) console.warn(`Генерация текстур: ${Math.round(ms)} мс`);
        (window as unknown as { __libGenMs?: number }).__libGenMs = ms;
      },
      onSceneReady: () => this.onSceneReady(),
      onFrame: (dtMs) => this.frame(dtMs),
      onCellTap: (cell) => this.onCellTap(cell),
      onCellHover: (cell) => this.onCellHover(cell),
      pageSlotPoint: (id) => this.gear.pageSlotPoint(id),
    };
    const layout = this.layout as Layout;
    const d = this.dpr();
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.worldEl,
      transparent: true,
      banner: false,
      autoFocus: false,
      disableContextMenu: true,
      scale: {
        mode: Phaser.Scale.NONE,
        width: Math.max(1, Math.round(layout.world.w * d)),
        height: Math.max(1, Math.round(layout.world.h * d)),
      },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      audio: { noAudio: true },
      render: { antialias: true, antialiasGL: true, roundPixels: false, preserveDrawingBuffer: false },
      scene: [BootScene, GameScene],
      callbacks: {
        preBoot: (game) => {
          game.registry.set(HOST_KEY, host);
        },
      },
    });
  }

  private onSceneReady(): void {
    if (!this.game) return;
    this.scene = this.game.scene.getScene('Game') as GameScene;
    this.relayout();
    this.screens.clear();
    if (this.options.hearingTest) this.startHearingTest();
    else if (this.options.level !== undefined) this.startLevel(this.options.level);
    else this.showMenu();
  }

  // ─────────────── раскладка ───────────────

  private dpr(): number {
    return Math.min(window.devicePixelRatio || 1, balance.perf.maxDpr);
  }

  private relayout(): void {
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    if (w < 2 || h < 2) return;
    const layout = computeLayout(w, h, readSafeArea(this.root));
    this.layout = layout;
    this.root.dataset.orient = layout.orientation;
    this.root.dataset.tier = layout.tier;
    rectStyle(this.worldEl, layout.world);
    rectStyle(this.panel.el, layout.question);
    this.gear.layout(layout);
    const vine = Math.max(8, layout.gap + 6);
    this.root.style.setProperty('--vine-size', `${vine}px`);
    this.panel.refit();
    const game = this.game;
    if (game?.isBooted) {
      const d = this.dpr();
      game.scale.resize(Math.max(1, Math.round(layout.world.w * d)), Math.max(1, Math.round(layout.world.h * d)));
      game.canvas.style.width = `${layout.world.w}px`;
      game.canvas.style.height = `${layout.world.h}px`;
      this.scene?.relayout(layout, d);
    }
  }

  private applyMotion(): void {
    this.root.dataset.motion = this.quality.reducedMotion ? 'reduced' : 'full';
    this.root.dataset.quality = this.quality.level;
  }

  // ─────────────── тест читаемости слуха (8.4) ───────────────

  /**
   * Застывший кадр: библиотекарь слушает в открытом зале на плитке обоих тонов,
   * вокруг кольцо громкого слуха, рядом кольцо ошибки у героя и маникула.
   */
  private startHearingTest(): void {
    const level = levelById(3);
    const round = new Round(level, 7);
    const st = round.state;
    const w = st.lib.w;
    const h = st.lib.h;
    const tiles = st.lib.tiles.map((t, i) => {
      const x = i % w;
      const y = Math.floor(i / w);
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      return edge ? t : 0;
    }) as typeof st.lib.tiles;
    const lib = { ...st.lib, tiles, desks: [{ x: 1, y: 1 }] };
    round.state = {
      ...st,
      lib,
      pages: [],
      books: [],
      hero: { ...st.hero, cell: { x: 4, y: 8 } },
      librarians: [
        {
          ...st.librarians[0]!,
          cell: { x: 4, y: 5 },
          desk: { x: 1, y: 1 },
          mode: 'listen',
          timer: 1e9,
          atWaypoint: false,
          target: { x: 7, y: 3 },
          stepDur: 0,
          from: null,
        },
      ],
    };
    this.round = round;
    this.phase = 'test';
    this.panel.showNote('Тест читаемости слуха');
    this.scene?.attach(round, { mode: 'play', doorSide: 'right' });
    const probe = this.scene?.hearingProbe();
    probe?.freeze(true);
    probe?.ring({ x: 4, y: 8 }, 'error', level.loudR);
    (window as unknown as { __hearing?: unknown }).__hearing = probe;
  }

  // ─────────────── меню и уровни ───────────────

  private startAttract(): void {
    const level = levelById(1);
    const round = new Round(level, randomSeed());
    const st = round.state;
    round.state = {
      ...st,
      hero: { ...st.hero, cell: st.lib.door },
      debug: { deaf: true, infiniteCards: true },
    };
    this.attract = round;
    this.scene?.attach(round, { mode: 'attract', doorSide: 'right' });
  }

  private showMenu(): void {
    this.endRound();
    this.phase = 'menu';
    // В панели вопроса — факт о немецком, как на экране загрузки.
    this.panel.showNote(tipsRu[Math.floor(Math.random() * tipsRu.length)] ?? ru.menuLead);
    this.panel.setHeader(ru.subtitle, null);
    this.startAttract();
    this.screens.menu(
      {
        onPlay: () => {
          this.audio.unlock();
          if (this.progress.data.unlocked > 1) this.showLevels();
          else this.startLevel(1);
        },
        onLevels: () => {
          this.audio.unlock();
          this.showLevels();
        },
        onSettings: () => this.showSettings(null),
      },
      this.progress.data.unlocked > 1,
    );
  }

  private showLevels(): void {
    if (!this.minis) this.minis = new Map(levels.map((l) => [l.id, levelMiniature(l)]));
    const entries = levels.map((level) => {
      const rec = this.progress.record(level.id);
      return {
        level,
        unlocked: this.progress.isUnlocked(level.id),
        stars: rec?.stars ?? 0,
        played: !!rec,
        mini: this.minis?.get(level.id) ?? '',
      };
    });
    this.screens.levels(entries, (id) => this.startLevel(id), () => this.showMenu());
  }

  private showSettings(level: LevelConfig | null): void {
    this.screens.settings(
      this.settings.data,
      level,
      {
        onChange: (patch) => this.settings.update(patch),
        onResetTutorial: () => this.settings.resetTutorial(),
        onClose: () => this.screens.back(),
      },
      this.quality.wasAutoLowered,
    );
  }

  private onSettingsChanged(): void {
    const s = this.settings.data;
    this.quality.setMotion(s.motion);
    if (s.quality !== this.quality.level && !this.quality.wasAutoLowered) this.quality.setLevel(s.quality);
    this.audio.setSettings({ on: s.sound, sfx: s.sfx, ambient: s.ambient });
  }

  // ─────────────── раунд ───────────────

  private endRound(): void {
    this.roundUnsub?.();
    this.roundUnsub = null;
    this.round = null;
    this.attract = null;
    this.paused = false;
    this.scene?.setPaused(false);
    this.panel.setPaused(false);
    this.panel.setFrozen(false);
    this.panel.stop();
    this.closeTutorial(false);
    this.tutorialQueue = [];
    this.audio.setPaused(false);
  }

  startLevel(id: number): void {
    const level = levelById(Math.min(LEVEL_COUNT, Math.max(1, id)));
    this.endRound();
    const seed = randomSeed();
    // Темп фиксируется на старте раунда и внутри раунда не меняется (3.4).
    const round = new Round(level, seed, { tMedSec: this.pace.tMedSec(), hintsOff: this.settings.data.hintsOff });
    this.round = round;
    this.answerTimes = [];
    this.exitNear = false;
    this.roundUnsub = round.subscribe((events, state) => this.onRoundEvents(events, state));
    this.cleanups.push(round.onUi(() => this.refreshHud()));
    (this.options.questions as { resetRound?: () => void }).resetRound?.();
    this.phase = 'intro';
    this.scene?.attach(round, {
      mode: 'intro',
      // В ландшафте сторона двери — случайная, слева или справа (раздел 5.8).
      doorSide: seed & 1 ? 'left' : 'right',
      onIntroDone: () => this.onIntroDone(),
      onOutroDone: (r) => this.onOutroDone(r),
    });
    this.panel.showNote(ru.getReady);
    this.panel.warmUp();
    this.screens.intro(ru.intro, () => this.scene?.skipIntro());
    this.refreshHud();
  }

  private onIntroDone(): void {
    if (this.phase !== 'intro') return;
    this.screens.clear();
    this.phase = 'play';
    this.panel.start();
    this.maybeTutorial('move');
  }

  private onRoundEvents(events: GameEvent[], state: GameState): void {
    for (const e of events) {
      switch (e.type) {
        case 'ANSWERED':
          this.pace.record(e.correct, e.timeMs, e.paced);
          this.answerTimes.push(e.timeMs);
          break;
        case 'DENIED': {
          const text =
            e.reason === 'halo'
              ? ru.hintListening
              : e.reason === 'noBooks'
                ? ru.hintNoBooks
                : e.reason === 'outOfRange'
                  ? ru.hintTooFar
                  : e.cell && e.cell.x === state.lib.door.x && e.cell.y === state.lib.door.y
                    ? ru.hintNeedPages
                    : ru.hintBlocked;
          this.toast(text);
          break;
        }
        case 'LISTEN_START':
          this.maybeTutorial('listen');
          break;
        case 'PICKUP':
          if (e.item === 'book' && state.level.id === 1) this.maybeTutorial('throw');
          break;
        case 'RUN':
          if (state.level.id === 1 && state.hero.books > 0) this.maybeTutorial('throw');
          break;
        case 'SCENE_END':
          this.maybeTutorial('caught');
          break;
        case 'EXIT':
          this.exitNear = e.near;
          this.enterOutro();
          break;
        case 'LOST':
          this.enterOutro();
          break;
        default:
          break;
      }
    }
    this.refreshHud();
  }

  private enterOutro(): void {
    this.phase = 'outro';
    this.panel.stop();
    this.round?.endAim();
    this.closeTutorial(false);
    this.tutorialQueue = [];
    this.screens.outroCatcher(() => this.scene?.skipOutro());
  }

  private onOutroDone(result: 'won' | 'lost'): void {
    const round = this.round;
    if (!round || this.phase !== 'outro') return;
    this.phase = 'results';
    const st = round.state;
    const won = result === 'won';
    const stars = starsOf(st);
    const timeSec = st.stats.timeSec;
    const newRecord = this.progress.save(st.level.id, won, stars, timeSec);
    const rec = this.progress.record(st.level.id);
    this.options.onFinish?.({
      level: st.level.id,
      won,
      stars,
      cardsLeft: Math.max(0, st.hero.cards),
      heard: st.stats.heard,
      throws: st.stats.throws,
      timeMs: Math.round(timeSec * 1000),
    });
    const hasNext = st.level.id < LEVEL_COUNT;
    this.screens.results(
      {
        won,
        near: this.exitNear,
        level: st.level,
        stars,
        snapshot: this.scene?.snapshot ?? null,
        pages: st.hero.pages.slice(),
        cardsLeft: Math.max(0, st.hero.cards),
        cardsTotal: st.level.cards,
        correct: st.stats.correct,
        wrong: st.stats.wrong,
        heard: st.stats.heard,
        throws: st.stats.throws,
        medianMs: median(this.answerTimes),
        timeSec,
        bestSec: won ? (rec?.timeSec ?? null) : null,
        newRecord: won && newRecord,
        hasNext,
      },
      {
        onAgain: () => this.startLevel(st.level.id),
        onNext: () => this.startLevel(st.level.id + 1),
        onMenu: () => this.showMenu(),
      },
      this.quality.reducedMotion,
    );
  }

  // ─────────────── ввод ───────────────

  private onAnswer(correct: boolean, timeMs: number): void {
    if (!this.round || this.phase !== 'play') return;
    this.audio.unlock();
    this.round.answer(correct, timeMs);
  }

  private canAct(): boolean {
    return this.phase === 'play' && !this.paused && !this.tutorial && !!this.round;
  }

  private onCellTap(cell: Cell): void {
    this.audio.unlock();
    if (this.tutorial) {
      this.closeTutorial(true);
      return;
    }
    if (!this.canAct()) return;
    this.round?.tap(cell);
  }

  private onCellHover(cell: Cell | null): void {
    const round = this.round;
    if (!round || !round.aiming || !this.canAct()) return;
    round.setAimCell(cell);
  }

  private onThrowButton(): void {
    if (!this.canAct()) return;
    const round = this.round as Round;
    if (!round.toggleAim()) {
      this.toast(ru.hintNoBooks);
      return;
    }
    if (round.aiming) this.toast(ru.hintAim);
  }

  private onStay(): void {
    if (!this.canAct()) return;
    this.round?.stay();
  }

  private bindKeys(): void {
    const onKey = (e: KeyboardEvent): void => {
      if (this.destroyed || e.repeat && e.code.startsWith('Digit')) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) return;
      if (active && active !== document.body && !this.root.contains(active)) return;
      const code = e.code;
      if (code === 'Backquote' && this.debug) {
        this.debug.toggle();
        e.preventDefault();
        return;
      }
      if (this.tutorial && (code === 'Enter' || code === 'Space' || code === 'Escape')) {
        this.closeTutorial(true);
        e.preventDefault();
        return;
      }
      if (this.phase === 'play' || this.phase === 'intro') {
        if (code === 'KeyP' || (code === 'Escape' && !this.round?.aiming)) {
          if (this.screens.kind === 'settings') this.screens.back();
          else this.setPaused(!this.paused);
          e.preventDefault();
          return;
        }
      }
      if (this.phase === 'intro' && (code === 'Enter' || code === 'Space')) {
        this.scene?.skipIntro();
        e.preventDefault();
        return;
      }
      if (this.phase === 'outro' && (code === 'Enter' || code === 'Space' || code === 'Escape')) {
        this.scene?.skipOutro();
        e.preventDefault();
        return;
      }
      if (!this.canAct()) return;
      const round = this.round as Round;
      const digit = /^(Digit|Numpad)([1-4])$/.exec(code);
      if (digit) {
        this.audio.unlock();
        this.panel.answerByIndex(Number(digit[2]) - 1);
        e.preventDefault();
        return;
      }
      const arrows: Record<string, Cell> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
      };
      const dir = arrows[code];
      if (dir) {
        round.arrow(this.scene ? this.scene.arrowToLogic(dir) : dir);
        e.preventDefault();
        return;
      }
      if (code === 'KeyT') {
        this.onThrowButton();
        e.preventDefault();
      } else if (code === 'Enter' && round.aiming) {
        round.confirmAim();
        e.preventDefault();
      } else if (code === 'Escape' && round.aiming) {
        round.endAim();
        e.preventDefault();
      } else if (code === 'Space') {
        if (active instanceof HTMLButtonElement && this.root.contains(active)) return;
        round.stay();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    this.cleanups.push(() => window.removeEventListener('keydown', onKey));
  }

  private bindVisibility(): void {
    // Пауза ставится сама при скрытии вкладки и потере фокуса окна (2.7.1).
    const autoPause = (): void => {
      if ((this.phase === 'play' || this.phase === 'intro') && !this.paused) this.setPaused(true);
      this.quality.resetMeter();
    };
    const onVis = (): void => {
      if (document.visibilityState === 'hidden') autoPause();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', autoPause);
    this.cleanups.push(() => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', autoPause);
    });
  }

  setPaused(paused: boolean): void {
    if (this.phase !== 'play' && this.phase !== 'intro') return;
    if (this.paused === paused) return;
    this.paused = paused;
    this.round?.dispatch({ type: paused ? 'PAUSE' : 'RESUME' });
    if (paused) this.round?.endAim();
    this.scene?.setPaused(paused);
    this.panel.setPaused(paused);
    this.audio.setPaused(paused);
    if (paused) {
      this.screens.pause({
        onResume: () => this.setPaused(false),
        onRestart: () => {
          const id = this.round?.level.id ?? 1;
          this.startLevel(id);
        },
        onSettings: () => this.showSettings(this.round?.level ?? null),
        onMenu: () => this.showMenu(),
      });
    } else {
      this.screens.clear();
      if (this.phase === 'intro') this.screens.intro(ru.intro, () => this.scene?.skipIntro());
    }
    this.refreshHud();
  }

  // ─────────────── обучение (11.5.7) ───────────────

  private maybeTutorial(key: TutorialKey): void {
    if (this.settings.tutorialSeen(key)) return;
    if (this.tutorial?.key === key || this.tutorialQueue.includes(key)) return;
    if (this.tutorial || this.phase !== 'play' || this.paused) {
      if (this.phase === 'play') this.tutorialQueue.push(key);
      return;
    }
    this.openTutorial(key);
  }

  private openTutorial(key: TutorialKey): void {
    const text: Record<TutorialKey, string> = {
      move: ru.tutMove,
      listen: ru.tutListen,
      earshot: ru.tutEarshot,
      throw: ru.tutThrow,
      caught: ru.tutCaught,
    };
    const bubble = el('div', 'lib-bubble');
    bubble.setAttribute('role', 'dialog');
    bubble.setAttribute('aria-live', 'assertive');
    bubble.append(el('div', '', text[key]));
    const ok = el('div', 'lib-bubble__ok');
    const b = el('button', 'lib-btn lib-btn--small', ru.tutOk);
    b.type = 'button';
    b.addEventListener('click', () => this.closeTutorial(true));
    ok.append(b);
    bubble.append(ok);
    bubble.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.worldEl.append(bubble);
    this.tutorial = { key, el: bubble };
    this.settings.markTutorial(key);
    this.round?.endAim();
    this.positionTutorial();
    queueMicrotask(() => b.focus({ preventScroll: true }));
  }

  private positionTutorial(): void {
    const t = this.tutorial;
    const layout = this.layout;
    const head = this.scene?.heroCss();
    if (!t || !layout || !head) return;
    const bw = t.el.offsetWidth || 260;
    const bh = t.el.offsetHeight || 90;
    const W = layout.world.w;
    let x = Math.min(Math.max(8, head.x - bw * 0.3), W - bw - 8);
    let y = head.y - bh - 14;
    let tail = 'down';
    if (y < 6) {
      y = head.y + layout.cell * 1.3;
      tail = 'up';
    }
    t.el.style.left = `${x}px`;
    t.el.style.top = `${y}px`;
    t.el.dataset.tail = tail;
    t.el.style.setProperty('--tail-x', `${Math.min(bw - 24, Math.max(12, head.x - x - 7))}px`);
    x = 0;
  }

  private closeTutorial(advance: boolean): void {
    this.tutorial?.el.remove();
    this.tutorial = null;
    if (advance) {
      const next = this.tutorialQueue.shift();
      if (next && !this.settings.tutorialSeen(next)) this.openTutorial(next);
    }
  }

  // ─────────────── подсказки над героем ───────────────

  private toast(text: string): void {
    const now = performance.now();
    if (now - this.toastAt < 450) return;
    this.toastAt = now;
    const head = this.scene?.heroCss();
    if (!head) return;
    for (const old of this.worldEl.querySelectorAll('.lib-toast')) old.remove();
    const t = el('div', 'lib-toast', text);
    t.setAttribute('role', 'status');
    const W = this.layout?.world.w ?? 400;
    t.style.left = `${Math.min(Math.max(70, head.x), W - 70)}px`;
    t.style.top = `${Math.max(26, head.y - 4)}px`;
    this.worldEl.append(t);
    window.setTimeout(() => t.remove(), 1700);
  }

  // ─────────────── звук ───────────────

  private playSound(name: string, at: Cell | null): void {
    let pan = 0;
    if (at && this.scene && this.layout) {
      const p = this.scene.cellCss(at);
      if (p) pan = Math.max(-1, Math.min(1, (p.x / Math.max(1, this.layout.world.w)) * 2 - 1));
    }
    this.audio.play(name, pan);
  }

  // ─────────────── кадр ───────────────

  private frame(dtMs: number): void {
    if (this.destroyed) return;
    const dt = Math.min(dtMs, 100) / 1000;
    if (this.quality.frame(dt)) {
      this.settings.update({ qualityAuto: true });
    }
    const round = this.round;
    if (this.phase === 'menu' && this.attract) this.attract.tick(dt);
    if (round && (this.phase === 'play' || this.phase === 'outro') && !this.paused && !this.tutorial) {
      if (this.phase === 'play' || round.state.status === 'catchScene') round.tick(dt);
      if (this.phase === 'play') this.panel.tick(dtMs);
    }
    if (round && this.phase === 'play' && !this.paused && !this.tutorial && inEarshot(round.state)) {
      this.maybeTutorial('earshot');
    }
    if (this.tutorial) this.positionTutorial();
    this.refreshHud();
    this.updateAudio(dt);
    this.debug?.update(dt, this.round ?? this.attract, this.pace, this.quality);
  }

  private refreshHud(): void {
    const round = this.round;
    if (!round) return;
    const st = round.state;
    this.gear.update(st, round.aiming);
    if (this.phase === 'intro' || this.phase === 'play' || this.phase === 'outro') {
      const h = st.hero;
      const main = h.ready
        ? ru.headerReady
        : h.intent.kind === 'throw' || round.aiming
          ? ru.headerThrow
          : h.intent.kind === 'move'
            ? ru.headerStep
            : ru.headerIdle;
      const quiet = st.hints.loudRing && st.status === 'playing' && inEarshot(st) ? ru.headerQuiet : null;
      this.panel.setHeader(main, quiet);
      this.panel.setEnabled(!h.ready);
      this.panel.setFrozen(st.status === 'catchScene');
    }
  }

  private updateAudio(dt: number): void {
    const round = this.phase === 'menu' ? this.attract : this.round;
    const playing = !!round && (this.phase === 'play' || this.phase === 'intro') && !this.paused;
    const layout = this.layout;
    const voices =
      round && this.scene && layout
        ? round.state.librarians.map((m) => {
            const p = this.scene?.cellCss(m.cell);
            return {
              pan: p ? Math.max(-1, Math.min(1, (p.x / Math.max(1, layout.world.w)) * 2 - 1)) : 0,
              dist: distance(m.cell, round.state.hero.cell),
              walking: m.mode === 'walk' && m.stepDur > 0,
              running: m.mode === 'run',
              listening: isListening(m),
            };
          })
        : [];
    this.audio.update(dt, {
      playing,
      librarians: this.phase === 'menu' ? [] : voices,
      earshot: playing && !!round && inEarshot(round.state),
    });
  }

  // ─────────────── отладка (13.7) ───────────────

  private debugOp(op: string): void {
    const round = this.round;
    switch (op) {
      case 'deaf':
        round?.dispatch({ type: 'DEBUG', op: { kind: 'deaf', on: !round.state.debug.deaf } });
        break;
      case 'listen':
        round?.dispatch({ type: 'DEBUG', op: { kind: 'forceListen' } });
        break;
      case 'sniff':
        round?.dispatch({ type: 'DEBUG', op: { kind: 'sniffNow' } });
        break;
      case 'cards':
        round?.dispatch({ type: 'DEBUG', op: { kind: 'infiniteCards', on: !round.state.debug.infiniteCards } });
        break;
      case 'hearing': {
        const url = new URL(window.location.href);
        url.searchParams.set('scene', 'hearing');
        window.location.href = url.toString();
        break;
      }
      default:
        break;
    }
  }

  /** Для тестов и отладки: текущее состояние. */
  inspect(): { phase: Phase; state: GameState | null; layout: Layout | null; scene: Record<string, unknown> | null } {
    return {
      phase: this.phase,
      state: this.round?.state ?? null,
      layout: this.layout,
      scene: this.scene?.debugInfo() ?? null,
    };
  }

  /** Для сквозного теста: доступ к раунду. */
  get currentRound(): Round | null {
    return this.round;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.endRound();
    this.resizeObserver?.disconnect();
    for (const fn of this.cleanups) fn();
    this.cleanups.length = 0;
    this.panel.destroy();
    this.gear.destroy();
    this.quality.destroy();
    this.audio.destroy();
    this.game?.destroy(true);
    this.game = null;
    this.root.remove();
    void this.container;
  }
}
