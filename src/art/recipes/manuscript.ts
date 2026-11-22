/**
 * Рукописный набор рисунков (план, раздел 7): пергамент, чернила, темпера, сусальное
 * золото. Здесь — диспетчер: какая текстура манифеста каким рецептом рисуется.
 */
import { balance } from '../../config/balance';
import { palette } from '../../config/palette';
import type { RoomView } from '../../render/room';
import { FONT } from '../../shared/fonts';
import * as K from '../../shared/manuscriptKit';
import type { ArtProvider } from '../ArtFactory';
import type { TexSpec } from '../manifest';
import { TEX } from '../manifest';
import { drawShelf } from './bookcase';
import * as Hr from './hearing';
import * as He from './hero';
import * as Lb from './librarian';
import * as M from './margins';
import * as P from './props';
import { drawRoom } from './room';

type Recipe = (ctx: CanvasRenderingContext2D, rng: K.Rand, ppc: number) => void;

const recipes: Record<string, Recipe> = {
  [TEX.page0.key]: (c, r, p) => P.drawPage(c, r, p, 0),
  [TEX.page1.key]: (c, r, p) => P.drawPage(c, r, p, 1),
  [TEX.page2.key]: (c, r, p) => P.drawPage(c, r, p, 2),
  [TEX.book.key]: P.drawFloorBook,
  [TEX.fallBook.key]: P.drawFallBook,
  [TEX.deskFront.key]: P.drawDeskFront,
  [TEX.deskSide.key]: P.drawDeskSide,
  [TEX.candle.key]: P.drawCandle,
  [TEX.flame.key]: P.drawFlame,
  [TEX.doorLeaf.key]: P.drawDoorLeaf,
  [TEX.doorLight.key]: (c, _r, p) => P.drawDoorLight(c, p),
  [TEX.card.key]: P.drawCard,
  [TEX.stampMark.key]: P.drawStampMark,

  [TEX.halo.key]: (c, r, p) => Hr.drawHalo(c, r, p, TEX.halo.w, balance.hearR),
  [TEX.manInk.key]: (c, _r, p) => Hr.drawManicule(c, p, 'ink'),
  [TEX.manGold.key]: (c, _r, p) => Hr.drawManicule(c, p, 'gold'),
  [TEX.manAlarm.key]: (c, _r, p) => Hr.drawManicule(c, p, 'alarm'),
  [TEX.slipper.key]: Hr.drawSlipperPrint,
  [TEX.footInk.key]: (c, r, p) => Hr.drawFootPrint(c, r, p, false),
  [TEX.footAlarm.key]: (c, r, p) => Hr.drawFootPrint(c, r, p, true),
  [TEX.routeDot.key]: (c, _r, p) => Hr.drawRouteDot(c, p),
  [TEX.routeEnd.key]: Hr.drawRouteEnd,
  [TEX.aimOk.key]: (c, r, p) => Hr.drawAim(c, r, p, true),
  [TEX.aimBad.key]: (c, r, p) => Hr.drawAim(c, r, p, false),
  [TEX.aimDot.key]: (c, _r, p) => Hr.drawAimDot(c, p),
  [TEX.pathInk.key]: (c, _r, p) => Hr.drawPathMark(c, p, false),
  [TEX.pathAlarm.key]: (c, _r, p) => Hr.drawPathMark(c, p, true),
  [TEX.heard.key]: (c, _r, p) => Hr.drawHeardFlash(c, p),

  [TEX.libRobe.key]: Lb.drawRobe,
  [TEX.libHem.key]: Lb.drawHem,
  [TEX.libHead.key]: (c, r, p) => Lb.drawLibHead(c, r, p, 'calm'),
  [TEX.libHeadAngry.key]: (c, r, p) => Lb.drawLibHead(c, r, p, 'angry'),
  [TEX.libHeadSleep.key]: (c, r, p) => Lb.drawLibHead(c, r, p, 'sleep'),
  [TEX.libEar.key]: Lb.drawLibEar,
  [TEX.libArm.key]: Lb.drawLibArm,
  [TEX.libKeys.key]: Lb.drawKeys,
  [TEX.libSlipper.key]: Lb.drawLibSlipper,
  [TEX.libStamp.key]: Lb.drawLibStamp,

  [TEX.heroBody.key]: He.drawHeroBody,
  [TEX.heroLeg.key]: He.drawHeroLeg,
  [TEX.heroHead.key]: (c, r, p) => He.drawHeroHead(c, r, p, false),
  [TEX.heroHeadPuff.key]: (c, r, p) => He.drawHeroHead(c, r, p, true),
  [TEX.heroArm.key]: He.drawHeroArm,
  [TEX.heroScarf.key]: He.drawHeroScarf,

  [TEX.steam.key]: M.drawSteam,
  [TEX.dust.key]: (c, _r, p) => M.drawDust(c, p),
  [TEX.inkStar.key]: M.drawInkStar,
  [TEX.zzz.key]: (c, _r, p) => M.drawZzz(c, p),
  [TEX.spark.key]: M.drawSpark,
  [TEX.ringChip.key]: (c, _r, p) => M.drawDust(c, p),
  [TEX.glint.key]: (c, _r, p) => M.drawGlint(c, p),

  [TEX.margSnail.key]: (c, r, p) => M.drawSnail(c, r, p, false),
  [TEX.margSnailStartled.key]: (c, r, p) => M.drawSnail(c, r, p, true),
  [TEX.margHare.key]: (c, r, p) => M.drawHare(c, r, p, false),
  [TEX.margHareStartled.key]: (c, r, p) => M.drawHare(c, r, p, true),
  [TEX.margMonkey.key]: (c, r, p) => M.drawMonkey(c, r, p, false),
  [TEX.margMonkeyStartled.key]: (c, r, p) => M.drawMonkey(c, r, p, true),
};

