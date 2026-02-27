
"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, Player, Monster, MonsterType, TelegramUser } from '@/types/game';

const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 400;
const GRAVITY = 0.7;
const JUMP_STRENGTH = -12;
const GROUND_Y = 340;
const PLAYER_X = 120;
const INITIAL_MONSTER_SPEED = 5.0;

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const gameRef = useRef({
    player: { 
      x: PLAYER_X, 
      y: GROUND_Y - 48, 
      width: 48, 
      height: 48, 
      vy: 0, 
      isJumping: false, 
      jumpsRemaining: 2, 
      frame: 0 
    } as Player,
    monsters: [] as Monster[],
    bgOffset: 0,
    lastSpawn: 0,
    score: 0,
    state: 'START' as GameState,
    frameCount: 0,
  });

  // Инициализация Telegram WebApp
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      if (tg.initDataUnsafe?.user) {
        setTelegramUser(tg.initDataUnsafe.user);
      }
    }
  }, []);

  // Загрузка спрайта героя
  useEffect(() => {
    const img = new Image();
    img.src = '/prince.gif';
    
    img.onload = () => {
      console.log("Спрайт prince.gif успешно загружен!");
      playerImgRef.current = img;
      setIsImageLoaded(true);
      setLoadError(false);
    };

    img.onerror = () => {
      console.error("Не удалось загрузить /prince.gif. Проверьте путь: public/prince.gif");
      setLoadError(true);
      setIsImageLoaded(true); // Завершаем экран загрузки даже при ошибке
    };
  }, []);

  const drawPixelRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, offset: number, frameCount: number) => {
    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Дальние стены (параллакс)
    const p1 = offset * 0.3;
    const brickW = 80;
    const brickH = 40;
    for (let row = 0; row < GROUND_Y / brickH; row++) {
      const xOffset = (row % 2 === 0 ? 0 : brickW / 2) - (p1 % brickW);
      for (let x = xOffset - brickW; x < VIRTUAL_WIDTH + brickW; x += brickW) {
        const isAlt = (Math.floor((x + p1) / brickW) + row) % 2 === 0;
        ctx.fillStyle = isAlt ? '#1a1621' : '#14111a';
        ctx.fillRect(x, row * brickH, brickW - 2, brickH - 2);
      }
    }

    // Колонны и факелы
    const p2 = offset * 0.6;
    const pillarSpacing = 300;
    for (let x = -(p2 % pillarSpacing); x < VIRTUAL_WIDTH + pillarSpacing; x += pillarSpacing) {
      drawPixelRect(ctx, x, 0, 48, GROUND_Y, '#2d2738');
      
      const torchY = 160;
      const bracketX = x + 30;
      drawPixelRect(ctx, bracketX - 8, torchY + 12, 16, 20, '#110e14'); 
      drawPixelRect(ctx, bracketX - 4, torchY + 6, 26, 6, '#1a1621'); 
      
      const flicker = Math.sin(frameCount * 0.15) * 4;
      const flameX = bracketX + 22;
      const flameY = torchY - 22 + flicker;
      
      ctx.shadowBlur = 25 + flicker;
      ctx.shadowColor = 'rgba(255, 120, 0, 0.7)';
      drawPixelRect(ctx, flameX - 4, flameY, 16, 24, '#ff4500'); 
      drawPixelRect(ctx, flameX - 2, flameY + 4, 12, 18, '#ff8c00'); 
      ctx.shadowBlur = 0;
    }

    // Пол
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, VIRTUAL_HEIGHT);
    groundGrad.addColorStop(0, '#2d2738');
    groundGrad.addColorStop(1, '#0a080d');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
  };

  const drawHero = (ctx: CanvasRenderingContext2D, player: Player) => {
    const { x, y, width, height } = player;

    if (!loadError && playerImgRef.current) {
      // Рисуем спрайт из файла
      ctx.drawImage(playerImgRef.current, Math.floor(x), Math.floor(y), width, height);
    } else {
      // Запасной вариант (Программный Принц), если файл не найден
      const walk = Math.sin(gameRef.current.frameCount * 0.2) * 4;
      const jumpOffset = player.isJumping ? -5 : 0;
      
      // Плащ (фиолетовый)
      ctx.fillStyle = '#6226B3';
      const wave = Math.sin(gameRef.current.frameCount * 0.1) * 3;
      ctx.fillRect(x - 8, y + 16 + walk/2 + wave, 24, 28);
      
      // Тело (коричневое)
      drawPixelRect(ctx, x + 8, y + 12 + walk + jumpOffset, 28, 30, '#4a2c1d'); 
      // Рубашка (оранжевая)
      drawPixelRect(ctx, x + 12, y + 14 + walk + jumpOffset, 20, 10, '#ff8c00');
      // Голова/Волосы
      drawPixelRect(ctx, x + 14, y + 4 + walk + jumpOffset, 16, 16, '#f0d0a0'); 
      drawPixelRect(ctx, x + 12, y + 2 + walk + jumpOffset, 20, 8, '#d4af37');  
    }

    // Тень
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    const jumpHeight = (GROUND_Y - (y + height));
    const shadowScale = Math.max(0.2, 1 - jumpHeight / 200);
    ctx.ellipse(x + width/2, GROUND_Y, 16 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawMonster = (ctx: CanvasRenderingContext2D, m: Monster) => {
    if (m.type === 'BEHOLDER') {
      const px = 2;
      drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#833440');
      drawPixelRect(ctx, m.x + px*4, m.y + px*4, m.width - px*8, m.height - px*8, '#FFFFFF');
      drawPixelRect(ctx, m.x + m.width/2 - 4, m.y + m.height/2 - 4, 8, 8, '#1a1621');
    } else if (m.type === 'MIMIC') {
      drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#3a2115');
      drawPixelRect(ctx, m.x + 2, m.y + 2, m.width - 4, m.height - 4, '#5c3321');
    }
  };

  const submitScore = useCallback(async (finalScore: number) => {
    try {
      await fetch('/api/game/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: finalScore,
          userId: telegramUser?.id,
          username: telegramUser?.username || telegramUser?.first_name,
        }),
      });
    } catch (err) {
      console.error("Ошибка сохранения счета:", err);
    }
  }, [telegramUser]);

  const update = useCallback(() => {
    const { player, monsters, state, lastSpawn, frameCount } = gameRef.current;
    if (state !== 'PLAYING') return;

    const currentSpeed = INITIAL_MONSTER_SPEED + (gameRef.current.score / 100);
    gameRef.current.bgOffset += currentSpeed;

    player.vy += GRAVITY;
    player.y += player.vy;
    player.frame++;

    if (player.y > GROUND_Y - player.height) {
      player.y = GROUND_Y - player.height;
      player.vy = 0;
      player.isJumping = false;
      player.jumpsRemaining = 2;
    }

    const spawnRate = Math.max(40, 130 - (gameRef.current.score / 20));
    if (frameCount - lastSpawn > spawnRate + Math.random() * 60) {
      const type: MonsterType = Math.random() > 0.5 ? 'BEHOLDER' : 'MIMIC';
      const mY = type === 'BEHOLDER' ? GROUND_Y - 130 : GROUND_Y - 48;
      monsters.push({
        id: Math.random().toString(36).substr(2, 9),
        type,
        x: VIRTUAL_WIDTH,
        y: mY,
        width: 48,
        height: 48,
        speed: currentSpeed,
        phase: Math.random() * Math.PI * 2,
        baseY: mY
      });
      gameRef.current.lastSpawn = frameCount;
    }

    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      if (m.type === 'BEHOLDER') {
        m.y = (m.baseY || 0) + Math.sin(frameCount * 0.04 + (m.phase || 0)) * 40;
      }
      m.x -= m.speed;

      const pad = 12;
      if (
        player.x < m.x + m.width - pad &&
        player.x + player.width - pad > m.x &&
        player.y < m.y + m.height - pad &&
        player.y + player.height - pad > m.y
      ) {
        gameRef.current.state = 'GAME_OVER';
        setGameState('GAME_OVER');
        submitScore(Math.floor(gameRef.current.score));
        if (gameRef.current.score > highScore) setHighScore(Math.floor(gameRef.current.score));
      }

      if (m.x + m.width < 0) {
        monsters.splice(i, 1);
        gameRef.current.score += 15;
        setScore(Math.floor(gameRef.current.score));
      }
    }
    gameRef.current.frameCount++;
  }, [highScore, submitScore]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawBackground(ctx, gameRef.current.bgOffset, gameRef.current.frameCount);
    
    // Экран загрузки
    if (!isImageLoaded) {
      ctx.fillStyle = 'rgba(0,0,0,0.95)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '24px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('ЗАГРУЗКА РЕСУРСОВ...', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
      return;
    }

    gameRef.current.monsters.forEach(m => drawMonster(ctx, m));
    drawHero(ctx, gameRef.current.player);

    // Подсказка об ошибке (только в режиме ожидания или старта)
    if (loadError && gameRef.current.state !== 'PLAYING') {
      ctx.fillStyle = 'rgba(255, 68, 68, 0.9)';
      ctx.font = '10px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('ВНИМАНИЕ: ФАЙЛ /public/prince.gif НЕ НАЙДЕН', VIRTUAL_WIDTH / 2, 40);
      ctx.fillText('ИСПОЛЬЗУЕТСЯ ЗАПАСНОЙ ГЕРОЙ', VIRTUAL_WIDTH / 2, 60);
    }

    if (gameRef.current.state === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '20px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('НАЖМИТЕ ДЛЯ СТАРТА', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    }

    if (gameRef.current.state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(20,0,0,0.9)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#FF4444';
      ctx.font = '28px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('ПОГИБ', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20);
      ctx.font = '12px "Press Start 2P"';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('НАЖМИТЕ, ЧТОБЫ ПОВТОРИТЬ', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 30);
    }
  }, [isImageLoaded, loadError]);

  useEffect(() => {
    let aid: number;
    const loop = () => { update(); draw(); aid = requestAnimationFrame(loop); };
    aid = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(aid);
  }, [update, draw]);

  const handleInput = () => {
    const { player, state } = gameRef.current;
    if (state === 'START' || state === 'GAME_OVER') {
      gameRef.current.state = 'PLAYING';
      gameRef.current.monsters = [];
      gameRef.current.score = 0;
      gameRef.current.frameCount = 0;
      player.y = GROUND_Y - 48;
      player.vy = 0;
      player.isJumping = false;
      player.jumpsRemaining = 2;
      setGameState('PLAYING');
      setScore(0);
    } else if (state === 'PLAYING') {
      if (player.jumpsRemaining > 0) {
        player.vy = JUMP_STRENGTH;
        player.isJumping = true;
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
  }, []);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 gap-6">
      <div 
        className="relative w-full aspect-[2/1] bg-[#0f0d12] border-4 border-[#2d2738] overflow-hidden cursor-pointer shadow-[0_0_60px_rgba(98,38,179,0.35)]"
        onClick={handleInput}
      >
        <canvas
          ref={canvasRef}
          width={VIRTUAL_WIDTH}
          height={VIRTUAL_HEIGHT}
          className="w-full h-full object-contain image-pixelated"
        />
        
        {gameState === 'PLAYING' && (
          <div className="absolute top-4 left-4 font-body text-[10px] text-primary/90 flex flex-col gap-1">
            <span>ГЛУБИНА: {score}м</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 w-full gap-4">
        <div className="bg-[#1a1621] p-5 border-b-4 border-primary shadow-lg">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Глубина</p>
          <p className="text-2xl text-white font-headline">{score}м</p>
        </div>
        <div className="bg-[#1a1621] p-5 border-b-4 border-secondary text-right shadow-lg">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Рекорд</p>
          <p className="text-2xl text-secondary font-headline">{highScore}м</p>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
