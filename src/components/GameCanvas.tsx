
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
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);

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

  const drawPixelRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, offset: number, frameCount: number) => {
    // Глубокий фон
    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 1. Кирпичная стена с параллаксом
    const p1 = offset * 0.3;
    const brickW = 80;
    const brickH = 40;
    for (let row = 0; row < GROUND_Y / brickH; row++) {
      const xOffset = (row % 2 === 0 ? 0 : brickW / 2) - (p1 % brickW);
      for (let x = xOffset - brickW; x < VIRTUAL_WIDTH + brickW; x += brickW) {
        const isDark = (Math.floor((x + p1) / brickW) + row) % 3 === 0;
        ctx.fillStyle = isDark ? '#1a1621' : '#14111a';
        ctx.fillRect(x, row * brickH, brickW - 2, brickH - 2);
        // Микро-тени для объема кирпича
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x, row * brickH + brickH - 4, brickW - 2, 2);
      }
    }

    // 2. Колонны и Факелы
    const p2 = offset * 0.6;
    const pillarSpacing = 300;
    for (let x = -(p2 % pillarSpacing); x < VIRTUAL_WIDTH + pillarSpacing; x += pillarSpacing) {
      // Тело колонны
      drawPixelRect(ctx, x, 0, 40, GROUND_Y, '#2d2738');
      drawPixelRect(ctx, x + 5, 0, 5, GROUND_Y, '#3a3345'); // блик
      drawPixelRect(ctx, x + 30, 0, 10, GROUND_Y, '#1a1621'); // тень
      
      // Крепление факела (Iron bracket)
      const torchY = 150;
      drawPixelRect(ctx, x + 8, torchY, 24, 6, '#1a1621'); // горизонтальная часть
      drawPixelRect(ctx, x + 24, torchY - 10, 6, 16, '#2d2738'); // держатель
      
      // Анимированное Пламя (Многослойное)
      const flicker = Math.sin(frameCount * 0.15) * 4;
      const flickerSize = Math.sin(frameCount * 0.2) * 2;
      
      ctx.shadowBlur = 20 + flicker;
      ctx.shadowColor = 'rgba(255, 140, 0, 0.6)';
      
      // Внешний слой пламени
      drawPixelRect(ctx, x + 20, torchY - 25 + flicker, 14, 20, '#ff4500');
      // Средний слой
      drawPixelRect(ctx, x + 23, torchY - 20 + flicker, 8, 14, '#ff8c00');
      // Ядро пламени
      drawPixelRect(ctx, x + 25, torchY - 15 + flicker, 4, 8, '#ffff00');
      
      ctx.shadowBlur = 0;
    }

    // Пол
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, VIRTUAL_HEIGHT);
    groundGrad.addColorStop(0, '#2d2738');
    groundGrad.addColorStop(1, '#0a080d');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
    
    // Блики на плитах пола
    for (let x = -(offset % 60); x < VIRTUAL_WIDTH; x += 60) {
      drawPixelRect(ctx, x, GROUND_Y, 30, 2, 'rgba(255,255,255,0.05)');
    }
  };

  const drawHero = (ctx: CanvasRenderingContext2D, player: Player) => {
    const { x, y, width, height, frame } = player;
    const px = 2;
    const bounce = Math.sin(frame * 0.2) * 2;
    
    // Тень под ногами
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + width/2, GROUND_Y, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Плащ с градиентом
    const capeWave = Math.sin(frame * 0.1) * 8;
    drawPixelRect(ctx, x - px*3 + capeWave, y + px*12 + bounce, px*6, height - px*14, '#833440'); // основной цвет
    drawPixelRect(ctx, x - px*2 + capeWave, y + px*14 + bounce, px*4, height - px*18, '#5c242c'); // тень на плаще

    // Броня (Кираса и наплечники)
    drawPixelRect(ctx, x + px*4, y + px*12 + bounce, width - px*8, height - px*18, '#6980CC'); 
    drawPixelRect(ctx, x + px*6, y + px*14 + bounce, px*4, px*4, '#8fa1e0'); // блик на груди
    
    // Шлем
    drawPixelRect(ctx, x + px*6, y + bounce, width - px*12, px*16, '#2d2738'); // база шлема
    drawPixelRect(ctx, x + px*6, y - px*4 + bounce, width - px*12, px*4, '#B33E3E'); // Плюмаж (перо)
    
    // Щит
    drawPixelRect(ctx, x + width - px*6, y + px*16 + bounce, px*4, px*16, '#3a3345');
    drawPixelRect(ctx, x + width - px*4, y + px*18 + bounce, px*2, px*12, '#6980CC');

    // Два горящих глаза в прорези шлема
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00FFFF';
    drawPixelRect(ctx, x + width - px*15, y + px*7 + bounce, px*3, px*3, '#00FFFF');
    drawPixelRect(ctx, x + width - px*9, y + px*7 + bounce, px*3, px*3, '#00FFFF');
    ctx.shadowBlur = 0;
  };

  const drawBeholder = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const time = gameRef.current.frameCount;
    
    // Тело классического Бихолдера
    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#5c242c');
    drawPixelRect(ctx, m.x + px, m.y + px, m.width - px*2, m.height - px*2, '#833440');
    
    // Щупальца (маленькие отростки сверху)
    for (let i = 0; i < 3; i++) {
      const sx = m.x + (i * 15) + 5;
      const sy = m.y - 10 + Math.sin(time * 0.1 + i) * 5;
      drawPixelRect(ctx, sx, sy, 8, 10, '#5c242c');
      drawPixelRect(ctx, sx + 2, sy - 4, 4, 4, '#ff0000'); // маленькие глазки на щупальцах
    }
    
    // Главный Глаз
    drawPixelRect(ctx, m.x + px*4, m.y + px*4, m.width - px*8, m.height - px*8, '#FFFFFF');
    const eyeY = Math.sin(time * 0.1) * 6;
    drawPixelRect(ctx, m.x + m.width/2 - px*3, m.y + m.height/2 - px*3 + eyeY, px*6, px*6, '#1a1621'); // зрачок
    drawPixelRect(ctx, m.x + m.width/2 - px, m.y + m.height/2 - px*2 + eyeY, px, px, '#ffffff'); // блик в зрачке
  };

  const drawMimic = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const open = Math.abs(Math.sin(gameRef.current.frameCount * 0.04)) * 10;
    
    // Деревянный сундук
    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#3a2115'); // база
    drawPixelRect(ctx, m.x + px, m.y + px, m.width - px*2, m.height - px*2, '#5c3321'); // дерево
    
    // Кованые ободы
    drawPixelRect(ctx, m.x, m.y, px*3, m.height, '#1a1621');
    drawPixelRect(ctx, m.x + m.width - px*3, m.y, px*3, m.height, '#1a1621');
    
    // Пасть
    drawPixelRect(ctx, m.x + px, m.y + m.height/2 - px, m.width - px*2, open, '#000000');
    if (open > 4) {
      // Язык мимика
      drawPixelRect(ctx, m.x + m.width/2 - px, m.y + m.height/2, px*3, open + 6, '#B33E3E');
      // Зубы
      drawPixelRect(ctx, m.x + px*4, m.y + m.height/2, px*2, px*2, '#ffffff');
      drawPixelRect(ctx, m.x + m.width - px*6, m.y + m.height/2, px*2, px*2, '#ffffff');
    }
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const walk = Math.sin(gameRef.current.frameCount * 0.2) * 4;
    const color = m.isDashing ? '#ffcccc' : '#d0d0d0';
    
    // Череп
    drawPixelRect(ctx, m.x + px*6, m.y + walk, px*10, px*10, color);
    // Глазницы
    drawPixelRect(ctx, m.x + px*8, m.y + walk + px*3, px*2, px*2, '#FF0000');
    drawPixelRect(ctx, m.x + px*12, m.y + walk + px*3, px*2, px*2, '#FF0000');
    
    // Грудная клетка
    drawPixelRect(ctx, m.x + px*8, m.y + walk + px*12, px*6, px*10, color);
    drawPixelRect(ctx, m.x + px*7, m.y + walk + px*14, px*8, px, '#1a1621'); // разрез ребер
    
    // Меч
    drawPixelRect(ctx, m.x - px*4, m.y + walk + px*16, px*12, px*3, '#5c5c5c');
  };

  const drawSlime = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const squash = Math.sin(gameRef.current.frameCount * 0.15) * 6;
    
    ctx.globalAlpha = 0.7;
    // Тело слизня
    drawPixelRect(ctx, m.x, m.y + squash, m.width, m.height - squash, '#4CAF50');
    // Ядро/пузырьки внутри
    ctx.globalAlpha = 1.0;
    drawPixelRect(ctx, m.x + m.width/2 - px*2, m.y + m.height/2 + squash, px*4, px*4, '#2E7D32');
    drawPixelRect(ctx, m.x + px*4, m.y + px*6 + squash, px*2, px*2, '#ffffff'); // блик
  };

  const drawDragon = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    // Тело дракона
    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#833440');
    drawPixelRect(ctx, m.x + m.width - px*8, m.y - px*4, px*10, px*10, '#5c242c'); // голова
    drawPixelRect(ctx, m.x + m.width - px*4, m.y, px*2, px*2, '#ffff00'); // глаз
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
    } catch (err) {}
  }, [telegramUser]);

  const update = useCallback(() => {
    const { player, monsters, state, lastSpawn, frameCount } = gameRef.current;
    if (state !== 'PLAYING') return;

    const currentSpeed = INITIAL_MONSTER_SPEED + (gameRef.current.score / 50);
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

    // Спавн монстров
    const spawnRate = Math.max(35, 120 - (gameRef.current.score / 12));
    if (frameCount - lastSpawn > spawnRate + Math.random() * 50) {
      const rand = Math.random();
      let type: MonsterType = 'MIMIC';
      if (gameRef.current.score > 500 && rand > 0.9) type = 'DRAGON';
      else if (gameRef.current.score > 300 && rand > 0.75) type = 'SKELETON';
      else if (gameRef.current.score > 150 && rand > 0.55) type = 'SLIME';
      else if (rand > 0.25) type = 'BEHOLDER';

      let mY = GROUND_Y - 48;
      let mW = 48, mH = 48;

      if (type === 'BEHOLDER') mY = GROUND_Y - 140; // Парят высоко для прохода снизу
      if (type === 'DRAGON') { mY = GROUND_Y - 180; mW = 90; mH = 60; }
      if (type === 'SLIME') { mY = GROUND_Y - 24; mH = 24; }

      monsters.push({
        id: Math.random().toString(36).substr(2, 9),
        type,
        x: VIRTUAL_WIDTH,
        y: mY,
        width: mW,
        height: mH,
        speed: type === 'SLIME' ? currentSpeed * 0.7 : currentSpeed,
        phase: Math.random() * 100,
        baseY: mY
      });
      gameRef.current.lastSpawn = frameCount;
    }

    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      
      // Логика парения Бихолдера
      if (m.type === 'BEHOLDER') {
        const hover = Math.sin(frameCount * 0.05 + (m.phase || 0)) * 40;
        m.y = (m.baseY || 0) + hover;
      }
      
      if (m.type === 'SKELETON') {
        const d = m.x - player.x;
        if (d < 200 && d > 20) { m.speed = currentSpeed * 1.5; m.isDashing = true; }
        else { m.speed = currentSpeed; m.isDashing = false; }
      }

      m.x -= m.speed;

      // Столкновения
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
        gameRef.current.score += 10;
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
    
    gameRef.current.monsters.forEach(m => {
      if (m.type === 'BEHOLDER') drawBeholder(ctx, m);
      else if (m.type === 'MIMIC') drawMimic(ctx, m);
      else if (m.type === 'SKELETON') drawSkeleton(ctx, m);
      else if (m.type === 'DRAGON') drawDragon(ctx, m);
      else if (m.type === 'SLIME') drawSlime(ctx, m);
    });

    drawHero(ctx, gameRef.current.player);

    // Виньетка и освещение
    const vig = ctx.createRadialGradient(VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2, 100, VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2, VIRTUAL_WIDTH);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    if (gameRef.current.state === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '24px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('PIXELDUNGEON DASH', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
      ctx.font = '12px "Press Start 2P"';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('CLICK TO START', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 40);
    }

    if (gameRef.current.state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(20,0,0,0.9)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#FF4444';
      ctx.font = '32px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('WASTED', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20);
      ctx.font = '12px "Press Start 2P"';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('CLICK TO RESTART', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 40);
    }
  }, []);

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
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); handleInput(); } };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [gameState]);

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto p-4 gap-6">
      <div 
        className="relative w-full aspect-[2/1] bg-[#0f0d12] border-4 border-[#2d2738] overflow-hidden cursor-pointer shadow-[0_0_50px_rgba(98,38,179,0.3)]"
        onClick={handleInput}
      >
        <canvas
          ref={canvasRef}
          width={VIRTUAL_WIDTH}
          height={VIRTUAL_HEIGHT}
          className="w-full h-full object-contain image-pixelated"
        />
        
        {gameState === 'PLAYING' && (
          <div className="absolute top-4 left-4 font-body text-[10px] text-primary/80">
            DEPTH: {score}m | SPEED: {((INITIAL_MONSTER_SPEED + (score / 50)) / INITIAL_MONSTER_SPEED).toFixed(1)}x
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 w-full gap-4">
        <div className="bg-[#1a1621] p-4 border-b-4 border-primary">
          <p className="text-[8px] text-gray-500 uppercase">Current</p>
          <p className="text-xl text-white">{score}m</p>
        </div>
        <div className="bg-[#1a1621] p-4 border-b-4 border-secondary text-right">
          <p className="text-[8px] text-gray-500 uppercase">Record</p>
          <p className="text-xl text-secondary">{highScore}m</p>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