/** Части фигурок получают общую фактуру краски — зерно пергамента. */
const GRAIN = new Set<string>([
  TEX.libRobe.key,
  TEX.libHem.key,
  TEX.libHead.key,
  TEX.libHeadAngry.key,
  TEX.libHeadSleep.key,
  TEX.libArm.key,
  TEX.heroBody.key,
  TEX.heroHead.key,
  TEX.heroHeadPuff.key,
  TEX.deskFront.key,
  TEX.deskSide.key,
  TEX.doorLeaf.key,
  TEX.book.key,
]);

/** Золотая рамка миниатюры: внешняя линия, полоса сусального золота с чеканкой, цветной филет. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  thickness: number,
  ppc: number,
): void {
  const t = thickness * ppc;
  const W = (cols + thickness * 2) * ppc;
  const H = (rows + thickness * 2) * ppc;
  const rng = K.mulberry32(cols * 31 + rows);
  const ring = (inset: number, width: number): [K.Vec[], K.Vec[]] => [
    K.rectPath(inset, inset, W - inset * 2, H - inset * 2),
    K.rectPath(inset + width, inset + width, W - (inset + width) * 2, H - (inset + width) * 2),
  ];
  const fillRing = (inset: number, width: number, draw: () => void): void => {
    const [o, i] = ring(inset, width);
    ctx.save();
    ctx.beginPath();
    K.tracePath(ctx, o, true);
    K.tracePath(ctx, i.slice().reverse(), true);
    ctx.clip('evenodd');
    draw();
    ctx.restore();
  };
  const gold = t * 0.62;
  const fillet = t - gold;
  // Сусальное золото с кракелюром и чеканкой.
  fillRing(0, gold, () => {
    K.goldLeaf(ctx, rng, K.rectPath(-2, -2, W + 4, H + 4), { cracks: Math.round((W + H) / 18) });
  });
  const punch = Math.max(3, gold * 0.45);
  const mid = gold / 2;
  for (const p of K.resample(K.rectPath(mid, mid, W - mid * 2, H - mid * 2), punch, true)) {
    ctx.fillStyle = K.withAlpha(palette.gold.dark, 0.75);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.6, gold * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }
  // Цветной филет: ультрамарин и киноварь чередуются, как в миниатюрах.
  fillRing(gold, fillet, () => {
    const seg = Math.max(8, ppc * 0.5);
    const perim = K.resample(
      K.rectPath(
        gold + fillet / 2,
        gold + fillet / 2,
        W - (gold + fillet / 2) * 2,
        H - (gold + fillet / 2) * 2,
      ),
      seg,
      true,
    );
    ctx.lineWidth = fillet * 1.2;
    for (let i = 0; i + 1 < perim.length; i++) {
      ctx.strokeStyle = i % 2 ? palette.librarian.robe : palette.rubric;
      ctx.beginPath();
      ctx.moveTo(perim[i]!.x, perim[i]!.y);
      ctx.lineTo(perim[i + 1]!.x, perim[i + 1]!.y);
      ctx.stroke();
    }
  });
  const lw = Math.max(1, ppc * 0.018);
  K.inkOutline(ctx, rng, K.rectPath(lw / 2, lw / 2, W - lw, H - lw), lw * 1.3, {
    closed: true,
    pools: false,
    jitter: 0.3,
  });
  K.inkOutline(ctx, rng, K.rectPath(gold, gold, W - gold * 2, H - gold * 2), lw * 0.8, {
    closed: true,
    pools: false,
    jitter: 0.3,
  });
  K.inkOutline(ctx, rng, K.rectPath(t - lw / 2, t - lw / 2, W - t * 2 + lw, H - t * 2 + lw), lw, {
    closed: true,
    pools: false,
    jitter: 0.3,
  });
  // Угловые квадраты с ромбовым узором.
  const cs = t * 1.5;
  for (const [x, y] of [
    [0, 0],
    [W - cs, 0],
    [0, H - cs],
    [W - cs, H - cs],
  ] as const) {
    K.diaper(
      ctx,
      rng,
      { x, y, w: cs, h: cs },
      {
        a: palette.librarian.robe,
        b: palette.librarian.robeDark,
        line: palette.gold.base,
        dot: palette.gold.light,
      },
      'lozenge',
      cs / 2,
    );
    K.inkOutline(ctx, rng, K.rectPath(x, y, cs, cs), lw, { closed: true, pools: false });
  }
}

/** Маска полосы сусального золота рамки. */
function drawFrameMask(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  thickness: number,
  ppc: number,
): void {
  const t = thickness * ppc;
  const W = (cols + thickness * 2) * ppc;
  const H = (rows + thickness * 2) * ppc;
  const gold = t * 0.62;
  ctx.beginPath();
  K.tracePath(ctx, K.rectPath(0, 0, W, H), true);
  K.tracePath(ctx, K.rectPath(gold, gold, W - gold * 2, H - gold * 2).reverse(), true);
  ctx.fillStyle = palette.derived.paperWhite;
  ctx.fill('evenodd');
}

