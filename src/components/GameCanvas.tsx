
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
    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Параллакс кирпичей
    const p1 = offset * 0.3;
    const brickW = 80;
    const brickH = 40;
    for (let row = 0; row < GROUND_Y / brickH; row++) {
      const xOffset = (row % 2 === 0 ? 0 : brickW / 2) - (p1 % brickW);
      for (let x = xOffset - brickW; x < VIRTUAL_WIDTH + brickW; x += brickW) {
        const isAlt = (Math.floor((x + p1) / brickW) + row) % 2 === 0;
        ctx.fillStyle = isAlt ? '#1a1621' : '#14111a';
        ctx.fillRect(x, row * brickH, brickW - 2, brickH - 2);
        
        // Микро-блик для объема кирпича
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(x, row * brickH, brickW - 2, 1);
        ctx.fillRect(x, row * brickH, 1, brickH - 2);
      }
    }

    // Колонны и факелы
    const p2 = offset * 0.6;
    const pillarSpacing = 300;
    for (let x = -(p2 % pillarSpacing); x < VIRTUAL_WIDTH + pillarSpacing; x += pillarSpacing) {
      // Колонна
      drawPixelRect(ctx, x, 0, 48, GROUND_Y, '#2d2738');
      drawPixelRect(ctx, x + 4, 0, 6, GROUND_Y, '#3a3345');
      drawPixelRect(ctx, x + 38, 0, 10, GROUND_Y, '#1a1621');
      
      // Факел на кронштейне
      const torchY = 160;
      const bracketX = x + 30;
      drawPixelRect(ctx, bracketX - 6, torchY + 8, 12, 16, '#1a1621'); // Держатель
      drawPixelRect(ctx, bracketX, torchY + 4, 18, 6, '#1a1621'); // Плечо кронштейна
      drawPixelRect(ctx, bracketX + 14, torchY - 4, 14, 12, '#2d2738'); // Чаша
      drawPixelRect(ctx, bracketX + 12, torchY - 2, 18, 4, '#1a1621'); // Обод чаши
      
      // Пламя
      const flicker = Math.sin(frameCount * 0.15) * 4;
      const flameX = bracketX + 18;
      const flameY = torchY - 25 + flicker;
      
      ctx.shadowBlur = 25 + flicker;
      ctx.shadowColor = 'rgba(255, 120, 0, 0.7)';
      drawPixelRect(ctx, flameX - 4, flameY, 16, 24, '#ff4500'); // Внешнее пламя
      drawPixelRect(ctx, flameX - 2, flameY + 4, 12, 18, '#ff8c00'); // Ядро
      drawPixelRect(ctx, flameX + 2, flameY + 8, 4, 10, '#ffff00'); // Центр
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
    const { x, y, width, height, frame } = player;
    const px = 2; // Базовый размер пикселя для детализации
    
    const isOnGround = y >= GROUND_Y - height - 2;
    const time = frame;
    
    // Покачивание при беге
    const bounce = Math.sin(time * 0.2) * 3;
    const tilt = isOnGround ? Math.sin(time * 0.2) * 0.05 : 0;

    // Тень на земле
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    const jumpHeight = (GROUND_Y - (y + height));
    const shadowScale = Math.max(0.2, 1 - jumpHeight / 200);
    ctx.ellipse(x + width/2, GROUND_Y, 20 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Плащ (рисуется сзади)
    const capeY = y + px * 8 + bounce;
    for (let i = 0; i < 4; i++) {
        const layerOffset = i * px * 2;
        const wave = Math.sin(time * 0.12 - i * 0.6) * 10;
        const layerColor = i === 0 ? '#6B1E1E' : i === 1 ? '#8B2E2E' : i === 2 ? '#A33E3E' : '#B33E3E';
        drawPixelRect(ctx, x - px * 5 + wave + layerOffset, capeY + i * px, px * 8, height - px * 10 - i * px, layerColor);
    }

    // Ноги
    if (isOnGround) {
        const runCycle = time * 0.2;
        const lx1 = x + px * 6 + Math.sin(runCycle) * 12;
        const ly1 = y + height - px * 8 + Math.max(0, Math.cos(runCycle) * 6);
        const lx2 = x + px * 14 + Math.sin(runCycle + Math.PI) * 12;
        const ly2 = y + height - px * 8 + Math.max(0, Math.cos(runCycle + Math.PI) * 6);
        
        drawPixelRect(ctx, lx2, ly2, px * 6, px * 8, '#14111a'); // Дальняя нога
        drawPixelRect(ctx, lx1, ly1, px * 6, px * 8, '#25202d'); // Ближняя нога
    } else {
        // Поза прыжка
        drawPixelRect(ctx, x + px * 6, y + height - px * 6, px * 6, px * 8, '#1a1621');
        drawPixelRect(ctx, x + width - px * 14, y + height - px * 12, px * 6, px * 8, '#1a1621');
    }

    // Основная часть героя (корпус, голова)
    ctx.save();
    ctx.translate(x + width/2, y + height/2);
    ctx.rotate(tilt);
    ctx.translate(-(x + width/2), -(y + height/2));

    // Броня корпуса
    drawPixelRect(ctx, x + px * 3, y + px * 10 + bounce, width - px * 6, px * 18, '#4a5578');
    drawPixelRect(ctx, x + px * 4, y + px * 11 + bounce, width - px * 8, px * 8, '#5c6ba0');
    drawPixelRect(ctx, x + px * 5, y + px * 12 + bounce, px * 10, px * 2, '#a5b2e0');

    // Наплечники
    drawPixelRect(ctx, x + px * 1, y + px * 9 + bounce, px * 9, px * 8, '#3a3345');
    drawPixelRect(ctx, x + width - px * 10, y + px * 9 + bounce, px * 9, px * 8, '#3a3345');

    // Шлем с забралом
    const helmY = y - px * 10 + bounce;
    const helmW = width - px * 12;
    drawPixelRect(ctx, x + px * 6, helmY, helmW, px * 22, '#2d2738'); // База
    drawPixelRect(ctx, x + px * 8, helmY + px, helmW - px * 4, px * 4, '#3a3345'); // Блик сверху
    drawPixelRect(ctx, x + px * 5, helmY + px * 6, helmW + px * 2, px * 12, '#1a1621'); // Забрало база
    drawPixelRect(ctx, x + px * 6, helmY + px * 7, helmW, px * 10, '#3a3345'); // Забрало центр
    drawPixelRect(ctx, x + px * 7, helmY + px * 9, helmW - px * 2, px * 4, '#0a080d'); // Щель
    
    // Глаза
    const eyePulse = Math.abs(Math.sin(time * 0.1)) * 0.4 + 0.6;
    ctx.shadowBlur = 6 * eyePulse;
    ctx.shadowColor = '#00FFFF';
    drawPixelRect(ctx, x + px * 10, helmY + px * 10, px * 3, px * 2, '#00FFFF');
    drawPixelRect(ctx, x + px * 18, helmY + px * 10, px * 3, px * 2, '#00FFFF');
    ctx.shadowBlur = 0;

    // Плюмаж
    const plumeWave = Math.sin(time * 0.15) * 4;
    drawPixelRect(ctx, x + width/2 - px, helmY - px * 12 + plumeWave, px * 5, px * 14, '#8B2E2E');
    drawPixelRect(ctx, x + width/2 + px, helmY - px * 14 + plumeWave, px * 8, px * 8, '#B33E3E');

    // Щит (на другой руке, чуть смещен для объема)
    const shieldX = x + width - px * 8;
    const shieldY = y + px * 12 + bounce;
    drawPixelRect(ctx, shieldX, shieldY, px * 14, px * 20, '#2d2738');
    drawPixelRect(ctx, shieldX + px, shieldY + px, px * 12, px * 18, '#5c6ba0');
    drawPixelRect(ctx, shieldX + px * 2, shieldY + px * 2, px * 2, px * 2, '#a5b2e0'); // Блик

    ctx.restore();
  };

  const drawBeholder = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const time = gameRef.current.frameCount;
    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#5c242c');
    drawPixelRect(ctx, m.x + px, m.y + px, m.width - px*2, m.height - px*2, '#833440');
    for (let i = 0; i < 4; i++) {
      const sx = m.x + (i * 12) + 4;
      const wave = Math.sin(time * 0.1 + i) * 6;
      const sy = m.y - 12 + wave;
      drawPixelRect(ctx, sx, sy, 6, 12, '#5c242c');
      drawPixelRect(ctx, sx + 1, sy - 3, 4, 4, '#ff0000');
    }
    drawPixelRect(ctx, m.x + px*4, m.y + px*4, m.width - px*8, m.height - px*8, '#FFFFFF');
    const eyeY = Math.sin(time * 0.08) * 4;
    const eyeX = Math.cos(time * 0.05) * 3;
    drawPixelRect(ctx, m.x + m.width/2 - px*3 + eyeX, m.y + m.height/2 - px*3 + eyeY, px*6, px*6, '#1a1621');
  };

  const drawMimic = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const open = Math.abs(Math.sin(gameRef.current.frameCount * 0.02)) * 10;
    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#3a2115');
    drawPixelRect(ctx, m.x + px, m.y + px, m.width - px*2, m.height - px*2, '#5c3321');
    drawPixelRect(ctx, m.x + px, m.y + m.height/2 - px, m.width - px*2, open, '#000000');
    if (open > 2) drawPixelRect(ctx, m.x + m.width/2 - px, m.y + m.height/2, px*3, open + 4, '#B33E3E');
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const walk = Math.sin(gameRef.current.frameCount * 0.2) * 4;
    drawPixelRect(ctx, m.x + px*6, m.y + walk, px*12, px*12, '#d0d0d0');
    drawPixelRect(ctx, m.x + px*8, m.y + walk + px*4, px*3, px*3, '#FF0000');
    drawPixelRect(ctx, m.x + px*13, m.y + walk + px*4, px*3, px*3, '#FF0000');
    drawPixelRect(ctx, m.x + px*8, m.y + walk + px*14, px*8, px*12, '#d0d0d0');
  };

  const drawSlime = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const squash = Math.sin(gameRef.current.frameCount * 0.1) * 8;
    ctx.globalAlpha = 0.6;
    drawPixelRect(ctx, m.x, m.y + squash, m.width, m.height - squash, '#4CAF50');
    ctx.globalAlpha = 1.0;
    drawPixelRect(ctx, m.x + m.width/2 - px*2, m.y + m.height/2 + squash, px*5, px*5, '#2E7D32');
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

    const currentSpeed = INITIAL_MONSTER_SPEED + (gameRef.current.score / 60);
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

    const spawnRate = Math.max(40, 130 - (gameRef.current.score / 15));
    if (frameCount - lastSpawn > spawnRate + Math.random() * 60) {
      const rand = Math.random();
      let type: MonsterType = 'MIMIC';
      if (gameRef.current.score > 600 && rand > 0.92) type = 'DRAGON';
      else if (gameRef.current.score > 350 && rand > 0.78) type = 'SKELETON';
      else if (gameRef.current.score > 200 && rand > 0.58) type = 'SLIME';
      else if (rand > 0.3) type = 'BEHOLDER';

      let mY = GROUND_Y - 48;
      let mW = 48, mH = 48;

      if (type === 'BEHOLDER') mY = GROUND_Y - 130;
      if (type === 'DRAGON') { mY = GROUND_Y - 180; mW = 100; mH = 70; }
      if (type === 'SLIME') { mY = GROUND_Y - 24; mH = 24; }

      monsters.push({
        id: Math.random().toString(36).substr(2, 9),
        type,
        x: VIRTUAL_WIDTH,
        y: mY,
        width: mW,
        height: mH,
        speed: type === 'SLIME' ? currentSpeed * 0.75 : currentSpeed,
        phase: Math.random() * Math.PI * 2,
        baseY: mY
      });
      gameRef.current.lastSpawn = frameCount;
    }

    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      if (m.type === 'BEHOLDER') {
        const hoverRange = 40;
        m.y = (m.baseY || 0) + Math.sin(frameCount * 0.04 + (m.phase || 0)) * hoverRange;
      }
      if (m.type === 'SKELETON') {
        const d = m.x - player.x;
        if (d < 220 && d > 20) { m.speed = currentSpeed * 1.4; m.isDashing = true; }
        else { m.speed = currentSpeed; m.isDashing = false; }
      }
      m.x -= m.speed;

      const pad = 14;
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
    
    gameRef.current.monsters.forEach(m => {
      if (m.type === 'BEHOLDER') drawBeholder(ctx, m);
      else if (m.type === 'MIMIC') drawMimic(ctx, m);
      else if (m.type === 'SKELETON') drawSkeleton(ctx, m);
      else if (m.type === 'DRAGON') {
          drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#833440');
      }
      else if (m.type === 'SLIME') drawSlime(ctx, m);
    });

    drawHero(ctx, gameRef.current.player);

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
      ctx.fillText('НАЖМИТЕ ДЛЯ СТАРТА', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    }

    if (gameRef.current.state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(20,0,0,0.9)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#FF4444';
      ctx.font = '32px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('ПОГИБ', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20);
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
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Текущая глубина</p>
          <p className="text-2xl text-white font-headline">{score}м</p>
        </div>
        <div className="bg-[#1a1621] p-5 border-b-4 border-secondary text-right shadow-lg">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Лучший рекорд</p>
          <p className="text-2xl text-secondary font-headline">{highScore}м</p>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
