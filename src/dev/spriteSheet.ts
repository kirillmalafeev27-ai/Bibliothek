/**
 * Dev-лист текстур (`?scene=sprites`): все текстуры манифеста крупно и собранные
 * фигурки героя и библиотекаря — для доводки рецептов без запуска игры.
 */
import { setupKit } from '../art/kit';
import type { TexSpec } from '../art/manifest';
import { ALL_TEX, TEX } from '../art/manifest';
import { manuscriptProvider } from '../art/recipes/manuscript';
import { palette } from '../config/palette';
import { loadFonts } from '../shared/fonts';
import * as K from '../shared/manuscriptKit';

const PPC = 96;

function render(spec: TexSpec): HTMLCanvasElement {
  const c = K.makeCanvas(spec.w * PPC, spec.h * PPC);
  manuscriptProvider.draw(spec, K.ctx2d(c), PPC, K.mulberry32(K.hashSeed(spec.key)));
  return c;
}

/** Собирает фигурку из частей так же, как это делают виды (координаты в клетках от ступней). */
function figure(parts: [TexSpec, number, number, number, number?][], scale: number): HTMLCanvasElement {
  const W = 2.2 * PPC * scale;
  const H = 2.2 * PPC * scale;
  const c = K.makeCanvas(W, H);
  const ctx = K.ctx2d(c);
  const fx = W / 2;
  const fy = H * 0.86;
  ctx.fillStyle = palette.floor.a;
  ctx.fillRect(0, fy - PPC * scale * 0.62, W, PPC * scale);
  for (const [spec, x, y, rot, sx] of parts) {
    const img = render(spec);
    ctx.save();
    ctx.translate(fx + x * PPC * scale, fy + y * PPC * scale);
    ctx.rotate(rot);
    ctx.scale(scale * (sx ?? 1), scale);
    ctx.drawImage(img, -spec.ox * img.width, -spec.oy * img.height);
    ctx.restore();
  }
  return c;
}

export async function showSpriteSheet(root: HTMLElement): Promise<void> {
  setupKit();
  await loadFonts();
  root.style.cssText = 'overflow:auto;background:#f3e6c4;padding:12px;font:12px sans-serif;';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;';
  const add = (canvas: HTMLCanvasElement, label: string, scale = 1): void => {
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';
    canvas.style.width = `${(canvas.width * scale) / 1}px`;
    canvas.style.background = 'repeating-conic-gradient(#e6d6ae 0 25%, #efe2c0 0 50%) 0 0/16px 16px';
    const t = document.createElement('span');
    t.textContent = label;
    box.append(canvas, t);
    wrap.append(box);
  };
  add(
    figure(
      [
        [TEX.libHem, 0, -0.07, 0],
        [TEX.libSlipper, -0.13, -0.01, 0],
        [TEX.libSlipper, 0.13, -0.01, 0],
        [TEX.libRobe, 0, 0, 0],
        [TEX.libKeys, 0.15, -0.5, 0],
        [TEX.libEar, 0.0, -1.3, 0, 0.82],
        [TEX.libHead, 0.07, -0.98, 0.06],
        [TEX.libEar, -0.13, -1.22, -0.25],
        [TEX.libArm, -0.05, -0.9, 0.12],
      ],
      1.2,
    ),
    'библиотекарь',
  );
  add(
    figure(
      [
        [TEX.libHem, 0, -0.07, 0],
        [TEX.libSlipper, -0.13, -0.01, 0],
        [TEX.libSlipper, 0.13, -0.01, 0],
        [TEX.libRobe, 0, 0, 0],
        [TEX.libKeys, 0.15, -0.5, 0],
        [TEX.libEar, 0.0, -1.33, 0.25, 0.92],
        [TEX.libHeadAngry, 0.07, -0.98, -0.1],
        [TEX.libEar, -0.2, -1.25, 0.3],
        [TEX.libArm, -0.05, -0.9, 2.9],
      ],
      1.2,
    ),
    'слушает (злой)',
  );
  add(
    figure(
      [
        [TEX.heroLeg, -0.09, -0.31, 0],
        [TEX.heroLeg, 0.09, -0.31, 0],
        [TEX.heroScarf, -0.1, -0.7, -0.12, -1],
        [TEX.heroBody, 0, -0.26, 0],
        [TEX.heroHead, 0.02, -0.7, 0],
        [TEX.heroArm, -0.07, -0.66, 0.12],
      ],
      1.2,
    ),
    'герой',
  );
  add(
    figure(
      [
        [TEX.heroLeg, -0.09, -0.31, 0.5],
        [TEX.heroLeg, 0.09, -0.31, -0.5],
        [TEX.heroScarf, -0.1, -0.7, -0.4, -1],
        [TEX.heroBody, 0, -0.26, 0.1],
        [TEX.heroHeadPuff, 0.06, -0.7, 0.07],
        [TEX.heroArm, -0.03, -0.66, 2.72],
      ],
      1.2,
    ),
    'герой: тсс',
  );
  for (const spec of ALL_TEX) {
    if (spec.key.startsWith('glint') || spec.key === 'dust' || spec.key === 'ring_chip') continue;
    add(render(spec), spec.key, spec.w > 3 ? 0.5 : 1);
  }
  const ring = K.makeCanvas(PPC * 7, PPC * 7);
  manuscriptProvider.loudRing(K.ctx2d(ring), 3.3, PPC);
  add(ring, 'loud ring 3.3', 0.5);
  const shelf = K.makeCanvas(PPC * 3, PPC * 1.25);
  manuscriptProvider.shelf(K.ctx2d(shelf), 'h', 3, PPC, 5);
  add(shelf, 'shelf h3');
  const vshelf = K.makeCanvas(PPC, PPC * 3.25);
  manuscriptProvider.shelf(K.ctx2d(vshelf), 'v', 3, PPC, 6);
  add(vshelf, 'shelf v3');
  for (const w of ['Wer da?', 'Ausweis, bitte!', 'Кто там?']) add(manuscriptProvider.word(w, PPC, w === 'Кто там?'), w);
  root.append(wrap);
  (window as unknown as { __sheetReady?: boolean }).__sheetReady = true;
}
