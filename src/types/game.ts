export type GameStatus = 'START' | 'CLASS_SELECTION' | 'PLAYING' | 'GAME_OVER';

export type PlayerActionState = 'RUNNING' | 'JUMPING' | 'DUCKING';

export interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ObstacleType = 'GROUND' | 'AIR' | 'TALL';
export type MonsterType = 
  | 'SLIME' | 'GOBLIN' | 'SKELETON' | 'MIMIC' // GROUND
  | 'BAT' | 'BEHOLDER'                      // AIR
  | 'OGRE' | 'GHOST' | 'DRAGON';             // TALL

export interface Monster extends GameObject {
  type: MonsterType;
  obstacleType: ObstacleType;
  speed: number;
  id: string;
}

export interface Player extends GameObject {
  vy: number;
  state: PlayerActionState;
  jumpsRemaining: number;
  frame: number;
  maxJumps: number;
}

export interface EngineState {
  speed: number;
  distance: number;
  status: GameStatus;
  lastTimestamp: number;
  elapsedTime: number;
}

export type CharacterClassName = 'FIGHTER' | 'ROGUE' | 'WIZARD' | 'BARD';

export interface CharacterClass {
  name: CharacterClassName;
  label: string;
  description: string;
  armorClass: number;
  maxHp: number;
  jumpMultiplier: number;
  maxJumps: number;
  abilityName: string;
  abilityCooldown: number;
}

export interface CombatLogEntry {
  id: string;
  text: string;
  type: 'info' | 'success' | 'critical' | 'fail';
}

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        initDataUnsafe: {
          user?: TelegramUser;
        };
        headerColor: string;
      };
    };
  }
}
