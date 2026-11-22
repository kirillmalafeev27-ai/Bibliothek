/**
 * Голос ключей библиотекаря (план, 10.2): пока он идёт, связка тихо звенит; громкость
 * и панорама зависят от расстояния до героя; когда он слушает — ключи смолкают.
 */
import { balance } from '../config/balance';
import type { Mixer } from '../shared/audio/mixer';
import { keysJingle, shuffle } from './presets';
import type { LibrarianVoice } from './types';

export class KeysVoice {
  private next: number[] = [];

  constructor(private readonly mixer: Mixer) {}

  update(dt: number, librarians: readonly LibrarianVoice[], playing: boolean): void {
    while (this.next.length < librarians.length) this.next.push(Math.random() * 0.5);
    if (this.next.length > librarians.length) this.next.length = librarians.length;
    if (!playing) return;
    librarians.forEach((m, i) => {
      if (!(m.walking || m.running) || m.listening) {
        // Тишина: он слушает. Следующий звон — сразу, как только снова пойдёт.
        this.next[i] = Math.min(this.next[i] ?? 0, 0.15);
        return;
      }
      this.next[i] = (this.next[i] ?? 0) - dt;
      if ((this.next[i] ?? 0) > 0) return;
      this.next[i] = m.running ? 0.18 + Math.random() * 0.14 : 0.42 + Math.random() * 0.3;
      const near = Math.max(0, 1 - m.dist / balance.audio.keysMaxDist);
      const gain = 0.08 + Math.pow(near, 1.6) * 0.9;
      const v = this.mixer.voice(m.pan * 0.9, gain, 1 + (Math.random() - 0.5) * 0.1);
      if (v) {
        keysJingle(v);
        shuffle({ ...v, gain: v.gain * (m.running ? 1.4 : 1) });
      }
    });
  }
}