function drawWord(text: string, ppc: number, cyrillic: boolean): HTMLCanvasElement {
  return K.frakturWord(
    text,
    {
      initial: palette.rubric,
      text: palette.ink,
      ribbon: palette.derived.paperWhite,
      back: palette.parchmentShade,
      ink: palette.ink,
    },
    {
      px: ppc * (cyrillic ? 0.25 : 0.3),
      fontFamily: cyrillic ? FONT.display : FONT.fraktur,
      curl: 0.6,
    },
  );
}

export const manuscriptProvider: ArtProvider = {
  name: 'manuscript',
  draw(spec: TexSpec, ctx: CanvasRenderingContext2D, ppc: number, rng: K.Rand): void {
    const recipe = recipes[spec.key];
    if (!recipe) return;
    recipe(ctx, rng, ppc);
    if (GRAIN.has(spec.key)) K.grainOver(ctx, rng, spec.w * ppc, spec.h * ppc, 0.06);
  },
  room(ctx: CanvasRenderingContext2D, room: RoomView, ppc: number, seed: number): void {
    drawRoom(ctx, room, ppc, seed);
  },
  shelf(
    ctx: CanvasRenderingContext2D,
    dir: 'h' | 'v',
    len: number,
    ppc: number,
    seed: number,
  ): void {
    drawShelf(ctx, dir, len, ppc, seed);
  },
  loudRing(ctx: CanvasRenderingContext2D, radius: number, ppc: number): void {
    Hr.drawLoudRing(ctx, radius, ppc);
  },
  frame: drawFrame,
  frameMask: drawFrameMask,
  word: drawWord,
};
