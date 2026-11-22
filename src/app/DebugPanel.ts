/**
 * Отладочная панель (план, 13.7) — только dev-сборка, клавиша `.
 * FPS, сид, T_med, p, A, состояния и таймеры библиотекарей, злость, время до нюха;
 * кнопки «оглушить», «заставить слушать», «нюх сейчас», «бесконечные билеты»,
 * «тест читаемости слуха».
 */
import type { Pace } from '../shared/pace';
import type { Quality } from '../shared/quality';
import type { Round } from './Round';

export class DebugPanel {
  private readonly el: HTMLElement;
  private readonly text: HTMLElement;
  private readonly buttons: Record<string, HTMLButtonElement> = {};
  private visible = false;
  private fps = 60;
  private acc = 0;

  constructor(root: HTMLElement, onOp: (op: string) => void) {
    this.el = document.createElement('div');
    this.el.className = 'lib-debug';
    this.el.style.display = 'none';
    this.text = document.createElement('div');
    const row = document.createElement('div');
    const ops: [string, string][] = [
      ['deaf', 'оглушить'],
      ['listen', 'слушать'],
      ['sniff', 'нюх сейчас'],
      ['cards', '∞ билеты'],
      ['hearing', 'тест слуха'],
    ];
    for (const [op, label] of ops) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => onOp(op));
      this.buttons[op] = b;
      row.append(b);
    }
    this.el.append(this.text, row);
    root.append(this.el);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? '' : 'none';
  }

  update(dt: number, round: Round | null, pace: Pace, quality: Quality): void {
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    this.acc += dt;
    if (!this.visible || this.acc < 0.2) return;
    this.acc = 0;
    if (!round) {
      this.text.textContent = `FPS ${this.fps.toFixed(0)}`;
      return;
    }
    const s = round.state;
    const lines = [
      `FPS ${this.fps.toFixed(0)} · качество ${quality.level}`,
      `сид ${s.seed} · ур. ${s.level.id} · t ${s.time.toFixed(1)} с`,
      `T_med ${pace.tMedSec().toFixed(2)} с · p ${pace.accuracy().toFixed(2)} · A ${s.unitA.toFixed(2)} с`,
      `герой ${s.hero.cell.x},${s.hero.cell.y} · словари ${s.hero.books} · билеты ${s.hero.cards} · готов ${s.hero.ready}`,
      `услышан ${s.stats.heard} · пойман ${s.stats.caught} · броски ${s.stats.throws}`,
      ...s.librarians.map(
        (m) =>
          `Б${m.id}: ${m.mode} ${m.timer.toFixed(1)} с · злость ${m.anger} · цель ${m.target ? `${m.target.x},${m.target.y}` : '—'} · нюх через ${Math.max(0, m.nextSniffAt - s.time).toFixed(1)} с`,
      ),
    ];
    this.text.textContent = lines.join('\n');
    this.buttons.deaf?.classList.toggle('is-on', s.debug.deaf);
    this.buttons.cards?.classList.toggle('is-on', s.debug.infiniteCards);
  }
}
