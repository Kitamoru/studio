import { GameObject } from '@/types/game';

/**
 * Вычисляет текущую скорость игры с использованием экспоненциального затухания.
 */
export function calculateSpeed(
  time: number, 
  minSpeed: number = 5.0, 
  maxSpeed: number = 15.0, 
  rate: number = 0.01
): number {
  return maxSpeed - (maxSpeed - minSpeed) * Math.exp(-rate * time);
}

/**
 * Высокопроизводительная проверка коллизий (AABB).
 * @param p Объект игрока
 * @param o Объект препятствия
 * @param padding Внутренний отступ для более точного хитбокса
 */
export function checkCollision(p: GameObject, o: GameObject, padding: number = 18): boolean {
  return (
    p.x + padding < o.x + o.width - padding &&
    p.x + p.width - padding > o.x + padding &&
    p.y + padding < o.y + o.height - padding &&
    p.y + p.height - padding > o.y + padding
  );
}
