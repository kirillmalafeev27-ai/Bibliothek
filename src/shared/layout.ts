/**
 * Раскладка экрана — общая для серии (план, 11.1).
 * Портрет: мир сверху, вопрос снизу. Ландшафт (ширина / высота ≥ 1.2): мир слева,
 * вопрос справа. Клетка поля — не меньше 36 CSS px везде, где это физически возможно.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type Orientation = 'portrait' | 'landscape';
export type LayoutTier = 'normal' | 'compact' | 'ultra';

export interface LayoutSpec {
  /** Клеток поля по ширине и высоте в портрете (в ландшафте меняются местами). */
  cols: number;
  rows: number;
  /** Ландшафт начинается с этого отношения ширины к высоте. */
  landscapeRatio: number;
  /** Клетка: желаемый и минимальный размер, CSS px. */
  cellWant: number;
  cellMin: number;
  /** Панель вопроса: доля и пределы, CSS px. */
  portraitShare: number;
  portraitMin: number;
  portraitMax: number;
  landscapeShare: number;
  landscapeMin: number;
  landscapeMax: number;
}

export const defaultLayoutSpec: LayoutSpec = {
  cols: 9,
  rows: 11,
  landscapeRatio: 1.2,
  cellWant: 40,
  cellMin: 36,
  portraitShare: 0.42,
  portraitMin: 300,
  portraitMax: 420,
  landscapeShare: 0.34,
  landscapeMin: 340,
  landscapeMax: 480,
};

interface TierMetrics {
  tier: LayoutTier;
  /** Просвет между панелями и до края экрана. */
  gap: number;
  /** Плашка снаряжения: высота полосы сверху и ширина колонки сбоку. */
  gearH: number;
  gearW: number;
  /** Толщина рамки миниатюры. */
  frame: number;
  /** Ниже этого панель вопроса сжимать нельзя: не поместятся таблички по 56 px. */
  questionMinPortrait: number;
  questionMinLandscape: number;
}

const TIERS: readonly TierMetrics[] = [
  {
    tier: 'normal',
    gap: 12,
    gearH: 50,
    gearW: 62,
    frame: 9,
    questionMinPortrait: 244,
    questionMinLandscape: 300,
  },
  {
    tier: 'compact',
    gap: 10,
    gearH: 42,
    gearW: 54,
    frame: 6,
    questionMinPortrait: 212,
    questionMinLandscape: 280,
  },
  {
    tier: 'ultra',
    gap: 5,
    gearH: 30,
    gearW: 44,
    frame: 3,
    questionMinPortrait: 190,
    questionMinLandscape: 250,
  },
];

export interface Layout {
  orientation: Orientation;
  tier: LayoutTier;
  width: number;
  height: number;
  gap: number;
  /** Панель вопроса и панель мира — в координатах корня. */
  question: Rect;
  world: Rect;
  /** Плашка снаряжения — в координатах панели мира. */
  gear: Rect;
  gearPlacement: 'top' | 'side';
  /** Миниатюра (поле вместе с рамкой) — в координатах панели мира. */
  field: Rect;
  /** Поле без рамки — в координатах панели мира. */
  board: Rect;
  /** Размер клетки, CSS px. */
  cell: number;
  frame: number;
  /** Клеток по ширине и высоте на экране. */
  cols: number;
  rows: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** В портрете миниатюра подходит к краю экрана ближе, чем панели: клетке нужна вся ширина. */
const PORTRAIT_WORLD_INSET = 5;

function solvePortrait(
  w: number,
  h: number,
  safe: Insets,
  spec: LayoutSpec,
  t: TierMetrics,
): Layout {
  const cols = spec.cols;
  const rows = spec.rows;
  const left = safe.left + t.gap;
  const right = safe.right + t.gap;
  const top = safe.top + t.gap;
  const bottom = safe.bottom + t.gap;
  const availW = w - left - right;
  const availH = h - top - bottom - t.gap;
  const chrome = t.gearH + 2 * t.frame;
  const inset = Math.min(t.gap, PORTRAIT_WORLD_INSET);
  const worldX = safe.left + inset;
  const worldW = w - safe.left - safe.right - 2 * inset;
  const cellByW = (worldW - 2 * t.frame) / cols;

  const qPref = clamp(h * spec.portraitShare, spec.portraitMin, spec.portraitMax);
  const want = Math.min(cellByW, spec.cellWant);
  // Сначала — панель вопроса желаемой высоты; если клетка мельче желаемой, панель уступает место.
  let q = qPref;
  if ((availH - q - chrome) / rows < want) {
    q = clamp(availH - chrome - rows * want, t.questionMinPortrait, qPref);
  }
  const worldH = availH - q;
  const cell = Math.max(8, Math.min(cellByW, (worldH - chrome) / rows));

  const world: Rect = { x: worldX, y: top, w: worldW, h: worldH };
  const question: Rect = { x: left, y: top + worldH + t.gap, w: availW, h: q };
  const boardW = cell * cols;
  const boardH = cell * rows;
  const fieldW = boardW + 2 * t.frame;
  const fieldH = boardH + 2 * t.frame;
  const fieldX = (worldW - fieldW) / 2;
  const fieldY = t.gearH + (worldH - t.gearH - fieldH) / 2;
  const field: Rect = { x: fieldX, y: fieldY, w: fieldW, h: fieldH };
  const board: Rect = { x: fieldX + t.frame, y: fieldY + t.frame, w: boardW, h: boardH };
  const gearW = Math.min(worldW, Math.max(fieldW, 300));
  const gear: Rect = { x: (worldW - gearW) / 2, y: 0, w: gearW, h: t.gearH };
  return {
    orientation: 'portrait',
    tier: t.tier,
    width: w,
    height: h,
    gap: t.gap,
    question,
    world,
    gear,
    gearPlacement: 'top',
    field,
    board,
    cell,
    frame: t.frame,
    cols,
    rows,
  };
}

function solveLandscape(
  w: number,
  h: number,
  safe: Insets,
  spec: LayoutSpec,
  t: TierMetrics,
): Layout {
  // В ландшафте библиотека повёрнута на 90°: клетки по ширине и высоте меняются местами.
  const cols = spec.rows;
  const rows = spec.cols;
  const left = safe.left + t.gap;
  const right = safe.right + t.gap;
  const top = safe.top + t.gap;
  const bottom = safe.bottom + t.gap;
  const availW = w - left - right - t.gap;
  const availH = h - top - bottom;

  const cellFor = (worldW: number): { cell: number; side: boolean } => {
    const topCell = Math.min(
      (worldW - 2 * t.frame) / cols,
      (availH - t.gearH - 2 * t.frame) / rows,
    );
    const sideCell = Math.min(
      (worldW - t.gearW - 2 * t.frame) / cols,
      (availH - 2 * t.frame) / rows,
    );
    return sideCell > topCell + 0.5
      ? { cell: sideCell, side: true }
      : { cell: topCell, side: false };
  };

  const qPref = clamp(w * spec.landscapeShare, spec.landscapeMin, spec.landscapeMax);
  let q = qPref;
  if (cellFor(availW - q).cell < spec.cellWant) {
    // Панель вопроса уступает место, пока клетка не дотянется до желаемой.
    let lo = t.questionMinLandscape;
    let hi = qPref;
    if (cellFor(availW - lo).cell < spec.cellWant) {
      q = lo;
    } else {
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (cellFor(availW - mid).cell >= spec.cellWant) lo = mid;
        else hi = mid;
      }
      q = lo;
    }
  }
  const worldW = availW - q;
  const pick = cellFor(worldW);
  const cell = Math.max(8, pick.cell);

