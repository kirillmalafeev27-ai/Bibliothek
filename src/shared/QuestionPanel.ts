/**
 * Панель вопроса — общая для серии (план, 11.2, раздел 12, 2.7).
 * DOM-компонент: шапка-рубрика, задание с инициалом, 2–4 таблички вариантов.
 * Своих таймеров не заводит: время идёт только через tick(), поэтому на паузе
 * стоит всё, включая показ ошибки.
 *
 * Задания ИИ-генератора (формат Morskoy, docs/GENERATION.md) приходят с инструкцией по-русски,
 * немецким материалом и четырьмя вариантами, часто — целыми предложениями. Такие варианты стоят
 * столбиком во всю ширину с текстом по левому краю: четыре предложения, которые отличаются одной
 * деталью, так легко сравнить. Шрифт инструкции, материала и вариантов подбирается вместе, пока
 * всё не встанет в панель (fitSheet); на крошечном экране лист в крайнем случае прокручивается.
 */
import { shuffleOptions } from './questions/LocalBankProvider';
import type { Question, QuestionProvider } from './questions/types';

export interface QuestionPanelStrings {
  panelLabel: string;
  promptLabel: string;
  getReady: string;
  optionLabel: (n: number, text: string) => string;
  /** Подпись, пока генерация готовит задание. */
  preparing: string;
  /** Кнопка повтора фразы в аудировании. */
  listen: string;
}

export interface QuestionPanelTimings {
  /** Сколько верная табличка светится зелёным. */
  correctFlashMs: number;
  /** За сколько появляется следующий вопрос. */
  swapMs: number;
  /** Сколько показывается верный вариант после ошибки. */
  wrongFeedbackMs: number;
  /** То же для задания генератора: целое предложение нужно успеть прочитать. */
  wrongFeedbackGeneratedMs: number;
  /** Защита от двойного тапа: столько после появления вопроса клики игнорируются. */
  doubleTapGuardMs: number;
}

export interface AnswerInfo {
  id: string;
  correct: boolean;
  /** Время от момента, когда вопрос стал активным, до клика. */
  timeMs: number;
  /** Задание генератора (с инструкцией) или вопрос банка — темп у них свой. */
  generated: boolean;
}

/** Озвучка фразы аудирования (shared/questions/speech.ts). */
export interface PanelSpeaker {
  speak(text: string): void;
  stop(): void;
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

/** Шрифт вариантов в заданиях генератора: с какого начинаем и ниже какого не ужимаем. */
const SHEET_FONT_MAX_PX = 20;
const SHEET_FONT_MIN_PX = 12;
/** С этого размера раскладка задания уплотняется, прежде чем ужимать шрифт дальше. */
const DENSE_FROM_PX = 14;

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

/**
 * Варианты-предложения — столбиком. Порог по числу слов: в банке нет вариантов длиннее двух
 * слов, поэтому его вопросы остаются в сетке, как в плане (11.2.4).
 */
export function isLongOptions(options: readonly string[]): boolean {
  return options.some((o) => {
    const words = o.trim().split(/\s+/).length;
    return words >= 4 || (words >= 3 && o.replace(/­/g, '').length > 24);
  });
}

/**
 * Строки задания: переносы из задания сохраняются, а мини-диалог «— Реплика? — Ответ.» в одну
 * строку тоже делится — каждая реплика с новой строки.
 */
export function promptLines(text: string): string[] {
  return text
    .split('\n')
    .flatMap((line) => {
      const t = line.trim();
      const dash = /^([—–-])\s/.exec(t)?.[1];
      return dash ? t.split(new RegExp(`\\s+(?=${dash}\\s)`)) : [t];
    })
    .map((s) => s.trim())
    .filter(Boolean);
}

export class QuestionPanel {
  readonly el: HTMLElement;
  private readonly headMain: HTMLElement;
  private readonly headQuiet: HTMLElement;
  private readonly body: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly initial: HTMLElement;
  private readonly text: HTMLElement;
  private readonly instruction: HTMLElement;
  private readonly material: HTMLElement;
  private readonly listenBtn: HTMLButtonElement;
  private readonly options: HTMLElement;
  private buttons: HTMLButtonElement[] = [];

