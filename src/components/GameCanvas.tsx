"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Player, Monster, MonsterType, TelegramUser, GameStatus, EngineState } from '@/types/game';
import { useGameLoop } from '@/hooks/use-game-loop';
import { calculateSpeed } from '@/lib/game-math';

const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 400;
const GRAVITY = 0.6; // Скорректировано под deltaTime
const JUMP_STRENGTH = -14;
const GROUND_Y = 340;
const PLAYER_X = 120;
const PLAYER_SIZE = 72;

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  
  const [gameState, setGameState] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Референс для хранения мутабельного состояния движка
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
    lastSpawn: 0,
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
    if (!loadError && playerImgRef.current) {
      ctx.drawImage(playerImgRef.current, Math.floor(x), Math.floor(y), width, height);
    } else {
      const walk = player.state === 'RUNNING' ? Math.sin(Date.now() * 0.01) * 4 : 0;
      drawPixelRect(ctx, x + 12, y + 18 + walk, 42, 45, '#4a2c1d');
      drawPixelRect(ctx, x + 21, y + 6 + walk, 24, 24, '#f0d0a0');
      ctx.fillStyle = '#6226B3';
      ctx.fillRect(x - 8, y + 24 + walk, 32, 40);
    }
  };

  const drawMonster = (ctx: CanvasRenderingContext2D, m: Monster) => {
    if (m.type === 'BEHOLDER') {
      drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#833440');
      drawPixelRect(ctx, m.x + 10, m.y + 10, m.width - 20, m.height - 20, '#FFFFFF');
    } else {
      drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#3a2115');
      drawPixelRect(ctx, m.x + m.width/2 - 4, m.y + m.height/2, 8, 10, '#d4af37');
    }
  };

  const handleUpdate = useCallback(({ deltaTime, timestamp }: { deltaTime: number, timestamp: number }) => {
    if (engineRef.current.status !== 'PLAYING') return;

    const dtFactor = deltaTime / 16.67; // Нормализация под 60 FPS
    engineRef.current.elapsedTime += deltaTime / 1000;
    
    // Обновление скорости по экспоненте
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

    // Спавн монстров
    if (timestamp - gameRef.current.lastSpawn > (2000 / (currentSpeed * 0.2))) {
      const type: MonsterType = Math.random() > 0.5 ? 'BEHOLDER' : 'MIMIC';
      const mY = type === 'BEHOLDER' ? GROUND_Y - 140 : GROUND_Y - 48;
      monsters.push({
        id: Math.random().toString(36).substr(2, 9),
        type,
        x: VIRTUAL_WIDTH,
        y: mY,
        width: 48,
        height: 48,
        speed: currentSpeed,
      });
      gameRef.current.lastSpawn = timestamp;
    }

    // Движение монстров и коллизии
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      m.x -= currentSpeed * dtFactor;

      const pad = 20;
      if (
        player.x < m.x + m.width - pad &&
        player.x + player.width - pad > m.x &&
        player.y < m.y + m.height - pad &&
        player.y + player.height - pad > m.y
      ) {
        engineRef.current.status = 'GAME_OVER';
        setGameState('GAME_OVER');
        if (Math.floor(engineRef.current.distance) > highScore) {
          setHighScore(Math.floor(engineRef.current.distance));
        }
      }

      if (m.x + m.width < 0) {
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

    drawBackground(ctx, gameRef.current.bgOffset);
    
    if (!isImageLoaded) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0,0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = 'white';
      ctx.font = '20px "Press Start 2P"';
      ctx.fillText('ЗАГРУЗКА РЕСУРСОВ...', 200, 200);
      return;
    }

    gameRef.current.monsters.forEach(m => drawMonster(ctx, m));
    drawHero(ctx, gameRef.current.player);

    if (gameState === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0,0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText('НАЖМИТЕ ДЛЯ СТАРТА', VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2);
    }

    if (gameState === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(50,0,0,0.8)';
      ctx.fillRect(0,0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = 'red';
      ctx.textAlign = 'center';
      ctx.fillText('ПОГИБ', VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2);
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
        className="relative border-4 border-primary overflow-hidden cursor-pointer"
        onClick={handleInput}
      >
        <canvas ref={canvasRef} width={VIRTUAL_WIDTH} height={VIRTUAL_HEIGHT} className="image-pixelated w-full h-auto max-w-[800px]" />
      </div>
      <div className="grid grid-cols-2 gap-8 w-full max-w-[800px] text-center">
        <div className="bg-muted p-4">
          <p className="text-[10px]">ДИСТАНЦИЯ</p>
          <p className="text-xl">{score}м</p>
        </div>
        <div className="bg-muted p-4">
          <p className="text-[10px]">РЕКОРД</p>
          <p className="text-xl">{highScore}м</p>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
