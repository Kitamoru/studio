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
    return { roll, type: 'CRIT_FAIL', message: 'КРИТИЧЕСКИЙ ПРОВАЛ! Урон удвоен.' };
  }
  if (roll === 20) {
    return { roll, type: 'CRIT_SUCCESS', message: 'КРИТИЧЕСКИЙ УСПЕХ! Идеальное уклонение.' };
  }
  if (roll >= armorClass) {
    return { roll, type: 'SUCCESS', message: `УСПЕХ (${roll} vs ${armorClass}). Урон заблокирован!` };
  }
  return { roll, type: 'FAIL', message: `ПРОВАЛ (${roll} vs ${armorClass}). Получен урон.` };
};

import { CharacterClass, CharacterClassName } from '@/types/game';

export const CHARACTER_CLASSES: Record<CharacterClassName, CharacterClass> = {
  FIGHTER: {
    name: 'FIGHTER',
    label: 'ВОИН',
    description: 'Мастер щита. 1 прыжок, высокий AC.',
    armorClass: 14,
    maxHp: 6,
    jumpMultiplier: 1.0,
    maxJumps: 1,
    abilityName: 'БЛОК ЩИТОМ',
    abilityCooldown: 10000,
  },
  ROGUE: {
    name: 'ROGUE',
    label: 'ПЛУТ',
    description: 'ДВОЙНОЙ ПРЫЖОК и скрытность.',
    armorClass: 12,
    maxHp: 4,
    jumpMultiplier: 1.1,
    maxJumps: 2,
    abilityName: 'РЫВОК',
    abilityCooldown: 5000,
  },
  WIZARD: {
    name: 'WIZARD',
    label: 'МАГ',
    description: 'Хрупкий. 1 высокий прыжок.',
    armorClass: 9,
    maxHp: 3,
    jumpMultiplier: 1.4,
    maxJumps: 1,
    abilityName: 'ЗАМЕДЛЕНИЕ',
    abilityCooldown: 15000,
  },
};
