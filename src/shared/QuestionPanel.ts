/**
 * Панель вопроса — общая для серии (план, 11.2, раздел 12, 2.7).
 * DOM-компонент: шапка-рубрика, задание с инициалом, 2–4 таблички вариантов.
 * Своих таймеров не заводит: время идёт только через tick(), поэтому на паузе
 * стоит всё, включая показ ошибки.
 */
import { shuffleOptions } from './questions/LocalBankProvider';
import type { Question, QuestionProvider } from './questions/types';

export interface QuestionPanelStrings {
  panelLabel: string;
  promptLabel: string;
  getReady: string;
  optionLabel: (n: number, text: string) => string;
}

export interface QuestionPanelTimings {
  /** Сколько верная табличка светится зелёным. */
  correctFlashMs: number;
  /** За сколько появляется следующий вопрос. */
  swapMs: number;
  /** Сколько показывается верный вариант после ошибки. */
  wrongFeedbackMs: number;
  /** Защита от двойного тапа: столько после появления вопроса клики игнорируются. */
  doubleTapGuardMs: number;
}

export interface AnswerInfo {
  id: string;
  correct: boolean;
  /** Время от момента, когда вопрос стал активным, до клика. */
  timeMs: number;
}

export interface QuestionPanelOptions {
  provider: QuestionProvider;
  strings: QuestionPanelStrings;
  timings: QuestionPanelTimings;
  /** Вызывается в момент клика: моментом действия считается сам клик (2.2.6). */
  onAnswer: (info: AnswerInfo) => void;
  random?: () => number;
  /** Dev-сборка: верный вариант помечается атрибутом data-correct (для сквозного теста). */
  exposeAnswer?: boolean;
  /** Пределы размера шрифта задания, px (11.2.2). */
  fontMax?: number;
  fontMin?: number;
}

type Phase = 'idle' | 'note' | 'waiting' | 'asking' | 'feedback';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/** Первая буква задания — для инициала. */
function initialOf(text: string): string {
  const m = text.match(/\p{L}/u);
  return m ? m[0].toLocaleUpperCase() : '§';
}

export class QuestionPanel {
  readonly el: HTMLElement;
  private readonly headMain: HTMLElement;
  private readonly headQuiet: HTMLElement;
  private readonly body: HTMLElement;
  private readonly initial: HTMLElement;
  private readonly text: HTMLElement;
  private readonly options: HTMLElement;
  private buttons: HTMLButtonElement[] = [];

  private readonly o: QuestionPanelOptions;
  private phase: Phase = 'idle';
  private current: Question | null = null;
  private preload: Promise<Question> | null = null;
  private enabled = true;
  private paused = false;
  private frozen = false;
  /** Сколько миллисекунд вопрос уже активен. */
  private activeMs = 0;
  /** Сколько прошло с появления вопроса (для защиты от двойного тапа). */
  private shownMs = 0;
  /** Сколько ещё длится показ результата. */
  private feedbackLeft = 0;
  private token = 0;
  private destroyed = false;

  constructor(options: QuestionPanelOptions) {
    this.o = options;
    this.el = el('section', 'lib-question');
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', options.strings.panelLabel);

    const head = el('div', 'lib-q-head');
    head.setAttribute('aria-live', 'polite');
    this.headMain = el('span', 'lib-q-head__main');
    this.headQuiet = el('span', 'lib-q-head__quiet');
    head.append(this.headMain, this.headQuiet);

    this.body = el('div', 'lib-q-body');
    const prompt = el('div', 'lib-q-prompt');
    this.initial = el('div', 'lib-q-initial');
    this.initial.setAttribute('aria-hidden', 'true');
    this.text = el('div', 'lib-q-text');
    this.text.setAttribute('aria-label', options.strings.promptLabel);
    prompt.append(this.initial, this.text);
    this.options = el('div', 'lib-q-options');
    this.body.append(prompt, this.options);

    this.el.append(head, this.body);
    this.options.addEventListener('click', this.onClick);
  }

