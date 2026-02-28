
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
 * Высокопроизводительная проверка коллизий (AABB) с индивидуальными отступами.
 * @param p Объект игрока
 * @param pPadding Отступ игрока
 * @param o Объект препятствия
 * @param oPadding Отступ препятствия
 */
export function checkCollision(
  p: GameObject, 
  pPadding: number, 
  o: GameObject, 
  oPadding: number
): boolean {
  return (
    p.x + pPadding < o.x + o.width - oPadding &&
    p.x + p.width - pPadding > o.x + oPadding &&
    p.y + pPadding < o.y + o.height - oPadding &&
    p.y + p.height - pPadding > o.y + oPadding
  );
}
