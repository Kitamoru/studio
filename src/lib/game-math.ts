import { GameObject } from '@/types/game';

/**
 * Вычисляет текущую скорость игры с использованием экспоненциального затухания.
 * Старт: 5.0 → Плато: ~13-14 к 3-4 минутам игры при rate=0.008
 *
 * Было: rate=0.01 → скорость росла слишком агрессивно
 * Стало: rate=0.008 → более плавная прогрессия, плато ~14 вместо 15
 */
export function calculateSpeed(
  time: number,
  minSpeed: number = 5.0,
  maxSpeed: number = 14.0,  // ↓ было 15 — убираем пиковый стресс
  rate: number = 0.008       // ↓ было 0.01 — медленнее набирает скорость
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