  private readonly o: QuestionPanelOptions;
  private phase: Phase = 'idle';
  private current: Question | null = null;
  private preload: Promise<Question> | null = null;
  /** Заранее загруженный вопрос уже пришёл (для peekKind и ожидания первого вопроса). */
  private preloaded: Question | null = null;
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
  private speaker: PanelSpeaker | null = null;
  private autoSpeak: () => boolean = () => true;
  /** Фраза аудирования текущего вопроса уже прозвучала сама. */
  private spoken = false;

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
    this.prompt = el('div', 'lib-q-prompt');
    this.initial = el('div', 'lib-q-initial');
    this.initial.setAttribute('aria-hidden', 'true');
    this.text = el('div', 'lib-q-text');
    this.text.setAttribute('aria-label', options.strings.promptLabel);
    this.instruction = el('div', 'lib-q-instruction');
    this.instruction.setAttribute('lang', 'ru');
    this.instruction.hidden = true;
    this.material = el('div', 'lib-q-material');
    this.listenBtn = el('button', 'lib-q-listen');
    this.listenBtn.type = 'button';
    this.listenBtn.hidden = true;
    const icon = el('span', 'lib-q-listen__icon');
    icon.setAttribute('aria-hidden', 'true');
    const label = el('span', 'lib-q-listen__text');
    label.textContent = options.strings.listen;
    this.listenBtn.append(icon, label);
    this.listenBtn.addEventListener('click', this.onListen);
    this.text.append(this.instruction, this.material, this.listenBtn);
    this.prompt.append(this.initial, this.text);
    this.options = el('div', 'lib-q-options');
    this.body.append(this.prompt, this.options);

    this.el.append(head, this.body);
    this.options.addEventListener('click', this.onClick);
    this.body.addEventListener('scroll', this.markScrollEnd, { passive: true });
  }

  /** Шапка: что сделает верный ответ; вторая строка — «Тихо: ошибку услышит». */
  setHeader(main: string, quiet: string | null): void {
    if (this.headMain.textContent !== main) this.headMain.textContent = main;
    const on = quiet !== null;
    if (on && this.headQuiet.textContent !== quiet) this.headQuiet.textContent = quiet;
    this.headQuiet.classList.toggle('is-on', on);
    this.headQuiet.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  /** Озвучка аудирования: фраза звучит сама, когда вопрос становится активным, если auto(). */
  setSpeaker(speaker: PanelSpeaker | null, auto: () => boolean): void {
    this.speaker?.stop();
    this.speaker = speaker;
    this.autoSpeak = auto;
  }

  /** Готовое действие: таблички бледнеют и неактивны (11.2.7). */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.options.classList.toggle('is-dim', !enabled);
    this.syncDisabled();
    this.maybeSpeak();
  }