  const world: Rect = { x: left, y: top, w: worldW, h: availH };
  const question: Rect = { x: left + worldW + t.gap, y: top, w: q, h: availH };
  const boardW = cell * cols;
  const boardH = cell * rows;
  const fieldW = boardW + 2 * t.frame;
  const fieldH = boardH + 2 * t.frame;
  let field: Rect;
  let gear: Rect;
  if (pick.side) {
    const fieldX = t.gearW + (worldW - t.gearW - fieldW) / 2;
    field = { x: fieldX, y: (availH - fieldH) / 2, w: fieldW, h: fieldH };
    const gearH = Math.min(availH, Math.max(fieldH, 240));
    gear = { x: 0, y: (availH - gearH) / 2, w: t.gearW, h: gearH };
  } else {
    const fieldY = t.gearH + (availH - t.gearH - fieldH) / 2;
    field = { x: (worldW - fieldW) / 2, y: fieldY, w: fieldW, h: fieldH };
    const gearW = Math.min(worldW, Math.max(fieldW, 300));
    gear = { x: (worldW - gearW) / 2, y: 0, w: gearW, h: t.gearH };
  }
  const board: Rect = { x: field.x + t.frame, y: field.y + t.frame, w: boardW, h: boardH };
  return {
    orientation: 'landscape',
    tier: t.tier,
    width: w,
    height: h,
    gap: t.gap,
    question,
    world,
    gear,
    gearPlacement: pick.side ? 'side' : 'top',
    field,
    board,
    cell,
    frame: t.frame,
    cols,
    rows,
  };
}

export function isLandscape(w: number, h: number, spec: LayoutSpec = defaultLayoutSpec): boolean {
  return h > 0 && w / h >= spec.landscapeRatio;
}

/**
 * Считает раскладку. Перебирает ступени от просторной к самой плотной и берёт первую,
 * на которой клетка не меньше минимальной; если не выходит нигде — самую плотную.
 */
export function computeLayout(
  width: number,
  height: number,
  safe: Insets = { top: 0, right: 0, bottom: 0, left: 0 },
  spec: LayoutSpec = defaultLayoutSpec,
): Layout {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const landscape = isLandscape(w, h, spec);
  let best: Layout | null = null;
  for (const t of TIERS) {
    const layout = landscape
      ? solveLandscape(w, h, safe, spec, t)
      : solvePortrait(w, h, safe, spec, t);
    if (!best || layout.cell > best.cell) best = layout;
    if (layout.cell >= spec.cellMin) return layout;
  }
  return best as Layout;
}

/** Читает env(safe-area-inset-*) через пробный элемент. */
export function readSafeArea(root: HTMLElement): Insets {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) ' +
    'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
  root.appendChild(probe);
  const cs = getComputedStyle(probe);
  const px = (v: string): number => parseFloat(v) || 0;
  const out: Insets = {
    top: px(cs.paddingTop),
    right: px(cs.paddingRight),
    bottom: px(cs.paddingBottom),
    left: px(cs.paddingLeft),
  };
  probe.remove();
  return out;
}

export function rectStyle(el: HTMLElement, r: Rect): void {
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.w}px`;
  el.style.height = `${r.h}px`;
}
