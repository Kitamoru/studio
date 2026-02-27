export type GameStatus = 'START' | 'PLAYING' | 'GAME_OVER';

export type PlayerActionState = 'RUNNING' | 'JUMPING' | 'DUCKING';

export interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MonsterType = 'BEHOLDER' | 'MIMIC' | 'DRAGON' | 'SKELETON' | 'SLIME';

export interface Monster extends GameObject {
  type: MonsterType;
  speed: number;
  id: string;
  phase?: number;
  baseY?: number;
  isDashing?: boolean;
}

export interface Player extends GameObject {
  vy: number;
  state: PlayerActionState;
  jumpsRemaining: number;
  frame: number;
}

export interface EngineState {
  speed: number;
  distance: number;
  status: GameStatus;
  lastTimestamp: number;
  elapsedTime: number;
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
      };
    };
  }
}
