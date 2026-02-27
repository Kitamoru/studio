"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Player, Monster, MonsterType, ObstacleType, TelegramUser, GameStatus, EngineState } from '@/types/game';
import { useGameLoop } from '@/hooks/use-game-loop';
import { calculateSpeed, checkCollision } from '@/lib/game-math';

const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 400;
const GRAVITY = 0.6;
const JUMP_STRENGTH = -14;
const GROUND_Y = 340;
const PLAYER_X = 120;
const PLAYER_SIZE = 72; // Увеличено на 50% от базового (48 * 1.5)

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  
  const [gameState, setGameState] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
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
    frameCount: 0,
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      if (tg.initDataUnsafe?.user) {
        setTelegramUser(tg.initDataUnsafe.user);
      }
    }

    const img = new Image();
    img.src = '/Knight2.webp';
    img.onload = () => {
      playerImgRef.current = img;
      setIsImageLoaded(true);
    };
    img.onerror = () => {
      console.error("Failed to load Knight2.webp");
      setLoadError(true);
      setIsImageLoaded(true);
    };
  }, []);

  const drawPixelRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, offset: number) => {
    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    const p1 = offset * 0.3;
    const brickW = 80;
    const brickH = 40;
    for (let row = 0; row < GROUND_Y / brickH; row++) {
      const xOffset = (row % 2 === 0 ? 0 : brickW / 2) - (p1 % brickW);
      for (let x = xOffset - brickW; x < VIRTUAL_WIDTH + brickW; x += brickW) {
        ctx.fillStyle = (Math.floor((x + p1) / brickW) + row) % 2 === 0 ? '#1a1621' : '#14111a';
        ctx.fillRect(x, row * brickH, brickW - 2, brickH - 2);
      }
    }

    ctx.fillStyle = '#2d2738';
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
  };

  const drawHero = (ctx: CanvasRenderingContext2D, player: Player) => {
    const { x, y, width, height } = player;
    if (playerImgRef.current && !loadError) {
      ctx.drawImage(playerImgRef.current, Math.floor(x), Math.floor(y), width, height);
    } else {
      // Запасной вариант (программная отрисовка)
      const walk = player.state === 'RUNNING' ? Math.sin(Date.now() * 0.01) * 4 : 0;
      drawPixelRect(ctx, x + 15, y + 25 + walk, 42, 45, '#4a2c1d'); // Туника
      drawPixelRect(ctx, x + 25, y + 10 + walk, 24, 24, '#f0d0a0'); // Лицо
      ctx.fillStyle = '#6226B3'; // Плащ
      ctx.fillRect(x - 5, y + 30 + walk, 35, 40);
    }
  };

  const drawMonster = (ctx: CanvasRenderingContext2D, m: Monster) => {
    if (m.type === 'BEHOLDER') {
      // Детализированный Бехолдер
      drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#833440');
      drawPixelRect(ctx, m.x + 8, m.y + 8, m.width - 16, m.height - 16, '#ffffff');
      drawPixelRect(ctx, m.x + 16, m.y + 16, 16, 16, '#000000');
    } else if (m.type === 'MIMIC') {
      // Детализированный Мимик (Сундук)
      drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#3a2115');
      drawPixelRect(ctx, m.x, m.y + 10, m.width, 4, '#1a110a');
      drawPixelRect(ctx, m.x + m.width/2 - 4, m.y + m.height/2 - 4, 8, 8, '#d4af37');
    } else {
      // Скелет (Высокое препятствие)
      drawPixelRect(ctx, m.x + 10, m.y, m.width - 20, m.height, '#e0e0e0');
      drawPixelRect(ctx, m.x + 14, m.y + 4, 20, 16, '#000000');
    }
  };

  const handleUpdate = useCallback(({ deltaTime, timestamp }: { deltaTime: number, timestamp: number }) => {
    if (engineRef.current.status !== 'PLAYING') return;

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

    // Алгоритм спавна на основе скорости (Этап 2)
    const spawnDelay = 2500 / (currentSpeed / 5); // Интервал сокращается при росте скорости
    if (timestamp - gameRef.current.lastSpawnTime > spawnDelay) {
      const rand = Math.random();
      let type: MonsterType = 'MIMIC';
      let obsType: ObstacleType = 'GROUND';
      let mY = GROUND_Y - 48;
      let mH = 48;

      if (rand > 0.6) {
        type = 'BEHOLDER';
        obsType = 'AIR';
        mY = GROUND_Y - 150;
      } else if (rand > 0.3) {
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

    // Менеджер объектов: Движение, Коллизии и Очистка памяти
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      m.x -= currentSpeed * dtFactor;

      // Высокопроизводительный хитбокс (Этап 2)
      if (checkCollision(player, m)) {
        engineRef.current.status = 'GAME_OVER';
        setGameState('GAME_OVER');
        if (Math.floor(engineRef.current.distance) > highScore) {
          setHighScore(Math.floor(engineRef.current.distance));
        }
      }

      // Очистка памяти (Удаление объектов за краем)
      if (m.x + m.width < -100) {
        monsters.splice(i, 1);
      }
    }

    setScore(Math.floor(engineRef.current.distance));
    draw();
  }, [highScore]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!isImageLoaded) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0,0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = 'white';
      ctx.font = '20px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('ЗАГРУЗКА РЕСУРСОВ...', VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2);
      return;
    }

    drawBackground(ctx, gameRef.current.bgOffset);
    gameRef.current.monsters.forEach(m => drawMonster(ctx, m));
    drawHero(ctx, gameRef.current.player);

    if (gameState === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0,0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '24px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('НАЖМИТЕ ДЛЯ СТАРТА', VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2);
    }

    if (gameState === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(50,0,0,0.8)';
      ctx.fillRect(0,0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#ff0000';
      ctx.font = '32px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('ПОГИБ', VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2);
      ctx.fillStyle = 'white';
      ctx.font = '16px "Press Start 2P"';
      ctx.fillText('КЛИК ДЛЯ ПЕРЕЗАПУСКА', VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2 + 50);
    }
  }, [isImageLoaded, gameState]);

  useGameLoop(handleUpdate, gameState === 'PLAYING' || gameState === 'START');

  const handleInput = () => {
    if (gameState !== 'PLAYING') {
      engineRef.current.status = 'PLAYING';
      engineRef.current.elapsedTime = 0;
      engineRef.current.distance = 0;
      gameRef.current.monsters = [];
      gameRef.current.player.y = GROUND_Y - PLAYER_SIZE;
      gameRef.current.player.vy = 0;
      gameRef.current.lastSpawnTime = performance.now();
      setGameState('PLAYING');
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
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); handleInput(); } };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [gameState]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div 
        className="relative border-4 border-primary shadow-[0_0_20px_rgba(98,38,179,0.5)] overflow-hidden cursor-pointer"
        onClick={handleInput}
      >
        <canvas ref={canvasRef} width={VIRTUAL_WIDTH} height={VIRTUAL_HEIGHT} className="image-pixelated w-full h-auto max-w-[800px]" />
      </div>
      <div className="grid grid-cols-2 gap-8 w-full max-w-[800px] text-center">
        <div className="bg-muted p-4 border-2 border-primary/30">
          <p className="text-[10px] text-secondary">ГЛУБИНА</p>
          <p className="text-xl text-primary glow-text">{score}м</p>
        </div>
        <div className="bg-muted p-4 border-2 border-secondary/30">
          <p className="text-[10px] text-secondary">РЕКОРД</p>
          <p className="text-xl text-secondary">{highScore}м</p>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
