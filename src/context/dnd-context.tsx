'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CharacterClass, CharacterClassName, CombatLogEntry } from '@/types/game';
import { CHARACTER_CLASSES } from '@/lib/dnd-logic';

interface DndContextType {
  hp: number;
  maxHp: number;
  selectedClass: CharacterClass | null;
  combatLog: CombatLogEntry[];
  selectClass: (className: CharacterClassName) => void;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  addLog: (text: string, type?: CombatLogEntry['type']) => void;
  resetDnd: () => void;
}

const DndContext = createContext<DndContextType | undefined>(undefined);

export const DndProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
  const [hp, setHp] = useState(0);
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);

  const addLog = useCallback((text: string, type: CombatLogEntry['type'] = 'info') => {
    const newEntry: CombatLogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      type,
    };
    // Добавляем новые логи в конец массива для отображения сверху вниз
    setCombatLog(prev => [...prev, newEntry].slice(-8));
  }, []);

  const selectClass = useCallback((className: CharacterClassName) => {
    const cls = CHARACTER_CLASSES[className];
    setSelectedClass(cls);
    setHp(cls.maxHp);
    setCombatLog([]); // Очищаем логи при выборе нового класса
    addLog(`Выбран класс: ${cls.label}`, 'info');
  }, [addLog]);

  const takeDamage = useCallback((amount: number) => {
    setHp(prev => Math.max(0, prev - amount));
  }, []);

  const heal = useCallback((amount: number) => {
    setHp(prev => (selectedClass ? Math.min(selectedClass.maxHp, prev + amount) : prev));
  }, [selectedClass]);

  const resetDnd = useCallback(() => {
    if (selectedClass) {
      setHp(selectedClass.maxHp);
      setCombatLog([]);
      addLog('Новое приключение начинается!', 'info');
    }
  }, [selectedClass, addLog]);

  return (
    <DndContext.Provider value={{
      hp,
      maxHp: selectedClass?.maxHp || 0,
      selectedClass,
      combatLog,
      selectClass,
      takeDamage,
      heal,
      addLog,
      resetDnd,
    }}>
      {children}
    </DndContext.Provider>
  );
};

export const useDnd = () => {
  const context = useContext(DndContext);
  if (!context) throw new Error('useDnd must be used within DndProvider');
  return context;
};
