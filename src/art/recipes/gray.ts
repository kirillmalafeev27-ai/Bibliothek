/**
 * Серый прототип (план, этап 2): клетки — квадраты, стеллажи — тёмные блоки,
 * библиотекарь — круг с «ушами», кольца — простые окружности, маникула — стрелка.
 * На этих фигурах проверяется геймплей; включается параметром `?art=gray`.
 */
import { palette } from '../../config/palette';
import type { RoomView } from '../../render/room';
import { tileOf } from '../../render/room';
import * as K from '../../shared/manuscriptKit';
import type { ArtProvider } from '../ArtFactory';
import { LOUD_RING_PAD } from '../ArtFactory';
import type { TexSpec } from '../manifest';
import { SHELF } from '../manifest';

const G = palette.proto;

function fillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  line = 0,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (line > 0) {
    ctx.strokeStyle = G.line;
    ctx.lineWidth = line;
    ctx.strokeRect(x + line / 2, y + line / 2, w - line, h - line);
  }
}

function oval(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  line = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (line > 0) {
    ctx.strokeStyle = G.line;
    ctx.lineWidth = line;
    ctx.stroke();
  }
}

function poly(ctx: CanvasRenderingContext2D, pts: number[], color: string, line = 0): void {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    if (i === 0) ctx.moveTo(pts[i] as number, pts[i + 1] as number);
    else ctx.lineTo(pts[i] as number, pts[i + 1] as number);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (line > 0) {
    ctx.strokeStyle = G.line;
    ctx.lineWidth = line;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

export const grayProvider: ArtProvider = {
  name: 'gray',

  draw(spec: TexSpec, ctx: CanvasRenderingContext2D, ppc: number): void {
    const w = spec.w * ppc;
    const h = spec.h * ppc;
    const lw = Math.max(1.5, ppc * 0.035);
    const key = spec.key;
    if (key.startsWith('page_')) {
      poly(
        ctx,
        [w * 0.12, h * 0.1, w * 0.86, h * 0.16, w * 0.9, h * 0.88, w * 0.1, h * 0.84],
        G.item,
        lw,
      );
      ctx.fillStyle = G.line;
      ctx.font = `700 ${h * 0.4}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Number(key.slice(5)) + 1), w / 2, h / 2);
    } else if (key === 'book' || key === 'fall_book' || key === 'card') {
      fillRect(ctx, w * 0.12, h * 0.2, w * 0.76, h * 0.6, key === 'book' ? G.squeak : G.item, lw);
    } else if (key === 'desk_front' || key === 'desk_side') {
      fillRect(ctx, w * 0.06, h * 0.3, w * 0.88, h * 0.66, G.shelfTop, lw);
      fillRect(ctx, w * 0.3, h * 0.08, w * 0.3, h * 0.24, G.wall, lw);
    } else if (key === 'candle') {
      fillRect(ctx, w * 0.38, h * 0.2, w * 0.24, h * 0.76, G.item, lw);
    } else if (key === 'flame') {
      oval(ctx, w / 2, h * 0.5, w * 0.3, h * 0.42, G.item, lw);
    } else if (key === 'door_leaf') {
      fillRect(ctx, w * 0.08, 0, w * 0.84, h * 0.9, G.shelfTop, lw);
    } else if (key === 'door_light') {
      fillRect(ctx, w * 0.1, h * 0.7, w * 0.8, h * 0.3, G.door);
    } else if (key === 'halo') {
      const r = 2.25 * ppc;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.fillStyle = K.withAlpha(G.ring, 0.12);
      ctx.fill();
      ctx.strokeStyle = G.ring;
      ctx.lineWidth = lw * 1.6;
      ctx.stroke();
    } else if (key.startsWith('manicule_')) {
      const tone = key.endsWith('ink') ? G.shelf : key.endsWith('gold') ? G.item : G.alarm;
      poly(
        ctx,
        [
          w * 0.04,
          h * 0.3,
          w * 0.6,
          h * 0.3,
          w * 0.6,
          h * 0.08,
          w * 0.97,
          h * 0.42,
          w * 0.6,
          h * 0.86,
          w * 0.6,
          h * 0.58,
          w * 0.04,
          h * 0.58,
        ],
        tone,
        lw,
      );
    } else if (key === 'slipper_print' || key === 'foot_ink' || key === 'foot_alarm') {
      oval(
        ctx,
        w / 2,
        h / 2,
        w * 0.3,
        h * 0.38,
        key === 'foot_alarm' ? G.alarm : key === 'foot_ink' ? G.shelf : K.withAlpha(G.shelf, 0.6),
        key === 'foot_alarm' ? lw : 0,
      );
    } else if (
      key === 'route_dot' ||
      key === 'aim_dot' ||
      key === 'path_ink' ||
      key === 'path_alarm' ||
      key === 'ring_chip' ||
      key === 'dust' ||
      key === 'spark'
    ) {
      oval(ctx, w / 2, h / 2, w * 0.3, h * 0.3, key === 'path_alarm' ? G.alarm : G.shelf);
    } else if (key === 'route_end') {
      ctx.strokeStyle = G.line;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.2);
      ctx.lineTo(w * 0.8, h * 0.8);
      ctx.moveTo(w * 0.8, h * 0.2);
      ctx.lineTo(w * 0.2, h * 0.8);
      ctx.stroke();
    } else if (key === 'aim_ok' || key === 'aim_bad') {
      ctx.strokeStyle = key === 'aim_ok' ? G.line : G.alarm;
      ctx.lineWidth = lw * 1.4;
      ctx.setLineDash(key === 'aim_ok' ? [] : [lw * 3, lw * 3]);
      ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
      ctx.setLineDash([]);
    } else if (key === 'heard_flash' || key === 'ink_star' || key === 'zzz' || key === 'steam') {
      ctx.strokeStyle = G.line;
      ctx.lineWidth = lw;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(w / 2 + Math.cos(a) * w * 0.14, h / 2 + Math.sin(a) * h * 0.14);
        ctx.lineTo(w / 2 + Math.cos(a) * w * 0.42, h / 2 + Math.sin(a) * h * 0.42);
        ctx.stroke();
      }
    } else if (key === 'lib_robe') {
      poly(
        ctx,
        [w * 0.3, h * 0.04, w * 0.7, h * 0.04, w * 0.94, h * 0.98, w * 0.06, h * 0.98],
        G.librarian,
        lw,
      );
    } else if (key === 'lib_hem') {
      fillRect(ctx, w * 0.06, h * 0.3, w * 0.88, h * 0.5, G.librarian);
    } else if (key.startsWith('lib_head')) {
      oval(
        ctx,
        w * 0.44,
        h * 0.5,
        w * 0.34,
        h * 0.42,
        key.endsWith('angry') ? G.alarm : G.shelfTop,
        lw,
      );
      oval(ctx, w * 0.84, h * 0.56, w * 0.14, h * 0.07, G.shelfTop, lw);
    } else if (key === 'lib_ear') {
      oval(ctx, w * 0.5, h * 0.42, w * 0.34, h * 0.38, G.item, lw);
    } else if (key === 'lib_arm' || key === 'hero_arm' || key === 'hero_leg') {
      fillRect(
        ctx,
        w * 0.3,
        h * 0.06,
        w * 0.4,
        h * 0.88,
        key === 'lib_arm' ? G.librarian : G.hero,
        lw,
      );
    } else if (key === 'lib_keys' || key === 'lib_stamp') {
      fillRect(ctx, w * 0.2, h * 0.3, w * 0.6, h * 0.6, G.item, lw);
    } else if (key === 'lib_slipper') {
      oval(ctx, w / 2, h / 2, w * 0.42, h * 0.36, G.shelf, lw);
    } else if (key === 'hero_body') {
      fillRect(ctx, w * 0.14, h * 0.06, w * 0.72, h * 0.88, G.hero, lw);
    } else if (key.startsWith('hero_head')) {
      oval(ctx, w / 2, h * 0.5, w * 0.36, h * 0.4, G.hero, lw);
      oval(ctx, w * 0.66, h * 0.46, w * 0.05, h * 0.06, G.line);
    } else if (key === 'hero_scarf') {
      fillRect(ctx, w * 0.06, h * 0.25, w * 0.86, h * 0.4, G.squeak, lw);
    } else if (key === 'stamp_mark') {
      ctx.strokeStyle = G.alarm;
      ctx.lineWidth = lw * 1.5;
      ctx.strokeRect(w * 0.06, h * 0.12, w * 0.88, h * 0.76);
    } else if (key === 'glint') {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, K.withAlpha(G.item, 0));
      g.addColorStop(0.5, K.withAlpha(G.item, 0.8));
      g.addColorStop(1, K.withAlpha(G.item, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (key.startsWith('marg_')) {
      oval(ctx, w / 2, h * 0.6, w * 0.34, h * 0.32, K.withAlpha(G.shelf, 0.35), lw * 0.7);
    } else {
      fillRect(ctx, w * 0.1, h * 0.1, w * 0.8, h * 0.8, G.shelfTop, lw);
    }
  },

  room(ctx: CanvasRenderingContext2D, room: RoomView, ppc: number): void {
    for (let y = 0; y < room.rows; y++) {
      for (let x = 0; x < room.cols; x++) {
        const t = tileOf(room, x, y);
        const px = x * ppc;
        const py = y * ppc;
        if (t === 'wall') fillRect(ctx, px, py, ppc, ppc, G.wall);
        else if (t === 'door') fillRect(ctx, px, py, ppc, ppc, G.door, ppc * 0.04);
        else {
          fillRect(ctx, px, py, ppc, ppc, (x + y) % 2 === 0 ? G.floorA : G.floorB);
          if (t === 'squeak') {
            fillRect(ctx, px + ppc * 0.06, py + ppc * 0.06, ppc * 0.88, ppc * 0.88, G.squeak);
            ctx.strokeStyle = G.line;
            ctx.lineWidth = ppc * 0.03;
            for (const f of [0.33, 0.66]) {
              ctx.beginPath();
              ctx.moveTo(px + ppc * 0.06, py + ppc * f);
              ctx.lineTo(px + ppc * 0.94, py + ppc * f);
              ctx.stroke();
            }
          }
        }
      }
    }
  },

  shelf(ctx: CanvasRenderingContext2D, dir: 'h' | 'v', len: number, ppc: number): void {
    const w = (dir === 'h' ? len : 1) * ppc;
    const h = (dir === 'h' ? 1 + SHELF.overhang : len + SHELF.overhang) * ppc;
    const front = SHELF.front * ppc;
    fillRect(ctx, 0, 0, w, h - front, G.shelfTop, ppc * 0.03);
    fillRect(ctx, 0, h - front, w, front, G.shelf, ppc * 0.03);
  },

  loudRing(ctx: CanvasRenderingContext2D, radius: number, ppc: number): void {
    const c = (radius + LOUD_RING_PAD) * ppc;
    ctx.strokeStyle = G.ring;
    ctx.lineWidth = Math.max(1.5, ppc * 0.03);
    ctx.setLineDash([ppc * 0.18, ppc * 0.14]);
    ctx.beginPath();
    ctx.arc(c, c, radius * ppc, 0, Math.PI * 2);
    ctx.stroke();
  },

  frame(
    ctx: CanvasRenderingContext2D,
    cols: number,
    rows: number,
    thickness: number,
    ppc: number,
  ): void {
    const t = thickness * ppc;
    ctx.strokeStyle = G.line;
    ctx.lineWidth = Math.max(1, t * 0.5);
    ctx.strokeRect(t / 2, t / 2, cols * ppc + t, rows * ppc + t);
  },

  frameMask(
    ctx: CanvasRenderingContext2D,
    cols: number,
    rows: number,
    thickness: number,
    ppc: number,
  ): void {
    const t = thickness * ppc;
    ctx.strokeStyle = G.item;
    ctx.lineWidth = t;
    ctx.strokeRect(t / 2, t / 2, cols * ppc + t, rows * ppc + t);
  },

  word(text: string, ppc: number): HTMLCanvasElement {
    const px = ppc * 0.3;
    const probe = K.ctx2d(K.makeCanvas(4, 4));
    probe.font = `700 ${px}px sans-serif`;
    const w = probe.measureText(text).width + px * 1.2;
    const h = px * 1.8;
    const canvas = K.makeCanvas(w, h);
    const ctx = K.ctx2d(canvas);
    fillRect(ctx, 1, 1, w - 2, h - 2, G.item, 2);
    ctx.fillStyle = G.line;
    ctx.font = `700 ${px}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    return canvas;
  },
};