  /** Шапка: что сделает верный ответ; вторая строка — «Тихо: ошибку услышит». */
  setHeader(main: string, quiet: string | null): void {
    if (this.headMain.textContent !== main) this.headMain.textContent = main;
    const on = quiet !== null;
    if (on && this.headQuiet.textContent !== quiet) this.headQuiet.textContent = quiet;
    this.headQuiet.classList.toggle('is-on', on);
    this.headQuiet.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  /** Готовое действие: таблички бледнеют и неактивны (11.2.7). */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.options.classList.toggle('is-dim', !enabled);
    this.syncDisabled();
  }

  /** На паузе содержимое размыто и время стоит (2.7.2). */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.el.classList.toggle('is-paused', paused);
    this.syncDisabled();
  }

  /** Сцена поимки: мир стоит — вопрос тоже не читается. */
  setFrozen(frozen: boolean): void {
    if (this.frozen === frozen) return;
    this.frozen = frozen;
    this.el.classList.toggle('is-frozen', frozen);
    this.syncDisabled();
  }

  /** Вместо вопроса — надпись (во время интро: «Приготовься…»). */
  showNote(text: string): void {
    this.token++;
    this.phase = 'note';
    this.current = null;
    this.initial.textContent = '';
    this.initial.style.visibility = 'hidden';
    this.text.textContent = text;
    this.text.classList.add('is-note');
    this.text.setAttribute('lang', 'ru');
    this.text.style.removeProperty('--q-font');
    this.options.replaceChildren();
    this.buttons = [];
  }

  /** Начинает задавать вопросы. Следующий вопрос уже загружен заранее (12.4). */
  start(): void {
    if (this.destroyed) return;
    this.ensurePreload();
    if (this.phase !== 'asking' && this.phase !== 'feedback') this.showNext();
  }

  /** Перестаёт задавать вопросы (конец раунда). */
  stop(): void {
    this.token++;
    this.phase = 'idle';
    this.syncDisabled();
  }

  /** Заранее запрашивает первый вопрос, пока идёт интро. */
  warmUp(): void {
    this.ensurePreload();
  }

  /** Ответ с клавиатуры: 1–4. */
  answerByIndex(index: number): void {
    const button = this.buttons[index];
    if (!button) return;
    button.classList.add('is-pressed');
    window.setTimeout(() => button.classList.remove('is-pressed'), 90);
    this.choose(index);
  }

  /** Принимает ли панель ответы прямо сейчас. */
  get accepting(): boolean {
    return (
      this.phase === 'asking' &&
      this.enabled &&
      !this.paused &&
      !this.frozen &&
      this.shownMs >= this.o.timings.doubleTapGuardMs
    );
  }

  get questionShown(): boolean {
    return this.phase === 'asking' || this.phase === 'feedback';
  }

  /** Продвигает время панели. Вызывается каждый кадр; на паузе не вызывается или стоит. */
  tick(dtMs: number): void {
    if (this.paused || this.frozen || this.destroyed) return;
    if (this.phase === 'asking') {
      this.shownMs += dtMs;
      if (this.enabled) this.activeMs += dtMs;
    } else if (this.phase === 'feedback') {
      this.feedbackLeft -= dtMs;
      if (this.feedbackLeft <= 0) this.showNext();
    }
  }

  /** Пересчитывает размер шрифта под новую ширину панели. */
  refit(): void {
    this.fitText();
  }

  destroy(): void {
    this.destroyed = true;
    this.token++;
    this.options.removeEventListener('click', this.onClick);
    this.el.remove();
  }

  private ensurePreload(): void {
    if (!this.preload) this.preload = this.o.provider.next();
  }

  private showNext(): void {
    const token = ++this.token;
    this.phase = 'waiting';
    this.ensurePreload();
    const pending = this.preload as Promise<Question>;
    this.preload = null;
    void pending
      .then((q) => {
        if (token !== this.token || this.destroyed) return;
        this.render(shuffleOptions(q, this.o.random));
        // Следующий вопрос грузится, пока игрок отвечает на текущий.
        this.ensurePreload();
      })
      .catch((err: unknown) => {
        console.error('QuestionPanel: не удалось получить вопрос', err);
        if (token === this.token) this.phase = 'idle';
      });
  }

  private render(q: Question): void {
    this.current = q;
    this.phase = 'asking';
    this.activeMs = 0;
    this.shownMs = 0;
    this.initial.style.visibility = '';
    this.initial.textContent = initialOf(q.prompt);
    this.text.classList.remove('is-note');
    this.text.textContent = q.prompt;
    this.text.setAttribute('lang', q.promptLang);
    this.options.setAttribute('data-count', String(q.options.length));
    this.buttons = q.options.map((option, i) => {
      const button = el('button', 'lib-opt');
      button.type = 'button';
      button.dataset.index = String(i);
      if (this.o.exposeAnswer && i === q.correctIndex) button.dataset.correct = '1';
      button.setAttribute('lang', q.optionsLang);
      button.setAttribute('aria-label', this.o.strings.optionLabel(i + 1, option));
      const key = el('span', 'lib-opt__key');
      key.textContent = String(i + 1);
      key.setAttribute('aria-hidden', 'true');
      const label = el('span', 'lib-opt__text');
      label.textContent = option;
      button.append(key, label);
      return button;
    });
    this.options.replaceChildren(...this.buttons);
    this.body.classList.remove('is-swap');
    // Перезапуск анимации появления.
    void this.body.offsetWidth;
    this.body.classList.add('is-swap');
    this.syncDisabled();
    this.fitText();
  }

  /** Если текст не помещается, шрифт ужимается с 24 до 16 px (11.2.2). */
  private fitText(): void {
    const wide = this.el.clientWidth > 380 && this.el.clientHeight > 420;
    const max = (this.o.fontMax ?? 24) + (wide ? 6 : 0);
    const min = this.o.fontMin ?? 16;
    const node = this.text;
    if (!node.isConnected) return;
    let size = max;
    node.style.setProperty('--q-font', `${size}px`);
    const box = node.parentElement;
    if (!box) return;
    const overflows = (): boolean =>
      node.scrollWidth > node.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1;
    while (size > min && overflows()) {
      size -= 1;
      node.style.setProperty('--q-font', `${size}px`);
    }
  }

  private syncDisabled(): void {
    const off = this.phase !== 'asking' || !this.enabled || this.paused || this.frozen;
    for (const b of this.buttons) {
      // aria-disabled, а не disabled: фокус остаётся на табличке между вопросами.
      b.setAttribute('aria-disabled', off ? 'true' : 'false');
      b.tabIndex = this.paused || this.frozen ? -1 : 0;
    }
  }

  private onClick = (event: Event): void => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.lib-opt');
    if (!target) return;
    const index = Number(target.dataset.index);
    if (Number.isInteger(index)) this.choose(index);
  };

  private choose(index: number): void {
    if (!this.accepting) return;
    const q = this.current;
    if (!q || index < 0 || index >= q.options.length) return;
    const correct = index === q.correctIndex;
    const timeMs = Math.round(this.activeMs);
    const t = this.o.timings;
    this.phase = 'feedback';
    const chosen = this.buttons[index];
    if (correct) {
      // Верный ответ: табличка 150 мс светится зелёным, следующий вопрос — за 150 мс (11.2.5).
      chosen?.classList.add('is-correct');
      this.feedbackLeft = t.correctFlashMs;
    } else {
      // Ошибка: табличка трясётся и краснеет, верная зеленеет; через 1000 мс — следующий (11.2.6).
      chosen?.classList.add('is-wrong');
      this.buttons[q.correctIndex]?.classList.add('is-reveal');
      this.feedbackLeft = t.wrongFeedbackMs;
    }
    this.syncDisabled();
    this.o.provider.report({ id: q.id, correct, timeMs });
    this.o.onAnswer({ id: q.id, correct, timeMs });
  }
}
