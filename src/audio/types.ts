/**
 * Звук игры (план, раздел 10). Сцена и приложение знают только этот интерфейс.
 */
export interface LibrarianVoice {
  /** Панорама −1..1 по x источника на экране. */
  pan: number;
  /** Расстояние до героя, клеток. */
  dist: number;
  walking: boolean;
  running: boolean;
  listening: boolean;
}

export interface AudioFrame {
  /** Идёт раунд (а не меню и не пауза). */
  playing: boolean;
  librarians: LibrarianVoice[];
  /** Герой в кольце громкого слуха: эмбиент тише на 40%, слышно сердцебиение (10.5). */
  earshot: boolean;
}

export interface AudioSettings {
  on: boolean;
  sfx: number;
  ambient: number;
}

export interface GameAudio {
  /** AudioContext запускается по первому жесту (10.7). */
  unlock(): void;
  play(name: string, pan?: number): void;
  update(dt: number, frame: AudioFrame): void;
  setSettings(s: AudioSettings): void;
  setPaused(paused: boolean): void;
  destroy(): void;
}

export class NullAudio implements GameAudio {
  unlock(): void {}
  play(): void {}
  update(): void {}
  setSettings(): void {}
  setPaused(): void {}
  destroy(): void {}
}
