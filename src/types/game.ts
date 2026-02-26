export type GameState = 'START' | 'PLAYING' | 'GAME_OVER';

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
  isJumping: boolean;
  frame: number;
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
