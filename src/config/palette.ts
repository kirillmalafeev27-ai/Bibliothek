/**
 * Единственное место, где заданы цвета игры (план, 7.2).
 * Смысл цветов на поле закреплён: золото — слух, кармин — тревога,
 * ярь-медянка — то, что можно взять, оранжевый — только шарф героя.
 */
export const palette = {
  parchment: '#f3e6c4', // страница, панели
  parchmentShade: '#e2cf9f', // волокна, пятна
  parchmentEdge: '#c9ad74', // потемневший край
  ink: '#2a1d14', // железо-галловые чернила: контуры и текст
  inkFaded: '#6b5440', // второстепенные линии, орнамент
  rubric: '#b3261e', // красные рубрики интерфейса

  // поле
  floor: { a: '#d9b77e', b: '#c99d5e', grout: '#8a6a3e' }, // плитка двух тонов и шов
  squeak: { plank: '#a8784a', crack: '#2a1d14', nail: '#7c7f86' },
  shelf: { wood: '#6b3f22', woodLight: '#8a5530', top: '#4e2c17' },
  spines: ['#7a2e3a', '#2f4f6f', '#8a5a1e', '#4a3a6a', '#5e5a50'], // приглушённые корешки, только на полках
  window: { night: '#1d2f6b', star: '#f2e7a6' },
  candle: { wax: '#efe6cf', flame: '#fff3b0' },
  door: { wood: '#5e3a1f', iron: '#3b3b44', light: '#ffe9a8' },

  // смысловые цвета
  gold: { base: '#d4a72c', light: '#f6dc7a', dark: '#8f6a14' }, // на поле — только слух
  alarm: { base: '#c8102e', light: '#ff5a6e', dark: '#7a0a1c' }, // кармин — тревога
  take: { base: '#2f8f6f', light: '#6fd0aa', dark: '#1d5c47' }, // ярь-медянка — то, что можно взять

  // библиотекарь
  librarian: {
    robe: '#2340a0',
    robeDark: '#162a6e',
    trim: '#efe6cf',
    skin: '#c9c3b0',
    earInside: '#e8a0a8',
    glasses: '#1a1a22',
    keys: '#9a8a5a',
    angry: '#c8102e',
  },

  // герой — тот же искатель серии
  hero: {
    cap: '#3f6b5a',
    scarf: '#ff7a1a',
    tunic: '#e9dcc0',
    pants: '#5a4a6e',
    boots: '#5a3a26',
    skin: '#f2c094',
  },

  page: { paper: '#fbf3dc', map: '#6b4a2a', ribbon: '#2f8f6f' },
  book: { cover: '#2f8f6f', corner: '#a39470', pages: '#f6eed6' },
  good: '#3ddc84',
  bad: '#ff4d4d',

  /**
   * Производные тона (те же краски, разведённые или сгущённые): тени темперы, ночь, пар.
   * Вынесены сюда, чтобы рецепты не содержали собственных цветов.
   */
  derived: {
    /** Густые чернила линий слуха на плитке — тёмное золото (тест 8.4). */
    goldInk: '#6f4f08',
    /** Чернильный кармин колец тревоги на плитке (тест 8.4). */
    alarmInk: '#9c0c22',
    /** Ультрамарин колец брошенного словаря. */
    ultramarine: '#2340a0',
    ultramarineLight: '#6f8ae0',
    nightDeep: '#121d47',
    nightGlow: '#3a55b0',
    moon: '#f6efc8',
    stone: '#b9a98a',
    stoneDark: '#8c7a5c',
    steam: '#f7efe0',
    wax: '#efe6cf',
    flameCore: '#fffbe0',
    flameEdge: '#f6c95a',
    shadowInk: 'rgba(42, 29, 20, 0.28)',
    paperWhite: '#fffaf0',
    snail: '#b9a37a',
    hare: '#cdbb98',
    monkey: '#a88a62',
    veil: 'rgba(42, 29, 20, 0.55)',
  },

  /** Серый прототип (этап 2): геймплей сначала проверяется на серых фигурах. */
  proto: {
    paper: '#e9e9e6',
    floorA: '#cfcfcb',
    floorB: '#c2c2be',
    squeak: '#a9a9a4',
    wall: '#5a5a58',
    shelf: '#6e6e6b',
    shelfTop: '#8a8a86',
    door: '#f4f4f0',
    line: '#2b2b2a',
    librarian: '#3c3c3b',
    hero: '#fafaf7',
    item: '#ffffff',
    ring: '#1f1f1e',
    alarm: '#111110',
  },
} as const;

export type Palette = typeof palette;

/** '#rrggbb' → 0xrrggbb для Phaser. */
export function hex(color: string): number {
  return parseInt(color.slice(1), 16);
}

/** '#rrggbb' + alpha → 'rgba(r, g, b, a)' для Canvas 2D и CSS. */
export function rgba(color: string, alpha: number): string {
  const n = hex(color);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Смешение двух цветов '#rrggbb' (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  const ch = (shift: number): number => {
    const p = (x >> shift) & 255;
    const q = (y >> shift) & 255;
    return Math.round(p + (q - p) * t);
  };
  const n = (ch(16) << 16) | (ch(8) << 8) | ch(0);
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** Относительная яркость по WCAG для '#rrggbb'. */
export function luminance(color: string): number {
  const n = hex(color);
  const lin = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** Контраст по WCAG между двумя цветами. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
