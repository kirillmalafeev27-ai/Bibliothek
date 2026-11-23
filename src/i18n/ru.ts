import { pluralRu } from '../shared/i18n/plural';

/**
 * Все строки интерфейса (план, 11.7.1). В коде строк нет.
 * Текст набирается в обычном регистре.
 */
export const ru = {
  title: 'Слепой библиотекарь',
  subtitle: 'Der blinde Bibliothekar',
  seriesNote: 'Пятая игра серии',

  // Панель вопроса (11.2)
  panelLabel: 'Вопрос по немецкому',
  headerStep: 'Ответ — шаг',
  headerThrow: 'Ответ — бросить словарь',
  headerIdle: 'Ответ — про запас',
  headerReady: 'Готов! Выбери, что делать',
  headerQuiet: 'Тихо: ошибку услышит',
  getReady: 'Приготовься…',
  preparing: 'Готовлю вопросы…',
  listen: 'Слушать',
  optionLabel: (n: number, text: string): string => `Вариант ${n}: ${text}`,
  keyHint: (n: number): string => `${n}`,
  promptLabel: 'Задание',

  // Плашка снаряжения (11.3)
  gearLabel: 'Снаряжение',
  gearMap: 'Карта',
  gearMapCount: (n: number): string => `Листов карты: ${n} из 3`,
  gearBooks: 'Словари',
  gearBooksCount: (n: number): string => `Словарей в руках: ${n}`,
  gearCards: 'Билеты',
  gearCardsCount: (n: number): string => `Читательских билетов: ${n}`,
  cardVoid: 'Ungültig',
  btnThrow: 'Бросить',
  btnThrowCancel: 'Отмена',
  btnStay: 'Стоять',
  btnPause: 'Пауза',
  btnThrowHint: 'Бросить словарь (T)',
  btnStayHint: 'Стоять (пробел)',
  btnPauseHint: 'Пауза (P)',

  // Подсказки над героем
  hintListening: 'Psst! Он слушает',
  hintBlocked: 'Там библиотекарь',
  hintNeedPages: 'Сначала собери три листа',
  hintNoBooks: 'Словарей нет',
  hintTooFar: 'Слишком далеко',
  hintAim: 'Куда бросить?',
  hintAimKeys: 'Стрелки — прицел, Enter — бросить, Esc — отмена',

  // Меню (11.5.1)
  play: 'Играть',
  levels: 'Уровни',
  settings: 'Настройки',
  back: 'Назад',
  close: 'Закрыть',
  menuLead: 'Он слеп, но слышит всё.',
  menuHow: 'Отвечай верно — и шагай тихо. Ошибёшься — с полки упадёт книга.',
  menuQuiz: 'Вопросы',

  // Выбор тем вопросов (движок Morskoy, docs/GENERATION.md)
  quiz: {
    title: 'Вопросы',
    summaryBank: 'Вопросы: встроенный набор',
    summary: (level: string, topics: readonly string[], lexical: string | null): string =>
      `Вопросы: ${level} · ${topics.slice(0, 2).join(', ')}${
        topics.length > 2 ? ` и ещё ${topics.length - 2}` : ''
      }${lexical ? ` · ${lexical}` : ''}`,
    listeningOnly: 'аудирование',
    intro:
      'Задания сочиняет ИИ: целые предложения, девять форматов — от выбора варианта до исправления ошибки. Темы чередуются.',
    level: 'Уровень немецкого',
    levels: {
      A1: 'начальный',
      A2: 'элементарный',
      B1: 'средний',
      B2: 'выше среднего',
      C1: 'продвинутый',
    } as Record<string, string>,
    lexical: 'Лексическая тема',
    lexicalAny: 'Любая',
    lexicalBase: 'Повседневные',
    lexicalExtra: 'Ещё темы: библиотека, книги, сказки, средневековье и не только',
    lexicalNote: 'Слова заданий — из этой темы; грамматика от неё не зависит.',
    topics: (n: number, max: number): string => `Темы — выбрано ${n} из ${max}`,
    groups: {
      vocab: 'Свои наборы слов',
      verbs: 'Глаголы',
      nouns: 'Существительные, артикли, местоимения',
      adjectives: 'Прилагательные',
      prepositions: 'Предлоги',
      syntax: 'Порядок слов и отрицание',
      clauses: 'Придаточные',
      advanced: 'Продвинутое',
    } as Record<string, string>,
    vocabNote:
      'Только слова из списка — по смыслу и с предлогами. Задания составлены заранее: уровень и лексическая тема на них не влияют.',
    wortstellung: 'Порядок слов (Wortstellung)',
    wortstellungHint: (topic: string | null): string =>
      topic
        ? `Задания на порядок слов на материале темы «${topic}»`
        : 'Сначала выбери грамматическую тему',
    listening: 'Аудирование',
    listeningHint: 'Немецкая фраза звучит вслух — выбери точный перевод',
    needTopic: 'Выбери хотя бы одну тему или аудирование',
    checking: 'Проверяю сервер генерации…',
    noKey:
      'На сервере не задан ключ генерации (AITUNNEL_API_KEY) — пока будут вопросы из встроенного набора. Свои наборы слов работают и без ключа.',
    noServer: 'Сервер генерации недоступен — пока будут вопросы из встроенного набора.',
    done: 'Готово',
    bank: 'Встроенный набор',
    cancel: 'Отмена',
  },

  // Выбор уровня (11.5.2)
  chooseLevel: 'Выбор ночи',
  levelName: (id: number): string => (id === 7 ? 'Ночь без конца' : `Ночь ${roman(id)}`),
  levelShort: (id: number): string => (id === 7 ? '∞' : roman(id)),
  levelLocked: 'Закрыто: пройди предыдущую ночь',
  levelTraits: {
    librarians: (n: number): string => (n === 1 ? 'один библиотекарь' : 'двое библиотекарей'),
    cards: (n: number): string => (n === 1 ? 'один билет' : `${n} билета`),
    squeaks: (n: number): string => (n === 0 ? 'пол не скрипит' : `скрипучих половиц: ${n}`),
    hints: {
      all: 'все подсказки',
      ringStepCircle: 'кольцо, след и круг броска',
      step: 'только красный след',
      none: 'без подсказок',
    },
  },
  bestStars: (n: number): string => `Лучший результат: ${n} из 3 звёзд`,
  notPlayed: 'Ещё не пройдено',

  // Интро (11.5.3)
  intro: 'Он слеп, но слышит всё. Собери три листа карты',
  introSkip: 'Нажми, чтобы начать',

  // Пауза (11.5.4)
  paused: 'Пауза',
  pausedNote: 'Библиотекарь и часы стоят',
  resume: 'Продолжить',
  restart: 'Начать заново',
  toMenu: 'В меню',

  // Итоги (11.5.5)
  resultWon: 'Карта у тебя!',
  resultWonClose: 'Еле успел!',
  resultLost: 'Выставили за дверь',
  resultCardSnapshot: 'Как это было',
  resultCardMap: 'Карта и билеты',
  resultCardStats: 'Итог ночи',
  resultCardsLeft: (n: number): string =>
    n === 0 ? 'Билетов не осталось' : n === 1 ? 'Остался один билет' : `Осталось билетов: ${n}`,
  resultMapDone: 'Все три листа собраны',
  resultMapPart: (n: number): string => `Листов собрано: ${n} из 3`,
  starLabels: ['Вышел с картой', 'Ни разу не пойман', 'Ни разу не услышан'],
  statCorrect: 'Верных ответов',
  statWrong: 'Ошибок',
  statHeard: 'Тебя услышали',
  statThrows: 'Брошено словарей',
  statMedian: 'Медиана ответа',
  statTime: 'Время',
  statBest: 'Рекорд',
  statBestNew: 'Новый рекорд!',
  times: (n: number): string => `${n} ${pluralRu(n, 'раз', 'раза', 'раз')}`,
  seconds: (n: number): string => `${n.toFixed(1)} с`,
  again: 'Ещё раз',
  next: 'Дальше',
  skip: 'Пропустить',
  starsOf: (n: number): string => `${n} из 3 звёзд`,

  // Настройки (11.5.6)
  setSound: 'Звук',
  setSoundOn: 'Звук включён',
  setSfx: 'Эффекты',
  setAmbient: 'Эмбиент',
  setMotion: 'Меньше движения',
  setMotionNote: 'Без тряски, зума, блика золота и пульсаций',
  setQuality: 'Качество графики',
  setQualityHigh: 'Высокое',
  setQualityLow: 'Низкое',
  setQualityAuto: 'Игра сама снизила качество: кадры проседали',
  setHints: 'Подсказки',
  setHintsNote: 'В пределах того, что разрешает ночь',
  setHintPath: 'Отпечатки тапочек',
  setHintRing: 'Кольцо громкого слуха',
  setHintStep: 'Красный след',
  setHintCircle: 'Круг броска',
  setHintCautious: 'Осторожный шаг',
  setSfxLang: 'Язык слов-звуков',
  setSfxLangDe: 'Deutsch',
  setSfxLangRu: 'Русский',
  setResetTutorial: 'Показать обучение снова',
  setResetDone: 'Обучение начнётся заново',

  // Обучение (11.5.7)
  tutMove: 'Нажми на клетку — пойду туда. Каждый верный ответ — тихий шаг',
  tutListen: 'Он слушает! В золотой круг не наступай',
  tutEarshot: 'Он близко — ошибку услышит. Не торопись с ответом, можно и подождать',
  tutThrow: 'Брось словарь — он побежит на звук',
  tutCaught: 'Он отобрал билет! Отдашь все — выставят за дверь',
  tutOk: 'Понятно',

  // Загрузка (11.5.8)
  loading: 'Lädt…',
  loadingNote: 'Перо скрипит, краска сохнет',

  // Отладка (13.7)
  debugTitle: 'Отладка',
} as const;

function roman(n: number): string {
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI'][n] ?? String(n);
}

export type Strings = typeof ru;
