/**
 * Вычисляет текущую скорость игры с использованием экспоненциального затухания.
 * Скорость плавно стремится к maxSpeed, но никогда ее не превышает.
 * 
 * @param time Прошедшее время в секундах.
 * @param minSpeed Начальная скорость.
 * @param maxSpeed Максимально возможная скорость (soft cap).
 * @param rate Коэффициент ускорения.
 */
export function calculateSpeed(
  time: number, 
  minSpeed: number = 5.0, 
  maxSpeed: number = 15.0, 
  rate: number = 0.01
): number {
  // Формула: V(t) = Max - (Max - Min) * e^(-rate * t)
  return maxSpeed - (maxSpeed - minSpeed) * Math.exp(-rate * time);
}