  /** На паузе содержимое размыто и время стоит (2.7.2). */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.el.classList.toggle('is-paused', paused);
    if (paused) this.speaker?.stop();
    this.syncDisabled();
    this.maybeSpeak();
  }

  /** Сцена поимки: мир стоит — вопрос тоже не читается. */
  setFrozen(frozen: boolean): void {
    if (this.frozen === frozen) return;
    this.frozen = frozen;
    this.el.classList.toggle('is-frozen', frozen);
    if (frozen) this.speaker?.stop();
    this.syncDisabled();
    this.maybeSpeak();
  }

  /** Вместо вопроса — надпись (во время интро: «Приготовься…»). */
  showNote(text: string, waiting = false): void {
    this.token++;
    this.phase = 'note';
    this.current = null;
    this.renderNote(text, waiting);
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
    this.speaker?.stop();
    this.syncDisabled();
  }

  /** Заранее запрашивает первый вопрос, пока идёт интро. */
  warmUp(): void {
    this.ensurePreload();
  }

  /** Источник сменил темы: заранее загруженный вопрос больше не годится. */
  reload(): void {
    this.token++;
    this.preload = null;
    this.preloaded = null;
    if (this.phase === 'asking' || this.phase === 'feedback' || this.phase === 'waiting')
      this.phase = 'idle';
  }

  /** Следующий вопрос уже загружен: его можно показать без ожидания. */
  hasQuestion(): boolean {
    return this.preloaded !== null || this.phase === 'asking' || this.phase === 'feedback';
  }

  /** Промис — когда заранее загруженный вопрос придёт (сразу, если уже пришёл). */
  whenReady(): Promise<void> {
    this.ensurePreload();
    return (this.preload as Promise<Question>).then(
      () => undefined,
      () => undefined,
    );
  }

  /** Панель ждёт вопрос от источника: раунд в это время стоит (12.4). */
  get waiting(): boolean {
    return this.phase === 'waiting';
  }

  /**
   * Какой вопрос сейчас перед игроком или следующий на очереди: задание генератора (формат
   * Morskoy, с инструкцией) или вопрос банка. null — ещё не загружен. Темп раунда берётся по
   * этому виду (src/app/pacing.ts).
   */
  peekKind(): 'generated' | 'bank' | null {
    const q = this.current ?? this.preloaded;
    if (!q) return null;
    return q.instruction ? 'generated' : 'bank';
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

  /** Показать конкретный вопрос (только для e2e: раскладка заданий генератора). */
  debugShow(q: Question): void {
    this.token++;
    this.render(q);
  }

  destroy(): void {
    this.destroyed = true;
    this.token++;
    this.speaker?.stop();
    this.options.removeEventListener('click', this.onClick);
    this.listenBtn.removeEventListener('click', this.onListen);
    this.body.removeEventListener('scroll', this.markScrollEnd);
    this.el.remove();
  }

  private ensurePreload(): void {
    if (this.preload) return;
    const p = this.o.provider.next();
    this.preload = p;
    this.preloaded = null;
    p.then(
      (q) => {
        if (this.preload === p) this.preloaded = q;
      },
      () => undefined,
    );
  }

  private showNext(): void {
    const token = ++this.token;
    this.phase = 'waiting';
    this.ensurePreload();
    // Генерация ещё не прислала задание: на табличке — «Готовлю вопросы…», а не прошлый вопрос.
    if (!this.preloaded) this.renderNote(this.o.strings.preparing, true);
    const pending = this.preload as Promise<Question>;
    this.preload = null;
    this.preloaded = null;
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

  private renderNote(text: string, waiting: boolean): void {
    this.speaker?.stop();
    this.el.classList.remove('is-task');
    this.body.classList.remove('is-scroll', 'is-dense', 'is-scroll-end');
    this.initial.textContent = '';
    this.initial.style.visibility = 'hidden';
    this.instruction.hidden = true;
    this.listenBtn.hidden = true;
    this.material.hidden = false;
    this.material.classList.remove('is-dialog');
    this.material.textContent = text;
    this.material.setAttribute('lang', 'ru');
    this.text.classList.add('is-note');
    this.text.classList.toggle('is-waiting', waiting);
    this.text.style.removeProperty('--q-font');
    this.options.replaceChildren();
    this.options.className = 'lib-q-options';
    this.buttons = [];
  }

  private render(q: Question): void {
    this.current = q;
    this.phase = 'asking';
    this.activeMs = 0;
    this.shownMs = 0;
    this.speaker?.stop();
    this.spoken = false;
    // Задания генератора — с инструкцией; их раскладка подбирается целиком (fitSheet).
    const task = !!q.instruction;
    const audio = !!q.audioText;
    this.el.classList.toggle('is-task', task);
    this.body.classList.remove('is-scroll', 'is-dense', 'is-scroll-end');
    this.body.scrollTop = 0;
    this.initial.style.visibility = '';
    this.initial.textContent = task ? '' : initialOf(q.prompt);
    this.text.classList.remove('is-note', 'is-waiting');
    this.instruction.textContent = q.instruction ?? '';
    this.instruction.hidden = !task;
    // Текст — только textContent: задания приходят от модели и не должны стать разметкой.
    const lines = task ? promptLines(q.prompt) : [q.prompt];
    this.material.classList.toggle('is-dialog', lines.length > 1);
    this.material.replaceChildren(
      ...lines.map((line) => {
        const s = el('span', 'lib-q-line');
        s.textContent = line;
        return s;
      }),
    );
    this.material.setAttribute('lang', q.promptLang);
    // В аудировании немецкой фразы на экране нет: она звучит, а кнопка её повторяет.
    this.material.hidden = audio;
    this.listenBtn.hidden = !audio;
    this.listenBtn.setAttribute('aria-label', this.o.strings.listen);
    this.options.className = `lib-q-options${task ? (isLongOptions(q.options) ? ' is-column' : ' is-grid') : ''}`;
    this.options.setAttribute('data-count', String(q.options.length));
    // Три коротких варианта (der, die, das) — в один ряд.
    this.options.dataset.compact = String(
      !task && q.options.length === 3 && q.options.every((o) => o.length <= 12),
    );
    this.options.classList.toggle('is-dim', !this.enabled);
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
    this.maybeSpeak();
  }

  /**
   * Если текст не помещается, шрифт ужимается с 24 до 16 px (11.2.2). Если и тогда
   * не помещаются таблички с длинными составными словами — ужимаются и они.
   * Задание генератора подбирается целиком (fitSheet).
   */
  private fitText(): void {
    if (this.el.classList.contains('is-task')) {
      this.fitSheet();
      return;
    }
    this.instruction.style.removeProperty('font-size');
    // На просторной панели (планшет, ландшафт) задание крупнее.
    const wide = this.el.clientWidth > 380 && this.el.clientHeight >= 380;
    const max = (this.o.fontMax ?? 24) + (wide ? 8 : 0);
    const min = this.o.fontMin ?? 16;
    const node = this.text;
    if (!node.isConnected) return;
    const box = this.prompt;
    let size = max;
    node.style.setProperty('--q-font', `${size}px`);
    this.options.style.removeProperty('--q-opt-font');
    const promptOverflows = (): boolean =>
      node.scrollWidth > node.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1;
    while (size > min && promptOverflows()) {
      size -= 1;
      node.style.setProperty('--q-font', `${size}px`);
    }
    // Таблички: помещаются ли все в панель.
    const panelOverflows = (): boolean => {
      const panel = this.el.getBoundingClientRect();
      for (const b of this.buttons) {
        const r = b.getBoundingClientRect();
        if (r.bottom > panel.bottom - 2 || b.scrollWidth > b.clientWidth + 1) return true;
      }
      return this.body.scrollHeight > this.body.clientHeight + 1;
    };
    const base =
      parseFloat(
        getComputedStyle(this.options.querySelector('.lib-opt') ?? this.options).fontSize,
      ) || 19;
    let opt = base;
    while (opt > 12 && panelOverflows()) {
      opt -= 1;
      this.options.style.setProperty('--q-opt-font', `${opt}px`);
    }
    while (size > 13 && panelOverflows()) {
      size -= 1;
      node.style.setProperty('--q-font', `${size}px`);
    }
  }

  /**
   * Задание генератора: один шаг шрифта на всё сразу (инструкция, материал, варианты), сверху
   * вниз, пока лист не перестанет переполняться. С DENSE_FROM_PX поля и межстрочные интервалы
   * становятся плотнее — сначала они, потом ещё меньший шрифт. Если не встало и на минимуме —
   * лист прокручивается: лучше прокрутка, чем обрезанное предложение.
   */
  private fitSheet(): void {
    if (!this.el.isConnected) return;
    const texts = Array.from(this.options.querySelectorAll<HTMLElement>('.lib-opt__text'));
    const wide = this.el.clientWidth > 420 && this.el.clientHeight >= 420;
    const promptMax = (this.o.fontMax ?? 24) + (wide ? 4 : 0);
    const apply = (s: number, dense: boolean): void => {
      this.body.classList.toggle('is-dense', dense);
      this.text.style.setProperty('--q-font', `${Math.min(promptMax, s + 2)}px`);
      this.instruction.style.fontSize = `${Math.max(11, Math.min(15, s - 4))}px`;
      this.options.style.setProperty('--q-opt-font', `${s}px`);
    };
    const over = (e: HTMLElement): boolean =>
      e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1;
    const overflows = (): boolean =>
      over(this.body) || over(this.text) || texts.some((t) => t.scrollWidth > t.clientWidth + 1);
    this.body.classList.remove('is-scroll');
    let s = SHEET_FONT_MAX_PX + (wide ? 2 : 0);
    let dense = false;
    apply(s, dense);
    while (overflows()) {
      if (!dense && s <= DENSE_FROM_PX) dense = true;
      else if (s > SHEET_FONT_MIN_PX) s--;
      else break;
      apply(s, dense);
    }
    if (overflows()) this.body.classList.add('is-scroll');
    this.markScrollEnd();
  }

  private markScrollEnd = (): void => {
    const b = this.body;
    b.classList.toggle('is-scroll-end', b.scrollTop + b.clientHeight >= b.scrollHeight - 2);
  };

  /** Фраза аудирования звучит один раз сама, как только вопрос стал активным. */
  private maybeSpeak(): void {
    const q = this.current;
    if (!q?.audioText || this.spoken || this.phase !== 'asking') return;
    if (!this.enabled || this.paused || this.frozen || !this.autoSpeak()) return;
    this.spoken = true;
    this.speaker?.speak(q.audioText);
  }

  /** Кнопка «Слушать»: повторить фразу. На паузе вопрос спрятан — и звука нет. */
  private onListen = (): void => {
    const q = this.current;
    if (!q?.audioText || this.paused || this.frozen) return;
    if (this.phase !== 'asking' && this.phase !== 'feedback') return;
    this.spoken = true;
    this.speaker?.speak(q.audioText);
  };

  private syncDisabled(): void {
    const off = this.phase !== 'asking' || !this.enabled || this.paused || this.frozen;
    for (const b of this.buttons) {
      // aria-disabled, а не disabled: фокус остаётся на табличке между вопросами.
      b.setAttribute('aria-disabled', off ? 'true' : 'false');
      b.tabIndex = this.paused || this.frozen ? -1 : 0;
    }
    this.listenBtn.disabled = this.paused || this.frozen;
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
    const generated = !!q.instruction;
    this.phase = 'feedback';
    const chosen = this.buttons[index];
    if (correct) {
      // Верный ответ: табличка 150 мс светится зелёным, следующий вопрос — за 150 мс (11.2.5).
      chosen?.classList.add('is-correct');
      this.feedbackLeft = t.correctFlashMs;
    } else {
      // Ошибка: табличка трясётся и краснеет, верная зеленеет; через 1000 мс — следующий (11.2.6).
      // У задания генератора — дольше: верное предложение нужно успеть прочитать.
      chosen?.classList.add('is-wrong');
      this.buttons[q.correctIndex]?.classList.add('is-reveal');
      this.feedbackLeft = generated ? t.wrongFeedbackGeneratedMs : t.wrongFeedbackMs;
    }
    this.syncDisabled();
    this.o.provider.report({ id: q.id, correct, timeMs });
    this.o.onAnswer({ id: q.id, correct, timeMs, generated });
  }
}
