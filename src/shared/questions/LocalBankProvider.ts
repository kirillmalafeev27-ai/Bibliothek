/**
 * Локальный банк вопросов для разработки и автономной страницы (план, 12.1–12.3).
 * Вопрос не повторяется раньше чем через 10 показов; вопрос, на который ответили неверно,
 * возвращается в том же раунде через 4–6 вопросов.
 */
import bank from './bank.de.json';
import type { AnswerReport, Question, QuestionProvider } from './types';

export interface BankOptions {
  noRepeatWithin?: number;
  wrongReturnMin?: number;
  wrongReturnMax?: number;
  random?: () => number;
}

export class LocalBankProvider implements QuestionProvider {
  private readonly questions: Question[];
  private readonly noRepeat: number;
  private readonly retMin: number;
  private readonly retMax: number;
  private readonly random: () => number;
  /** Последние показанные id — от старых к новым. */
  private recent: string[] = [];
  /** Сколько вопросов уже выдано. */
  private served = 0;
  /** Вопросы с ошибкой: id → сколько вопросов должно быть выдано, прежде чем вернуть этот. */
  private due = new Map<string, number>();
  /** Каким по счёту вопрос был выдан в последний раз. */
  private servedAt = new Map<string, number>();
  /** Нестрогая колода: чтобы за раунд встречались разные вопросы. */
  private deck: string[] = [];

  constructor(questions: Question[] = bank as Question[], opts: BankOptions = {}) {
    if (questions.length === 0) throw new Error('LocalBankProvider: пустой банк вопросов');
    this.questions = questions;
    this.noRepeat = Math.min(opts.noRepeatWithin ?? 10, Math.max(0, questions.length - 1));
    this.retMin = opts.wrongReturnMin ?? 4;
    this.retMax = opts.wrongReturnMax ?? 6;
    this.random = opts.random ?? Math.random;
  }

  /** Новый раунд: долги по ошибкам прошлого раунда сгорают. */
  resetRound(): void {
    this.due.clear();
  }

  next(): Promise<Question> {
    const q = this.pick();
    this.served += 1;
    this.servedAt.set(q.id, this.served);
    this.recent.push(q.id);
    if (this.recent.length > this.noRepeat) this.recent.shift();
    // Копия: тот, кто показывает вопрос, вправе перемешивать варианты.
    return Promise.resolve({ ...q, options: q.options.slice() });
  }

  report(r: AnswerReport): void {
    if (r.correct) {
      this.due.delete(r.id);
      return;
    }
    // Вернётся через 4–6 других вопросов. Счёт идёт от момента его показа, поэтому
    // заранее загруженный следующий вопрос (12.4) срок не сдвигает.
    const gap = this.retMin + Math.floor(this.random() * (this.retMax - this.retMin + 1));
    this.due.set(r.id, (this.servedAt.get(r.id) ?? this.served) + gap);
  }

  private pick(): Question {
    // Сначала — вопрос с ошибкой, которому пора вернуться.
    let dueId: string | null = null;
    let dueAt = Infinity;
    for (const [id, at] of this.due) {
      if (at <= this.served && at < dueAt && !this.recent.slice(-1).includes(id)) {
        dueId = id;
        dueAt = at;
      }
    }
    if (dueId) {
      this.due.delete(dueId);
      const q = this.questions.find((x) => x.id === dueId);
      if (q) return q;
    }
    for (let guard = 0; guard < this.questions.length * 2 + 2; guard++) {
      if (this.deck.length === 0) this.refill();
      const id = this.deck.pop() as string;
      if (this.recent.includes(id)) continue;
      // Вопрос с ошибкой ждёт своей очереди и раньше срока не выдаётся.
      if (this.due.has(id)) continue;
      const q = this.questions.find((x) => x.id === id);
      if (q) return q;
    }
    // Банк слишком мал для всех ограничений — берём самый давний.
    return this.questions.find((q) => !this.recent.includes(q.id)) ?? (this.questions[0] as Question);
  }

  private refill(): void {
    const ids = this.questions.map((q) => q.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      const a = ids[i] as string;
      ids[i] = ids[j] as string;
      ids[j] = a;
    }
    this.deck = ids;
  }
}

/** Перемешивает варианты и пересчитывает correctIndex (12.2). */
export function shuffleOptions(q: Question, random: () => number = Math.random): Question {
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = order[i] as number;
    order[i] = order[j] as number;
    order[j] = a;
  }
  return {
    ...q,
    options: order.map((i) => q.options[i] as string),
    correctIndex: order.indexOf(q.correctIndex),
  };
}
