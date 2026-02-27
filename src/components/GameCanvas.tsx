"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Player, Monster, MonsterType, ObstacleType, GameStatus, EngineState } from '@/types/game';
import { useGameLoop } from '@/hooks/use-game-loop';
import { calculateSpeed, checkCollision } from '@/lib/game-math';

const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 400;
const GRAVITY = 0.65;
const JUMP_STRENGTH = -14;
const GROUND_Y = 340;
const PLAYER_X = 120;
const PLAYER_SIZE = 72; // Увеличено на 50% (48 * 1.5)

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  
  const [gameState, setGameState] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const engineRef = useRef<EngineState>({
    speed: 5.0,
    distance: 0,
    status: 'START',
    lastTimestamp: 0,
    elapsedTime: 0,
  });

  const gameRef = useRef({
    player: { 
      x: PLAYER_X, 
      y: GROUND_Y - PLAYER_SIZE, 
      width: PLAYER_SIZE, 
      height: PLAYER_SIZE, 
      vy: 0, 
      state: 'RUNNING', 
      jumpsRemaining: 2, 
      frame: 0 
    } as Player,
    monsters: [] as Monster[],
    bgOffset: 0,
    lastSpawnTime: 0,
  });

  // Загрузка ассетов
  useEffect(() => {
    const img = new Image();
    img.src = '/Knight2.webp';
    img.onload = () => {
      playerImgRef.current = img;
      setIsImageLoaded(true);
    };
    img.onerror = () => {
      console.warn("Файл Knight2.webp не найден. Используем программную отрисовку.");
      setLoadError(true);
      setIsImageLoaded(true);
    };
  }, []);

  const drawPixelRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, offset: number) => {
    // Глубокий фон
    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Параллакс стен (кирпичи)
    const p1 = offset * 0.4;
    const brickW = 100;
    const brickH = 50;
    for (let row = 0; row < GROUND_Y / brickH; row++) {
      const xOffset = (row % 2 === 0 ? 0 : brickW / 2) - (p1 % brickW);
      for (let x = xOffset - brickW; x < VIRTUAL_WIDTH + brickW; x += brickW) {
        ctx.fillStyle = (Math.floor((x + p1) / brickW) + row) % 2 === 0 ? '#14111a' : '#0f0d14';
        ctx.fillRect(x, row * brickH, brickW - 4, brickH - 4);
      }
    }

    // Пол подземелья
    ctx.fillStyle = '#221e2b';
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
    
    // Текстура пола
    ctx.fillStyle = '#2d2738';
    for (let x = -(offset % 40); x < VIRTUAL_WIDTH; x += 40) {
      ctx.fillRect(x, GROUND_Y, 2, VIRTUAL_HEIGHT - GROUND_Y);
    }
  };

  const drawHero = (ctx: CanvasRenderingContext2D, player: Player) => {
    if (playerImgRef.current && !loadError) {
      ctx.drawImage(playerImgRef.current, Math.floor(player.x), Math.floor(player.y), player.width, player.height);
    } else {
      // Программный Принц (заглушка)
      const { x, y, width, height } = player;
      const bounce = player.state === 'RUNNING' ? Math.sin(Date.now() * 0.01) * 3 : 0;
      
      // Плащ
      ctx.fillStyle = '#6226B3';
      ctx.fillRect(x + 5, y + 35 + bounce, 45, 30);
      // Туника
      drawPixelRect(ctx, x + 20, y + 25 + bounce, 35, 40, '#4a2c1d');
      // Рукава
      drawPixelRect(ctx, x + 15, y + 30 + bounce, 10, 15, '#d35400');
      drawPixelRect(ctx, x + 50, y + 30 + bounce, 10, 15, '#d35400');
      // Голова
      drawPixelRect(ctx, x + 28, y + 10 + bounce, 24, 24, '#f1c40f');
    }
  };

  const drawMonster = (ctx: CanvasRenderingContext2D, m: Monster) => {
    if (m.type === 'BEHOLDER') {
      const float = Math.sin(Date.now() * 0.005) * 10;
      const mY = m.y + float;
      drawPixelRect(ctx, m.x, mY, m.width, m.height, '#833440');
      drawPixelRect(ctx, m.x + 10, mY + 10, m.width - 20, m.height - 20, '#ffffff');
      drawPixelRect(ctx, m.x + 18, mY + 18, 12, 12, '#000000');
    } else if (m.type === 'MIMIC') {
      drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#3a2115');
      drawPixelRect(ctx, m.x, m.y, m.width, 4, '#1a110a');
      drawPixelRect(ctx, m.x + m.width/2 - 4, m.y + m.height/2 - 4, 8, 8, '#d4af37');
    } else {
      drawPixelRect(ctx, m.x + 5, m.y, m.width - 10, m.height, '#e0e0e0');
      drawPixelRect(ctx, m.x + 10, m.y + 10, 8, 8, '#000000');
      drawPixelRect(ctx, m.x + m.width - 18, m.y + 10, 8, 8, '#000000');
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!isImageLoaded) {
      ctx.fillStyle = '#0a080d';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '16px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('ЗАГРУЗКА...', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
      return;
    }

    drawBackground(ctx, gameRef.current.bgOffset);
    gameRef.current.monsters.forEach(m => drawMonster(ctx, m));
    drawHero(ctx, gameRef.current.player);

    if (gameState === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '20px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('НАЖМИТЕ ДЛЯ СТАРТА', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    }

    if (gameState === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(40,0,0,0.7)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#ff0000';
      ctx.font = '32px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('ПОГИБ', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20);
      ctx.fillStyle = 'white';
      ctx.font = '14px "Press Start 2P"';
      ctx.fillText('КЛИК ДЛЯ ПЕРЕЗАПУСКА', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 40);
    }
  }, [isImageLoaded, gameState]);

  const handleUpdate = useCallback(({ deltaTime, timestamp }: { deltaTime: number, timestamp: number }) => {
    if (engineRef.current.status === 'PLAYING') {
      const dtFactor = deltaTime / 16.67;
      engineRef.current.elapsedTime += deltaTime / 1000;
      engineRef.current.speed = calculateSpeed(engineRef.current.elapsedTime);
      const currentSpeed = engineRef.current.speed;

      const { player, monsters } = gameRef.current;
      
      // Физика игрока
      player.vy += GRAVITY * dtFactor;
      player.y += player.vy * dtFactor;

      if (player.y > GROUND_Y - player.height) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.state = 'RUNNING';
        player.jumpsRemaining = 2;
      }

      gameRef.current.bgOffset += currentSpeed * dtFactor;
      engineRef.current.distance += currentSpeed * dtFactor * 0.1;

      // Спавн препятствий
      const spawnDelay = 2200 / (currentSpeed / 5);
      if (timestamp - gameRef.current.lastSpawnTime > spawnDelay) {
        const rand = Math.random();
        let type: MonsterType = 'MIMIC';
        let obsType: ObstacleType = 'GROUND';
        let mY = GROUND_Y - 48;
        let mH = 48;

        if (rand > 0.7) {
          type = 'BEHOLDER';
          obsType = 'AIR';
          mY = GROUND_Y - 160;
        } else if (rand > 0.4) {
          type = 'SKELETON';
          obsType = 'TALL';
          mY = GROUND_Y - 90;
          mH = 90;
        }

        monsters.push({
          id: Math.random().toString(36).substr(2, 9),
          type,
          obstacleType: obsType,
          x: VIRTUAL_WIDTH,
          y: mY,
          width: 48,
          height: mH,
          speed: currentSpeed,
        });
        gameRef.current.lastSpawnTime = timestamp;
      }

      // Обновление монстров и коллизии
      for (let i = monsters.length - 1; i >= 0; i--) {
        const m = monsters[i];
        m.x -= currentSpeed * dtFactor;

        if (checkCollision(player, m, 20)) {
          engineRef.current.status = 'GAME_OVER';
          setGameState('GAME_OVER');
          if (Math.floor(engineRef.current.distance) > highScore) {
            setHighScore(Math.floor(engineRef.current.distance));
          }
        }

        if (m.x + m.width < -100) {
          monsters.splice(i, 1);
        }
      }
      setScore(Math.floor(engineRef.current.distance));
    }
    
    draw();
  }, [highScore, draw]);

  useGameLoop(handleUpdate, true);

  const handleInput = () => {
    if (gameState !== 'PLAYING') {
      // Сброс состояния для новой игры
      engineRef.current.status = 'PLAYING';
      engineRef.current.elapsedTime = 0;
      engineRef.current.distance = 0;
      gameRef.current.monsters = [];
      gameRef.current.player.y = GROUND_Y - PLAYER_SIZE;
      gameRef.current.player.vy = 0;
      gameRef.current.player.jumpsRemaining = 2;
      gameRef.current.lastSpawnTime = performance.now();
      setGameState('PLAYING');
      setScore(0);
    } else {
      const { player } = gameRef.current;
      if (player.jumpsRemaining > 0) {
        player.vy = JUMP_STRENGTH;
        player.state = 'JUMPING';
        player.jumpsRemaining--;
      }
    }
  };

  useEffect(() => {
    const kd = (e: KeyboardEvent) => { 
      if (e.code === 'Space') { 
        e.preventDefault(); 
        handleInput(); 
      } 
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [gameState]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div 
        className="relative border-4 border-primary shadow-[0_0_30px_rgba(98,38,179,0.4)] overflow-hidden cursor-pointer"
        onClick={handleInput}
      >
        <canvas ref={canvasRef} width={VIRTUAL_WIDTH} height={VIRTUAL_HEIGHT} className="image-pixelated w-full h-auto max-w-[800px]" />
      </div>
      <div className="grid grid-cols-2 gap-4 w-full max-w-[800px]">
        <div className="bg-[#1a1621] p-4 border-b-4 border-primary">
          <p className="text-[10px] text-secondary mb-1">ГЛУБИНА</p>
          <p className="text-xl text-primary glow-text">{score}м</p>
        </div>
        <div className="bg-[#1a1621] p-4 border-b-4 border-secondary">
          <p className="text-[10px] text-secondary mb-1">РЕКОРД</p>
          <p className="text-xl text-secondary">{highScore}м</p>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
