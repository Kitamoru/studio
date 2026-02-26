
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
    // Deep background
    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 1. Brick wall with parallax
    const p1 = offset * 0.3;
    const brickW = 80;
    const brickH = 40;
    for (let row = 0; row < GROUND_Y / brickH; row++) {
      const xOffset = (row % 2 === 0 ? 0 : brickW / 2) - (p1 % brickW);
      for (let x = xOffset - brickW; x < VIRTUAL_WIDTH + brickW; x += brickW) {
        const isDark = (Math.floor((x + p1) / brickW) + row) % 3 === 0;
        ctx.fillStyle = isDark ? '#1a1621' : '#14111a';
        ctx.fillRect(x, row * brickH, brickW - 2, brickH - 2);
        
        // Micro-shadows
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x, row * brickH + brickH - 4, brickW - 2, 2);
        ctx.fillRect(x + brickW - 4, row * brickH, 2, brickH - 2);
      }
    }

    // 2. Columns and Torches
    const p2 = offset * 0.6;
    const pillarSpacing = 300;
    for (let x = -(p2 % pillarSpacing); x < VIRTUAL_WIDTH + pillarSpacing; x += pillarSpacing) {
      // Column body
      drawPixelRect(ctx, x, 0, 48, GROUND_Y, '#2d2738');
      drawPixelRect(ctx, x + 4, 0, 6, GROUND_Y, '#3a3345'); // Highlight
      drawPixelRect(ctx, x + 38, 0, 10, GROUND_Y, '#1a1621'); // Shadow
      
      // Iron bracket
      const torchY = 160;
      const bracketX = x + 30;
      drawPixelRect(ctx, bracketX - 4, torchY + 10, 8, 12, '#1a1621'); // Base
      drawPixelRect(ctx, bracketX, torchY + 8, 16, 4, '#1a1621'); // Arm
      drawPixelRect(ctx, bracketX + 12, torchY, 12, 10, '#2d2738'); // Cup
      
      // Animated Flame
      const flicker = Math.sin(frameCount * 0.15) * 4;
      const torchBaseX = bracketX + 14;
      
      ctx.shadowBlur = 25 + flicker;
      ctx.shadowColor = 'rgba(255, 120, 0, 0.7)';
      drawPixelRect(ctx, torchBaseX - 2, torchY - 22 + flicker, 12, 24, '#ff4500'); // Outer
      drawPixelRect(ctx, torchBaseX, torchY - 18 + flicker, 8, 18, '#ff8c00'); // Mid
      drawPixelRect(ctx, torchBaseX + 2, torchY - 14 + flicker, 4, 12, '#ffff00'); // Core
      ctx.shadowBlur = 0;
    }

    // Floor
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, VIRTUAL_HEIGHT);
    groundGrad.addColorStop(0, '#2d2738');
    groundGrad.addColorStop(1, '#0a080d');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
    
    for (let x = -(offset % 80); x < VIRTUAL_WIDTH; x += 80) {
      drawPixelRect(ctx, x, GROUND_Y, 40, 2, 'rgba(255,255,255,0.08)');
    }
  };

  const drawHero = (ctx: CanvasRenderingContext2D, player: Player) => {
    const { x, y, width, height, frame } = player;
    const px = 2; // Pixel size unit
    const bounce = Math.sin(frame * 0.2) * 2;
    
    // 1. Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x + width/2, GROUND_Y, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Cape (Dynamic)
    const wave = Math.sin(frame * 0.15) * 4;
    drawPixelRect(ctx, x - px*2 + wave, y + px*8 + bounce, px*6, height - px*10, '#833440'); // Main cape
    drawPixelRect(ctx, x - px + wave, y + px*10 + bounce, px*4, height - px*12, '#5c242c'); // Cape inner shadow

    // 3. Legs
    drawPixelRect(ctx, x + px*6, y + height - px*8 + bounce, px*5, px*8, '#1a1621'); // Left leg
    drawPixelRect(ctx, x + width - px*11, y + height - px*8 + bounce, px*5, px*8, '#1a1621'); // Right leg

    // 4. Armor Body (Cuirass)
    drawPixelRect(ctx, x + px*5, y + px*12 + bounce, width - px*10, height - px*20, '#6980CC'); // Main steel
    drawPixelRect(ctx, x + px*6, y + px*13 + bounce, width - px*12, px*4, '#8fa1e0'); // Chest highlight
    drawPixelRect(ctx, x + px*5, y + px*20 + bounce, width - px*10, px*2, '#3a3345'); // Belt

    // 5. Pauldrons (Shoulders)
    drawPixelRect(ctx, x + px*2, y + px*10 + bounce, px*8, px*8, '#3a3345'); // Left
    drawPixelRect(ctx, x + width - px*10, y + px*10 + bounce, px*8, px*8, '#3a3345'); // Right

    // 6. Helmet
    drawPixelRect(ctx, x + px*8, y - px*4 + bounce, width - px*16, px*18, '#2d2738'); // Helm base
    drawPixelRect(ctx, x + px*9, y - px*3 + bounce, width - px*18, px*4, '#3a3345'); // Helm top light
    
    // Visor & Eyes
    drawPixelRect(ctx, x + px*8, y + px*4 + bounce, width - px*16, px*4, '#1a1621'); // Visor slit
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00FFFF';
    drawPixelRect(ctx, x + px*11, y + px*5 + bounce, px*3, px*2, '#00FFFF'); // Left eye
    drawPixelRect(ctx, x + px*18, y + px*5 + bounce, px*3, px*2, '#00FFFF'); // Right eye
    ctx.shadowBlur = 0;

    // 7. Plume (Feather)
    drawPixelRect(ctx, x + width/2 - px, y - px*10 + bounce, px*4, px*8, '#B33E3E');
    drawPixelRect(ctx, x + width/2, y - px*12 + bounce, px*2, px*4, '#B33E3E');

    // 8. Shield
    const shieldX = x + width - px*4;
    drawPixelRect(ctx, shieldX, y + px*12 + bounce, px*10, px*22, '#3a3345'); // Border
    drawPixelRect(ctx, shieldX + px, y + px*14 + bounce, px*6, px*18, '#6980CC'); // Center
    drawPixelRect(ctx, shieldX + px*2, y + px*16 + bounce, px*2, px*4, '#8fa1e0'); // Emblem/shine
  };

  const drawBeholder = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const time = gameRef.current.frameCount;
    
    // Body
    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#5c242c');
    drawPixelRect(ctx, m.x + px, m.y + px, m.width - px*2, m.height - px*2, '#833440');
    
    // Tentacles
    for (let i = 0; i < 3; i++) {
      const sx = m.x + (i * 15) + 5;
      const sy = m.y - 10 + Math.sin(time * 0.1 + i) * 5;
      drawPixelRect(ctx, sx, sy, 8, 10, '#5c242c');
      drawPixelRect(ctx, sx + 2, sy - 4, 4, 4, '#ff0000');
    }
    
    // Eye
    drawPixelRect(ctx, m.x + px*4, m.y + px*4, m.width - px*8, m.height - px*8, '#FFFFFF');
    const eyeY = Math.sin(time * 0.1) * 6;
    drawPixelRect(ctx, m.x + m.width/2 - px*3, m.y + m.height/2 - px*3 + eyeY, px*6, px*6, '#1a1621');
    drawPixelRect(ctx, m.x + m.width/2 - px, m.y + m.height/2 - px*2 + eyeY, px, px, '#ffffff');
  };

  const drawMimic = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const open = Math.abs(Math.sin(gameRef.current.frameCount * 0.04)) * 10;
    
    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#3a2115'); // Base
    drawPixelRect(ctx, m.x + px, m.y + px, m.width - px*2, m.height - px*2, '#5c3321'); // Wood
    
    // Iron bands
    drawPixelRect(ctx, m.x, m.y, px*3, m.height, '#1a1621');
    drawPixelRect(ctx, m.x + m.width - px*3, m.y, px*3, m.height, '#1a1621');
    
    // Mouth
    drawPixelRect(ctx, m.x + px, m.y + m.height/2 - px, m.width - px*2, open, '#000000');
    if (open > 4) {
      drawPixelRect(ctx, m.x + m.width/2 - px, m.y + m.height/2, px*3, open + 6, '#B33E3E'); // Tongue
      drawPixelRect(ctx, m.x + px*4, m.y + m.height/2, px*3, px*3, '#ffffff'); // Teeth
      drawPixelRect(ctx, m.x + m.width - px*7, m.y + m.height/2, px*3, px*3, '#ffffff');
    }
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const walk = Math.sin(gameRef.current.frameCount * 0.2) * 4;
    const color = m.isDashing ? '#ffcccc' : '#d0d0d0';
    
    drawPixelRect(ctx, m.x + px*6, m.y + walk, px*12, px*12, color); // Skull
    drawPixelRect(ctx, m.x + px*8, m.y + walk + px*4, px*3, px*3, '#FF0000'); // Eyes
    drawPixelRect(ctx, m.x + px*13, m.y + walk + px*4, px*3, px*3, '#FF0000');
    
    drawPixelRect(ctx, m.x + px*8, m.y + walk + px*14, px*8, px*12, color); // Ribs
    drawPixelRect(ctx, m.x + px*7, m.y + walk + px*16, px*10, px, '#1a1621');
    
    drawPixelRect(ctx, m.x - px*4, m.y + walk + px*18, px*14, px*4, '#5c5c5c'); // Sword
  };

  const drawSlime = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 2;
    const squash = Math.sin(gameRef.current.frameCount * 0.1) * 8;
    
    ctx.globalAlpha = 0.6;
    drawPixelRect(ctx, m.x, m.y + squash, m.width, m.height - squash, '#4CAF50');
    ctx.globalAlpha = 1.0;
    drawPixelRect(ctx, m.x + m.width/2 - px*2, m.y + m.height/2 + squash, px*5, px*5, '#2E7D32');
    drawPixelRect(ctx, m.x + px*4, m.y + px*6 + squash, px*3, px*3, '#ffffff');
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

    // Spawn logic
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

      if (type === 'BEHOLDER') mY = GROUND_Y - 120;
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
        const hoverRange = 30;
        m.y = (m.baseY || 0) + Math.sin(frameCount * 0.06 + (m.phase || 0)) * hoverRange;
      }
      
      if (m.type === 'SKELETON') {
        const d = m.x - player.x;
        if (d < 220 && d > 20) { m.speed = currentSpeed * 1.4; m.isDashing = true; }
        else { m.speed = currentSpeed; m.isDashing = false; }
      }

      m.x -= m.speed;

      // Collisions
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
    
    gameRef.current.monsters.forEach(m => {
      if (m.type === 'BEHOLDER') drawBeholder(ctx, m);
      else if (m.type === 'MIMIC') drawMimic(ctx, m);
      else if (m.type === 'SKELETON') drawSkeleton(ctx, m);
      else if (m.type === 'DRAGON') {
          drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#833440');
          drawPixelRect(ctx, m.x + m.width - 20, m.y - 12, 24, 24, '#5c242c');
      }
      else if (m.type === 'SLIME') drawSlime(ctx, m);
    });

    drawHero(ctx, gameRef.current.player);

    // Vignette
    const vig = ctx.createRadialGradient(VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2, 100, VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2, VIRTUAL_WIDTH);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.75)');
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
      ctx.fillText('CLICK TO START', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 50);
    }

    if (gameRef.current.state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(20,0,0,0.92)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#FF4444';
      ctx.font = '32px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('WASTED', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20);
      ctx.font = '12px "Press Start 2P"';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`SCORE: ${Math.floor(gameRef.current.score)}M`, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 30);
      ctx.fillText('CLICK TO RESTART', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 70);
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
            <span>DEPTH: {score}m</span>
            <span>SPEED: {((INITIAL_MONSTER_SPEED + (score / 60)) / INITIAL_MONSTER_SPEED).toFixed(1)}x</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 w-full gap-4">
        <div className="bg-[#1a1621] p-5 border-b-4 border-primary shadow-lg">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Current Depth</p>
          <p className="text-2xl text-white font-headline">{score}m</p>
        </div>
        <div className="bg-[#1a1621] p-5 border-b-4 border-secondary text-right shadow-lg">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Best Record</p>
          <p className="text-2xl text-secondary font-headline">{highScore}m</p>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
