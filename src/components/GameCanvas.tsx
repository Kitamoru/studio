"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, Player, Monster, MonsterType, TelegramUser } from '@/types/game';

const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 400;
const GRAVITY = 0.8;
const JUMP_STRENGTH = -14;
const GROUND_Y = 340;
const PLAYER_X = 120;
const INITIAL_MONSTER_SPEED = 5.5;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);

  const gameRef = useRef({
    player: { x: PLAYER_X, y: GROUND_Y - 48, width: 48, height: 48, vy: 0, isJumping: false, frame: 0 } as Player,
    monsters: [] as Monster[],
    particles: [] as Particle[],
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

  const drawTorch = (ctx: CanvasRenderingContext2D, x: number, y: number, flicker: number) => {
    const px = 3;
    drawPixelRect(ctx, x, y, px * 2, px * 4, '#3a324a'); 
    
    const grad = ctx.createRadialGradient(x + px, y - px, 2, x + px, y - px, 15 + flicker * 3);
    grad.addColorStop(0, 'rgba(255, 165, 0, 0.6)');
    grad.addColorStop(0.5, 'rgba(255, 69, 0, 0.3)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x + px, y - px, 20 + flicker * 4, 0, Math.PI * 2);
    ctx.fill();

    drawPixelRect(ctx, x + px / 2, y - px * 2 - flicker, px, px * 2 + flicker, '#FF4500');
    drawPixelRect(ctx, x + px, y - px - flicker, px / 2, px + flicker, '#FFFF00');
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, offset: number, frameCount: number) => {
    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    const p1 = offset * 0.15;
    const brickW = 80;
    const brickH = 40;
    for (let row = 0; row < GROUND_Y / brickH; row++) {
      const xOffset = (row % 2 === 0 ? 0 : brickW / 2) - (p1 % brickW);
      for (let x = xOffset - brickW; x < VIRTUAL_WIDTH + brickW; x += brickW) {
        const seed = Math.floor((x + p1) / brickW) + row;
        const variant = Math.abs(seed) % 6;
        ctx.fillStyle = '#08060a'; 
        ctx.fillRect(x, row * brickH, brickW, brickH);
        ctx.fillStyle = variant === 0 ? '#120f17' : '#16131c'; 
        ctx.fillRect(x + 1, row * brickH + 1, brickW - 2, brickH - 2);
        drawPixelRect(ctx, x + 2, row * brickH + 2, brickW - 4, 1, 'rgba(255,255,255,0.03)');
      }
    }

    const pCol = offset * 0.45;
    const flicker = Math.sin(frameCount * 0.15) * 2 + Math.random() * 1.5;
    for (let x = -(pCol % 400); x < VIRTUAL_WIDTH + 200; x += 400) {
      ctx.fillStyle = '#0d0b12'; 
      ctx.fillRect(x - 10, 0, 70, GROUND_Y);
      ctx.fillStyle = '#221e2b'; 
      ctx.fillRect(x, 0, 50, GROUND_Y);
      drawTorch(ctx, x + 22, 180, flicker);
    }

    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, VIRTUAL_HEIGHT);
    groundGrad.addColorStop(0, '#2d2738');
    groundGrad.addColorStop(1, '#0a080d');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
  };

  const drawHero = (ctx: CanvasRenderingContext2D, player: Player) => {
    const { x, y, width, height, isJumping, frame } = player;
    const px = 2; 
    const bounce = isJumping ? 0 : Math.sin(frame * 0.2) * 2;
    const legOffset = isJumping ? 0 : Math.sin(frame * 0.3) * 6;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + width/2, GROUND_Y, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const capeWarp = Math.sin(frame * 0.15) * 8;
    drawPixelRect(ctx, x - px*3 + capeWarp, y + px*8 + bounce, px*6, height - px*10, '#833440');

    drawPixelRect(ctx, x + px*6, y + height - px*6 + legOffset, px*5, px*6, '#1a1621');
    drawPixelRect(ctx, x + width - px*11, y + height - px*6 - legOffset, px*5, px*6, '#1a1621');

    const bodyY = y + px*10 + bounce;
    drawPixelRect(ctx, x + px*4, bodyY, width - px*8, px*16, '#6980CC'); 

    const headY = y + bounce + px;
    drawPixelRect(ctx, x + px*6, headY, width - px*12, px*10, '#2d2738'); 
    
    // Two Eyes
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00FFFF';
    drawPixelRect(ctx, x + width - px*15, headY + px*4, px*3, px*2, '#00FFFF');
    drawPixelRect(ctx, x + width - px*10, headY + px*4, px*3, px*2, '#00FFFF');
    ctx.shadowBlur = 0;

    const swordAnim = Math.sin(frame * 0.15) * 4;
    drawPixelRect(ctx, x + width - px*2, y + px*8 + swordAnim, px*3, px*22, '#E0E0E0'); 
  };

  const drawBeholder = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const time = gameRef.current.frameCount;
    
    const grad = ctx.createRadialGradient(m.x + m.width/2, m.y + m.height/2, 5, m.x + m.width/2, m.y + m.height/2, 60);
    grad.addColorStop(0, 'rgba(179, 62, 62, 0.4)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(m.x - 60, m.y - 60, m.width + 120, m.height + 120);

    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#833440');
    drawPixelRect(ctx, m.x + px*2, m.y + px*2, m.width - px*4, m.height - px*4, '#B33E3E');
    
    const eyeMovement = Math.sin(time * 0.08) * 8; 
    drawPixelRect(ctx, m.x + px*5, m.y + px*5, m.width - px*10, m.height - px*10, '#FFFFFF'); 
    
    const irisY = m.y + m.height/2 - px*4 + eyeMovement;
    drawPixelRect(ctx, m.x + m.width/2 - px*4, irisY, px*8, px*8, '#000000'); 
  };

  const drawMimic = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const time = gameRef.current.frameCount;
    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#5C3321');
    const mouthOpen = Math.abs(Math.sin(time * 0.05)) * 12;
    drawPixelRect(ctx, m.x + px*2, m.y + m.height/2 - px, m.width - px*4, mouthOpen, '#000000');
    const tongueLen = Math.sin(time * 0.08) * 15 + 10;
    drawPixelRect(ctx, m.x + m.width/2 - px*2, m.y + m.height/2 + 2, px*4, tongueLen, '#D44E5E');
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const time = gameRef.current.frameCount;
    const step = Math.sin(time * 0.4) * 10;
    const color = m.isDashing ? '#FFEBEE' : '#A0A0A0';
    
    drawPixelRect(ctx, m.x + px*6, m.y + px*8, m.width - px*12, px*12, color);
    const headY = m.y + Math.sin(time * 0.1) * 3;
    drawPixelRect(ctx, m.x + px*7, headY, px*10, px*10, '#F0F0F0');
    drawPixelRect(ctx, m.x + px*9, headY + px*3, px*2, px*2, '#FF0000');
    drawPixelRect(ctx, m.x + px*13, headY + px*3, px*2, px*2, '#FF0000');
  };

  const drawSlime = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const time = gameRef.current.frameCount;
    const wobble = Math.sin(time * 0.15) * 4;
    
    drawPixelRect(ctx, m.x, m.y + wobble, m.width, m.height - wobble, '#4CAF50');
    drawPixelRect(ctx, m.x + px*2, m.y + wobble + px*2, m.width - px*4, m.height - wobble - px*4, '#81C784');
    // Tiny eyes
    drawPixelRect(ctx, m.x + px*4, m.y + wobble + px*6, px*2, px*2, '#000000');
    drawPixelRect(ctx, m.x + m.width - px*6, m.y + wobble + px*6, px*2, px*2, '#000000');
  };

  const drawDragon = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const time = gameRef.current.frameCount;
    const hover = Math.sin(time * 0.1) * 20;
    const ry = m.y + hover;
    drawPixelRect(ctx, m.x, ry + px*10, m.width, px*12, '#5c242c'); 
    drawPixelRect(ctx, m.x + m.width + px*10, ry + px*2, px*12, px*12, '#833440'); 
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
    const { player, monsters, particles, state, lastSpawn, frameCount } = gameRef.current;
    if (state !== 'PLAYING') return;

    const currentSpeed = INITIAL_MONSTER_SPEED + (gameRef.current.score / 25);
    gameRef.current.bgOffset += currentSpeed;

    player.vy += GRAVITY;
    player.y += player.vy;
    player.frame++;

    if (player.y > GROUND_Y - player.height) {
      player.y = GROUND_Y - player.height;
      player.vy = 0;
      player.isJumping = false;
    }

    // Spawn Logic
    const baseSpawnRate = 90;
    const spawnThreshold = Math.max(25, baseSpawnRate - (gameRef.current.score / 6));
    
    if (frameCount - lastSpawn > spawnThreshold + Math.random() * 40) {
      const rand = Math.random();
      let type: MonsterType = 'MIMIC';
      
      if (gameRef.current.score > 400 && rand > 0.92) type = 'DRAGON';
      else if (gameRef.current.score > 200 && rand > 0.8) type = 'SKELETON';
      else if (gameRef.current.score > 100 && rand > 0.6) type = 'SLIME';
      else if (rand > 0.4) type = 'BEHOLDER';
      else type = 'MIMIC';

      let monsterY = GROUND_Y - 48;
      let width = 48;
      let height = 48;

      if (type === 'BEHOLDER') monsterY = GROUND_Y - 140; 
      if (type === 'DRAGON') { monsterY = GROUND_Y - 240; width = 80; }
      if (type === 'SLIME') { monsterY = GROUND_Y - 24; height = 24; }

      monsters.push({
        id: Math.random().toString(36).substr(2, 9),
        type,
        x: VIRTUAL_WIDTH,
        y: monsterY,
        width,
        height,
        speed: type === 'SLIME' ? currentSpeed * 0.6 : currentSpeed,
        phase: Math.random() * Math.PI * 2,
        baseY: monsterY
      });
      gameRef.current.lastSpawn = frameCount;
    }

    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      
      // Unique Mechanics
      if (m.type === 'SKELETON') {
        const dist = m.x - player.x;
        if (dist < 300 && dist > 100) {
          m.speed = currentSpeed * 1.8;
          m.isDashing = true;
        } else {
          m.speed = currentSpeed;
          m.isDashing = false;
        }
      }

      if (m.type === 'BEHOLDER') {
        const phase = (frameCount * 0.05) + (m.phase || 0);
        m.y = (m.baseY || 0) + Math.sin(phase) * 40; 
      }

      if (m.type === 'SLIME') {
        // Slimes are slow, creating grouping hazards
        m.speed = currentSpeed * 0.5;
      }

      m.x -= m.speed;

      // Collision
      const hitPadding = 12;
      if (
        player.x < m.x + m.width - hitPadding &&
        player.x + player.width - hitPadding > m.x &&
        player.y < m.y + m.height - hitPadding &&
        player.y + player.height - hitPadding > m.y
      ) {
        gameRef.current.state = 'GAME_OVER';
        setGameState('GAME_OVER');
        submitScore(Math.floor(gameRef.current.score));
        if (gameRef.current.score > highScore) setHighScore(Math.floor(gameRef.current.score));
      }

      if (m.x + m.width < 0) {
        monsters.splice(i, 1);
        gameRef.current.score += 5; 
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
    drawHero(ctx, gameRef.current.player);

    gameRef.current.monsters.forEach(m => {
      if (m.type === 'BEHOLDER') drawBeholder(ctx, m);
      else if (m.type === 'MIMIC') drawMimic(ctx, m);
      else if (m.type === 'SKELETON') drawSkeleton(ctx, m);
      else if (m.type === 'DRAGON') drawDragon(ctx, m);
      else if (m.type === 'SLIME') drawSlime(ctx, m);
    });

    const vignette = ctx.createRadialGradient(VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2, 100, VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2, VIRTUAL_WIDTH/1.1);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    if (gameRef.current.state === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '24px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('PIXELDUNGEON DASH', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    }

    if (gameRef.current.state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(20,0,0,0.9)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#FF4444';
      ctx.font = '28px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('WASTED', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20);
    }
  }, []);

  useEffect(() => {
    let animationId: number;
    const loop = () => {
      update();
      draw();
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [update, draw]);

  const handleInput = () => {
    if (gameRef.current.state === 'START' || gameRef.current.state === 'GAME_OVER') {
      gameRef.current.state = 'PLAYING';
      gameRef.current.monsters = [];
      gameRef.current.score = 0;
      gameRef.current.frameCount = 0;
      gameRef.current.player.y = GROUND_Y - 48;
      gameRef.current.player.vy = 0;
      gameRef.current.player.isJumping = false;
      setGameState('PLAYING');
      setScore(0);
    } else if (gameRef.current.state === 'PLAYING') {
      if (!gameRef.current.player.isJumping) {
        gameRef.current.player.vy = JUMP_STRENGTH;
        gameRef.current.player.isJumping = true;
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleInput();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto p-4 gap-8">
      <div 
        className="relative w-full aspect-[2/1] bg-[#0f0d12] border-8 border-[#2d2738] overflow-hidden cursor-pointer shadow-[0_0_80px_rgba(98,38,179,0.5)]"
        onClick={handleInput}
      >
        <canvas
          ref={canvasRef}
          width={VIRTUAL_WIDTH}
          height={VIRTUAL_HEIGHT}
          className="w-full h-full object-contain image-pixelated"
        />
        
        {gameState === 'PLAYING' && (
          <div className="absolute top-4 left-4 font-body text-[10px] text-primary/90">
            DEPTH: {score}m
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 w-full gap-4 px-2">
        <div className="bg-[#1a1621] p-5 border-l-4 border-primary">
          <p className="text-[8px] text-gray-500 uppercase mb-2">Current Depth</p>
          <p className="text-2xl text-white">{score}m</p>
        </div>
        <div className="bg-[#1a1621] p-5 border-l-4 border-secondary text-right">
          <p className="text-[8px] text-gray-500 uppercase mb-2">Record Depth</p>
          <p className="text-2xl text-secondary">{highScore}m</p>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
