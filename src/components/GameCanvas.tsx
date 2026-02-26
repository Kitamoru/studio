
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
    drawPixelRect(ctx, x, y, px * 2, px * 4, '#3a324a'); // Base
    
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

    // Far Wall bricks (Layer 1) - Improved Mortar and Depth
    const p1 = offset * 0.15;
    const brickW = 80;
    const brickH = 40;
    for (let row = 0; row < GROUND_Y / brickH; row++) {
      const xOffset = (row % 2 === 0 ? 0 : brickW / 2) - (p1 % brickW);
      for (let x = xOffset - brickW; x < VIRTUAL_WIDTH + brickW; x += brickW) {
        const seed = Math.floor((x + p1) / brickW) + row;
        const variant = Math.abs(seed) % 6;
        
        // Brick Shadow/Mortar
        ctx.fillStyle = '#08060a'; 
        ctx.fillRect(x, row * brickH, brickW, brickH);
        
        // Brick Body
        ctx.fillStyle = variant === 0 ? '#120f17' : '#16131c'; 
        ctx.fillRect(x + 1, row * brickH + 1, brickW - 2, brickH - 2);
        
        // Highlights on top/left edges
        drawPixelRect(ctx, x + 2, row * brickH + 2, brickW - 4, 1, 'rgba(255,255,255,0.03)');
        drawPixelRect(ctx, x + 2, row * brickH + 2, 1, brickH - 4, 'rgba(255,255,255,0.03)');
      }
    }

    // Mid Wall Columns (Layer 2)
    const pCol = offset * 0.45;
    const flicker = Math.sin(frameCount * 0.15) * 2 + Math.random() * 1.5;
    for (let x = -(pCol % 400); x < VIRTUAL_WIDTH + 200; x += 400) {
      ctx.fillStyle = '#0d0b12'; 
      ctx.fillRect(x - 10, 0, 70, GROUND_Y);
      
      ctx.fillStyle = '#221e2b'; 
      ctx.fillRect(x, 0, 50, GROUND_Y);
      
      ctx.fillStyle = '#2d2738';
      ctx.fillRect(x + 5, 0, 10, GROUND_Y);
      ctx.fillRect(x + 35, 0, 10, GROUND_Y);

      ctx.fillStyle = '#3a324a';
      ctx.fillRect(x - 5, 50, 60, 15);
      ctx.fillRect(x - 5, GROUND_Y - 65, 60, 15);
      
      drawTorch(ctx, x + 22, 180, flicker);
    }

    // Ground
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, VIRTUAL_HEIGHT);
    groundGrad.addColorStop(0, '#2d2738');
    groundGrad.addColorStop(0.1, '#1a1621');
    groundGrad.addColorStop(1, '#0a080d');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);

    const p3 = offset % 64;
    for (let x = -p3; x < VIRTUAL_WIDTH + 64; x += 64) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(x + 10, GROUND_Y + 10, 44, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 12, GROUND_Y + 30, 40, 2);
    }
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
    drawPixelRect(ctx, x - px*2 + capeWarp, y + px*10 + bounce, px*3, height - px*14, '#5c242c');

    drawPixelRect(ctx, x + px*6, y + height - px*6 + legOffset, px*5, px*6, '#1a1621');
    drawPixelRect(ctx, x + width - px*11, y + height - px*6 - legOffset, px*5, px*6, '#1a1621');

    const bodyY = y + px*10 + bounce;
    drawPixelRect(ctx, x + px*4, bodyY, width - px*8, px*16, '#6980CC'); 
    drawPixelRect(ctx, x + px*5, bodyY + px, width - px*10, px*2, '#87a2ff'); 
    drawPixelRect(ctx, x + px*4, bodyY + px*12, width - px*8, px*2, '#4a598c'); 
    
    drawPixelRect(ctx, x + px*3, bodyY + px*8, width - px*6, px*3, '#332a1e');
    drawPixelRect(ctx, x + width/2 - px, bodyY + px*8, px*2, px*3, '#FFD700'); 

    drawPixelRect(ctx, x - px, bodyY + px*2, px*8, px*12, '#4A3B52');
    drawPixelRect(ctx, x, bodyY + px*3, px*6, px*10, '#6980CC');
    drawPixelRect(ctx, x + px*2, bodyY + px*4, px*2, px*2, '#87a2ff');

    const headY = y + bounce + px;
    drawPixelRect(ctx, x + px*6, headY, width - px*12, px*10, '#2d2738'); 
    drawPixelRect(ctx, x + px*7, headY + px, width - px*14, px*8, '#4A3B52'); 
    
    drawPixelRect(ctx, x + px*10, headY - px*4, px*6, px*4, '#B33E3E');
    drawPixelRect(ctx, x + px*12, headY - px*7, px*4, px*4, '#FF4500');

    // Visor Eye Glow - Two Distinct Eyes
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00FFFF';
    drawPixelRect(ctx, x + width - px*15, headY + px*4, px*3, px*2, '#00FFFF');
    drawPixelRect(ctx, x + width - px*10, headY + px*4, px*3, px*2, '#00FFFF');
    ctx.shadowBlur = 0;

    const swordAnim = Math.sin(frame * 0.15) * 4;
    const swordX = x + width - px*2;
    const swordY = y + px*8 + swordAnim;
    drawPixelRect(ctx, swordX, swordY, px*3, px*22, '#E0E0E0'); 
    drawPixelRect(ctx, swordX + px, swordY, px, px*18, '#FFFFFF'); 
    drawPixelRect(ctx, swordX - px*2, swordY + px*18, px*7, px*3, '#5C3321'); 
    drawPixelRect(ctx, swordX + px, swordY + px*21, px*2, px*4, '#3d2216'); 
  };

  const drawBeholder = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const time = gameRef.current.frameCount;
    
    const grad = ctx.createRadialGradient(m.x + m.width/2, m.y + m.height/2, 5, m.x + m.width/2, m.y + m.height/2, 60);
    grad.addColorStop(0, 'rgba(179, 62, 62, 0.4)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(m.x - 60, m.y - 60, m.width + 120, m.height + 120);

    for (let i = 0; i < 4; i++) {
      const angle = (time * 0.05) + (i * Math.PI / 2);
      const sx = m.x + m.width/2 + Math.cos(angle) * 30;
      const sy = m.y + m.height/2 + Math.sin(angle) * 30;
      drawPixelRect(ctx, sx - px, sy - px, px*4, px*4, '#833440');
      drawPixelRect(ctx, sx, sy, px*2, px*2, '#FFFFFF'); 
    }

    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#833440');
    drawPixelRect(ctx, m.x + px*2, m.y + px*2, m.width - px*4, m.height - px*4, '#B33E3E');
    
    const eyeMovement = Math.sin(time * 0.08) * 8; 
    drawPixelRect(ctx, m.x + px*5, m.y + px*5, m.width - px*10, m.height - px*10, '#FFFFFF'); 
    
    const irisX = m.x + m.width/2 - px*4;
    const irisY = m.y + m.height/2 - px*4 + eyeMovement;
    drawPixelRect(ctx, irisX, irisY, px*8, px*8, '#330000'); 
    drawPixelRect(ctx, irisX + px, irisY + px, px*6, px*6, '#000000'); 
    drawPixelRect(ctx, irisX + px*2, irisY + px*2, px*2, px*2, '#FFFFFF'); 
  };

  const drawMimic = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const time = gameRef.current.frameCount;

    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#5C3321');
    
    for(let i=0; i<m.width; i+=8) {
        drawPixelRect(ctx, m.x + i, m.y + 4, 4, m.height - 8, '#4d2a1c');
    }

    drawPixelRect(ctx, m.x, m.y, px*3, m.height, '#2d2738');
    drawPixelRect(ctx, m.x + m.width - px*3, m.y, px*3, m.height, '#2d2738');
    drawPixelRect(ctx, m.x, m.y + m.height/2 - px, m.width, px*3, '#2d2738');

    // Mouth - Slowed down significantly for better retro feel
    const mouthOpen = Math.abs(Math.sin(time * 0.05)) * 12;
    drawPixelRect(ctx, m.x + px*2, m.y + m.height/2 - px, m.width - px*4, mouthOpen, '#000000');
    
    if (mouthOpen > 4) {
      for (let i = 0; i < 5; i++) {
        drawPixelRect(ctx, m.x + px*4 + i*8, m.y + m.height/2 - px, px*2, px*3, '#FFFFFF');
      }
    }

    const tongueLen = Math.sin(time * 0.08) * 15 + 10;
    drawPixelRect(ctx, m.x + m.width/2 - px*2, m.y + m.height/2 + 2, px*4, tongueLen, '#D44E5E');
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const time = gameRef.current.frameCount;
    const step = Math.sin(time * 0.4) * 10;
    
    drawPixelRect(ctx, m.x + px*6, m.y + px*8, m.width - px*12, px*12, '#A0A0A0');
    for(let i=0; i<3; i++) {
        drawPixelRect(ctx, m.x + px*7, m.y + px*10 + i*4, m.width - px*14, px, '#707070');
    }

    const headY = m.y + Math.sin(time * 0.1) * 3;
    drawPixelRect(ctx, m.x + px*7, headY, px*10, px*10, '#F0F0F0');
    ctx.fillStyle = '#FF0000';
    drawPixelRect(ctx, m.x + px*9, headY + px*3, px*2, px*2, '#FF0000');
    drawPixelRect(ctx, m.x + px*13, headY + px*3, px*2, px*2, '#FF0000');

    drawPixelRect(ctx, m.x + px*4, m.y + m.height - px*8 + step, px*4, px*8, '#E0E0E0');
    drawPixelRect(ctx, m.x + m.width - px*8, m.y + m.height - px*8 - step, px*4, px*8, '#E0E0E0');

    drawPixelRect(ctx, m.x - px*4, m.y + px*12 + step/2, px*4, px*16, '#8b4513');
    drawPixelRect(ctx, m.x - px*3, m.y + px*12 + step/2, px, px*14, '#a0522d');
  };

  const drawDragon = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const time = gameRef.current.frameCount;
    const hover = Math.sin(time * 0.1) * 20;
    const ry = m.y + hover;
    const wingY = Math.sin(time * 0.2) * 25;

    drawPixelRect(ctx, m.x, ry + px*10, m.width, px*12, '#5c242c'); 
    for(let i=0; i<m.width; i+=10) {
        drawPixelRect(ctx, m.x + i, ry + px*12, px*2, px*2, '#3a161b');
    }

    drawPixelRect(ctx, m.x - px*10, ry - wingY, px*15, px*20, '#833440'); 
    drawPixelRect(ctx, m.x + m.width - px*5, ry - wingY, px*15, px*20, '#833440'); 

    drawPixelRect(ctx, m.x + m.width, ry + px*8, px*14, px*8, '#5c242c'); 
    const headX = m.x + m.width + px*10;
    drawPixelRect(ctx, headX, ry + px*2, px*12, px*12, '#833440'); 
    drawPixelRect(ctx, headX + px*2, ry - px*4, px*3, px*6, '#3a161b');
    drawPixelRect(ctx, headX + px*8, ry + px*5, px*2, px*2, '#FFFF00'); 
    
    drawPixelRect(ctx, m.x - px*15, ry + px*12, px*15, px*6, '#5c242c');
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

    if (frameCount % 6 === 0) {
      particles.push({
        x: VIRTUAL_WIDTH,
        y: Math.random() * VIRTUAL_HEIGHT,
        vx: -(currentSpeed * 0.7 + Math.random() * 2),
        vy: (Math.random() - 0.5) * 0.4,
        life: 1,
        color: 'rgba(255,255,255,0.08)'
      });
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= 0.006;
      if (p.life <= 0 || p.x < -10) particles.splice(i, 1);
    }

    const baseSpawnRate = 90;
    const spawnThreshold = Math.max(20, baseSpawnRate - (gameRef.current.score / 5));
    
    if (frameCount - lastSpawn > spawnThreshold + Math.random() * 35) {
      const rand = Math.random();
      let type: MonsterType = 'MIMIC';
      
      if (gameRef.current.score > 300 && rand > 0.88) type = 'DRAGON';
      else if (gameRef.current.score > 150 && rand > 0.75) type = 'SKELETON';
      else if (gameRef.current.score > 50 && rand > 0.4) type = 'BEHOLDER';
      else if (rand > 0.7) type = 'BEHOLDER';
      else type = 'MIMIC';

      let monsterY = GROUND_Y - 48;
      // Fixed: Beholders occupy the "Air" lane to be fair and predictable
      if (type === 'BEHOLDER') monsterY = GROUND_Y - 180;
      if (type === 'DRAGON') monsterY = GROUND_Y - 240;

      monsters.push({
        id: Math.random().toString(36).substr(2, 9),
        type,
        x: VIRTUAL_WIDTH,
        y: monsterY,
        width: type === 'DRAGON' ? 80 : 48,
        height: 48,
        speed: type === 'SKELETON' ? currentSpeed * 1.4 : currentSpeed,
      });
      gameRef.current.lastSpawn = frameCount;
    }

    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      m.x -= m.speed;
      
      if (m.type === 'BEHOLDER') {
        const seed = parseInt(m.id.slice(0, 4), 36) || 0;
        // Adjusted vertical movement: Predictable wave above player height
        const phase = (frameCount * 0.04) + (seed % 100);
        const amplitude = 80; 
        const midY = GROUND_Y - 200;
        m.y = midY + Math.sin(phase) * amplitude;
      }

      const hitBoxPadding = m.type === 'BEHOLDER' ? 18 : 12;
      if (
        player.x < m.x + m.width - hitBoxPadding &&
        player.x + player.width - hitBoxPadding > m.x &&
        player.y < m.y + m.height - hitBoxPadding &&
        player.y + player.height - hitBoxPadding > m.y
      ) {
        gameRef.current.state = 'GAME_OVER';
        setGameState('GAME_OVER');
        submitScore(Math.floor(gameRef.current.score));
        if (gameRef.current.score > highScore) setHighScore(Math.floor(gameRef.current.score));
      }

      if (m.x + m.width < 0) {
        monsters.splice(i, 1);
        gameRef.current.score += 2; 
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

    gameRef.current.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2, 2);
    });

    drawHero(ctx, gameRef.current.player);

    gameRef.current.monsters.forEach(m => {
      if (m.type === 'BEHOLDER') drawBeholder(ctx, m);
      else if (m.type === 'MIMIC') drawMimic(ctx, m);
      else if (m.type === 'SKELETON') drawSkeleton(ctx, m);
      else if (m.type === 'DRAGON') drawDragon(ctx, m);
    });

    const vignette = ctx.createRadialGradient(VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2, 100, VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2, VIRTUAL_WIDTH/1.1);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    if (gameRef.current.state === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '24px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('PIXELDUNGEON DASH', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px "Press Start 2P"';
      ctx.fillText('CLICK OR SPACE TO START', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 40);
    }

    if (gameRef.current.state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(20,0,0,0.92)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#FF4444';
      ctx.font = '28px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('WASTED', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 40);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px "Press Start 2P"';
      ctx.fillText(`DEPTH: ${Math.floor(gameRef.current.score)}m`, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 10);
      ctx.font = '10px "Press Start 2P"';
      ctx.fillText('CLICK TO RESPAWN', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 60);
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
      gameRef.current.particles = [];
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
        className="relative w-full aspect-[2/1] bg-[#0f0d12] border-8 border-[#2d2738] overflow-hidden cursor-pointer shadow-[0_0_80px_rgba(98,38,179,0.5)] rounded-sm"
        onClick={handleInput}
      >
        <canvas
          ref={canvasRef}
          width={VIRTUAL_WIDTH}
          height={VIRTUAL_HEIGHT}
          className="w-full h-full object-contain image-pixelated"
        />
        
        {gameState === 'PLAYING' && (
          <div className="absolute top-4 left-4 font-body text-[10px] text-primary/90 animate-pulse drop-shadow-md">
            DEPTH: {score}m | SPEED: {(INITIAL_MONSTER_SPEED + (score / 25)).toFixed(1)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 w-full gap-4 px-2">
        <div className="bg-[#1a1621] p-5 border-l-4 border-primary shadow-lg">
          <p className="text-[8px] text-gray-500 uppercase mb-2 tracking-tighter">Current Depth</p>
          <p className="text-2xl text-white glow-text">{score}m</p>
        </div>
        <div className="bg-[#1a1621] p-5 border-l-4 border-secondary text-right shadow-lg">
          <p className="text-[8px] text-gray-500 uppercase mb-2 tracking-tighter">Record Depth</p>
          <p className="text-2xl text-secondary">{highScore}m</p>
        </div>
      </div>

      {telegramUser && (
        <div className="flex items-center gap-4 bg-[#1a1621] px-8 py-3 border border-[#2d2738] shadow-inner">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]" />
          <span className="text-[10px] text-gray-300 tracking-wider">KNIGHT: {telegramUser.first_name?.toUpperCase()}</span>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
