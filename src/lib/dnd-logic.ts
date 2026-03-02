/**
 * Утилиты для D&D механик
 */
export const rollDice = (sides: number = 20): number => {
  return Math.floor(Math.random() * sides) + 1;
};

export type D20ResultType = 'CRIT_FAIL' | 'FAIL' | 'SUCCESS' | 'CRIT_SUCCESS';

export interface D20CheckResult {
  roll: number;
  type: D20ResultType;
  message: string;
}

export const performACCheck = (armorClass: number): D20CheckResult => {
  const roll = rollDice(20);

  if (roll === 1) {
    return { roll, type: 'CRIT_FAIL', message: 'КРИТИЧЕСКИЙ ПРОВАЛ! Урон получен.' };
  }
  if (roll === 20) {
    return { roll, type: 'CRIT_SUCCESS', message: 'КРИТИЧЕСКИЙ УСПЕХ! Идеальное уклонение.' };
  }
  if (roll >= armorClass) {
    return { roll, type: 'SUCCESS', message: `УСПЕХ (${roll} vs ${armorClass}). Блок!` };
  }
  return { roll, type: 'FAIL', message: `ПРОВАЛ (${roll} vs ${armorClass}). Урон.` };
};

import { CharacterClass, CharacterClassName } from '@/types/game';

export const CHARACTER_CLASSES: Record<CharacterClassName, CharacterClass> = {
  FIGHTER: {
    name: 'FIGHTER',
    label: 'ВОИН',
    // Тяжёлая броня снижает прыжок — компенсируется высоким AC и HP
    description: 'Мастер щита. Самая высокая броня (AC 15) и здоровье.',
    armorClass: 15,
    maxHp: 6,
    jumpMultiplier: 1.0,   // ↓ тяжёлый, прыжок ниже стандарта
    maxJumps: 1,
    abilityName: 'БАСТИОН (Пассивно)',
    abilityCooldown: 0,
  },
  ROGUE: {
    name: 'ROGUE',
    label: 'ПЛУТ',
    // Единственный класс с двойным прыжком — главное преимущество
    description: 'Неуловимый. Обладает ПАССИВНЫМ ДВОЙНЫМ ПРЫЖКОМ.',
    armorClass: 12,
    maxHp: 4,
    jumpMultiplier: 1.08,   // чуть выше базы, но двойной прыжок главная фишка
    maxJumps: 2,            // ← только ROGUE получает двойной прыжок
    abilityName: 'ДВОЙНОЙ ПРЫЖОК (Пассивно)',
    abilityCooldown: 0,
  },
  WIZARD: {
    name: 'WIZARD',
    label: 'МАГ',
    // Хрупкий, но с бонусом к очкам — прыжок чуть выше для выживаемости
    description: 'Магическое предвидение. +25% к получаемым очкам.',
    armorClass: 10,
    maxHp: 3,
    jumpMultiplier: 1.0,   // ↓ было 1.45 — слишком высоко, теперь умеренно
    maxJumps: 1,
    abilityName: 'ПРЕДВИДЕНИЕ (Пассивно)',
    abilityCooldown: 0,
  },
  BARD: {
    name: 'BARD',
    label: 'БАРД',
    // Регенерация каждые 13 сек — обновлено с 20
    description: 'Регенерация. Восстанавливает 1 HP каждые 13 сек.',
    armorClass: 11,
    maxHp: 5,
    jumpMultiplier: 1.0,    // стандартный прыжок — баланс под регенерацию
    maxJumps: 1,
    abilityName: 'ПЕСНЬ ОТДЫХА (Пассивно)',
    abilityCooldown: 0,
  },
};
