/**
 * Манифест текстур (план, 7.3.2). У каждой текстуры — строковый ключ, размер в клетках
 * и точка привязки. Чтобы заменить процедурный арт рисованным, достаточно загрузить PNG
 * под теми же ключами и с теми же пропорциями: код сцен не меняется.
 */

/** Мир строится в виртуальных единицах: 96 на клетку (13.5.1). */
export const CELL = 96;

export interface TexSpec {
  key: string;
  /** Размер в клетках. */
  w: number;
  h: number;
  /** Точка привязки спрайта, доли от размера. */
  ox: number;
  oy: number;
}

const s = (key: string, w: number, h: number, ox = 0.5, oy = 0.5): TexSpec => ({
  key,
  w,
  h,
  ox,
  oy,
});

export const TEX = {
  // ── предметы на полу и мебель ──
  page0: s('page_0', 0.66, 0.66),
  page1: s('page_1', 0.66, 0.66),
  page2: s('page_2', 0.66, 0.66),
  /** Словарь на полу. */
  book: s('book', 0.62, 0.54, 0.5, 0.56),
  /** Книга, упавшая с полки при ошибке. Декор: приглушённый корешок. */
  fallBook: s('fall_book', 0.44, 0.4),
  deskFront: s('desk_front', 1.1, 0.96, 0.5, 1),
  deskSide: s('desk_side', 0.7, 0.96, 0.5, 1),
  candle: s('candle', 0.3, 0.46, 0.5, 1),
  flame: s('flame', 0.22, 0.32, 0.5, 0.9),
  /** Створка двери: привязка — у порога, посередине. */
  doorLeaf: s('door_leaf', 0.9, 1.0, 0.5, 0),
  /** Полоска тёплого света из-под двери. */
  doorLight: s('door_light', 1.0, 0.5, 0.5, 1),

  // ── слух ──
  /** Нимб радиусом 2.25 клетки (с запасом на толщину линии). */
  halo: s('halo', 4.8, 4.8),
  manInk: s('manicule_ink', 0.92, 0.58, 0.97, 0.42),
  manGold: s('manicule_gold', 0.92, 0.58, 0.97, 0.42),
  manAlarm: s('manicule_alarm', 0.92, 0.58, 0.97, 0.42),
  slipper: s('slipper_print', 0.36, 0.34),
  footInk: s('foot_ink', 0.46, 0.42),
  footAlarm: s('foot_alarm', 0.46, 0.42),
  routeDot: s('route_dot', 0.14, 0.14),
  routeEnd: s('route_end', 0.34, 0.34),
  aimOk: s('aim_ok', 0.96, 0.96),
  aimBad: s('aim_bad', 0.96, 0.96),
  aimDot: s('aim_dot', 0.2, 0.2),
  pathInk: s('path_ink', 0.26, 0.26),
  pathAlarm: s('path_alarm', 0.26, 0.26),
  heard: s('heard_flash', 0.7, 0.7),

  // ── библиотекарь (рост около 1.6 клетки) ──
  libRobe: s('lib_robe', 0.78, 1.04, 0.5, 1),
  libHem: s('lib_hem', 0.86, 0.3, 0.5, 0.25),
  libHead: s('lib_head', 0.7, 0.64, 0.42, 0.84),
  libHeadAngry: s('lib_head_angry', 0.7, 0.64, 0.42, 0.84),
  libHeadSleep: s('lib_head_sleep', 0.7, 0.64, 0.42, 0.84),
  libEar: s('lib_ear', 0.34, 0.46, 0.2, 0.72),
  libArm: s('lib_arm', 0.28, 0.6, 0.5, 0.1),
  libKeys: s('lib_keys', 0.24, 0.36, 0.5, 0.06),
  libSlipper: s('lib_slipper', 0.32, 0.18, 0.5, 0.6),
  libStamp: s('lib_stamp', 0.26, 0.34, 0.5, 0.18),

  // ── герой (рост около 1.1 клетки) ──
  heroBody: s('hero_body', 0.54, 0.5, 0.5, 0.96),
  heroLeg: s('hero_leg', 0.22, 0.38, 0.5, 0.08),
  heroHead: s('hero_head', 0.64, 0.6, 0.5, 0.86),
  heroHeadPuff: s('hero_head_puff', 0.64, 0.6, 0.5, 0.86),
  heroArm: s('hero_arm', 0.2, 0.4, 0.5, 0.1),
  heroScarf: s('hero_scarf', 0.46, 0.24, 0.06, 0.4),
  /** Читательский билет в сцене поимки. */
  card: s('card', 0.46, 0.34),
  stampMark: s('stamp_mark', 0.9, 0.5),

  // ── эффекты ──
  steam: s('steam', 0.3, 0.3),
  dust: s('dust', 0.08, 0.08),
  inkStar: s('ink_star', 0.36, 0.36),
  zzz: s('zzz', 0.34, 0.34),
  spark: s('spark', 0.2, 0.2),
  ringChip: s('ring_chip', 0.12, 0.12),
  /** Полоса блика для золота рамки. */
  glint: s('glint', 1.6, 3.2),

  // ── маргиналии ──
  margSnail: s('marg_snail', 0.9, 0.62, 0.5, 1),
  margSnailStartled: s('marg_snail_startled', 0.9, 0.62, 0.5, 1),
  margHare: s('marg_hare', 0.8, 1.0, 0.5, 1),
  margHareStartled: s('marg_hare_startled', 0.8, 1.0, 0.5, 1),
  margMonkey: s('marg_monkey', 0.8, 0.9, 0.5, 1),
  margMonkeyStartled: s('marg_monkey_startled', 0.8, 0.9, 0.5, 1),
} as const;

export type TexName = keyof typeof TEX;

export const ALL_TEX: readonly TexSpec[] = Object.values(TEX);

/** Кольцо громкого слуха своего радиуса для каждого уровня. */
export function loudRingKey(radius: number): string {
  return `loud_ring_${Math.round(radius * 100)}`;
}

/** Ряд стеллажей: направление, длина в клетках и номер варианта. */
export function shelfKey(dir: 'h' | 'v', len: number, variant: number): string {
  return `shelf_${dir}_${len}_${variant}`;
}

/** Высота стеллажа над полом и нависание верхней грани над клеткой позади, в клетках (2.1.7). */
export const SHELF = {
  /** Лицевая грань с корешками. */
  front: 0.5,
  /** Насколько верхняя грань заходит на клетку позади. */
  overhang: 0.25,
} as const;

/** Где внутри клетки стоят персонажи и лежат предметы (доля высоты клетки от её верха). */
export const ANCHOR = {
  feet: 0.62,
  item: 0.5,
} as const;

/** Слои и глубина (7.6). Внутри слоя объекты сортируются по y основания. */
export const DEPTH = {
  margins: 0,
  floor: 1000,
  onFloor: 2000,
  objects: 3000,
  effects: 6000,
  top: 7000,
} as const;
