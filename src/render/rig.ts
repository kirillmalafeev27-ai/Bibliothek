/**
 * Общие мелочи для фигурок: части из манифеста, плавное приближение к позе.
 * Анимация процедурная — от времени кадра, поэтому на паузе всё замирает само.
 */
import Phaser from 'phaser';
import type { ArtFactory } from '../art/ArtFactory';
import type { TexSpec } from '../art/manifest';
import { CELL } from '../art/manifest';

/** Создаёт часть фигурки внутри контейнера. x, y — в клетках от ступней (y вверх — минус). */
export function part(
  scene: Phaser.Scene,
  box: Phaser.GameObjects.Container,
  art: ArtFactory,
  spec: TexSpec,
  x: number,
  y: number,
): Phaser.GameObjects.Image {
  const image = new Phaser.GameObjects.Image(scene, 0, 0, spec.key);
  image.setOrigin(spec.ox, spec.oy);
  image.setScale(art.scale);
  image.setPosition(x * CELL, y * CELL);
  box.add(image);
  return image;
}

/** Экспоненциальное приближение: за `tau` секунд проходит ~63% пути. */
export function approach(current: number, target: number, dt: number, tau: number): number {
  if (tau <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

export function approachAngle(current: number, target: number, dt: number, tau: number): number {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-dt / Math.max(1e-4, tau)));
}

export const smooth = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
