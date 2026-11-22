/**
 * Загрузочная сцена: генерирует текстуры под экраном загрузки (план, 7.3.6).
 * Шрифты к этому моменту уже загружены — иначе текст на канве нарисовался бы запасным.
 */
import Phaser from 'phaser';
import { ArtFactory } from '../art/ArtFactory';
import type { SceneHost } from './host';
import { HOST_KEY } from './host';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const host = this.registry.get(HOST_KEY) as SceneHost;
    const art = new ArtFactory(this.textures, host.provider, host.ppc);
    host.art = art;
    void art
      .generateAll((done, total) => host.onBootProgress(done, total))
      .then(() => {
        host.onBootDone(art.generationMs);
        this.scene.start('Game');
      });
  }
}
