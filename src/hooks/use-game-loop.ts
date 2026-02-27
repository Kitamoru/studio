'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface GameLoopData {
  deltaTime: number;
  timestamp: number;
}

/**
 * Кастомный хук для управления игровым циклом через requestAnimationFrame.
 * @param onUpdate Функция, вызываемая каждый кадр с данными о времени.
 * @param isActive Флаг активности цикла.
 */
export function useGameLoop(onUpdate: (data: GameLoopData) => void, isActive: boolean) {
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      // Ограничиваем deltaTime, чтобы избежать скачков при переключении вкладок
      const limitedDeltaTime = Math.min(deltaTime, 100); 
      
      onUpdate({
        deltaTime: limitedDeltaTime,
        timestamp: time
      });
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [onUpdate]);

  useEffect(() => {
    if (isActive) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
      previousTimeRef.current = 0;
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isActive, animate]);
}
