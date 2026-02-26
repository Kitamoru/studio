
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
    const flameSize = px * 2 + flicker;
    const grad = ctx.createRadialGradient(x + px, y - px, 2, x + px, y - px, 15 + flicker * 2);
    grad.addColorStop(0, '#FFA500');
    grad.addColorStop(0.5, 'rgba(255, 69, 0, 0.5)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x + px, y - px, 15 + flicker * 2, 0, Math.PI * 2);
    ctx.fill();
    drawPixelRect(ctx, x + px / 2, y - px * 2 - flicker, px, px * 2 + flicker, '#FF4500');
    drawPixelRect(ctx, x + px, y - px - flicker, px / 2, px + flicker, '#FFFF00');
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, offset: number, frameCount: number) => {
    ctx.fillStyle = '#0f0d12';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Far bricks (Parallax layer 1) - Natural staggered look
    const p1 = offset * 0.15;
    const brickW = 60;
    const brickH = 30;
    for (let row = 0; row < GROUND_Y / brickH; row++) {
      const xOffset = (row % 2 === 0 ? 0 : brickW / 2) - (p1 % brickW);
      for (let x = xOffset - brickW; x < VIRTUAL_WIDTH + brickW; x += brickW) {
        const variant = Math.abs(Math.floor((x + p1) / brickW) + row) % 5;
        ctx.fillStyle = variant === 0 ? '#14111a' : '#1a1621'; 
        ctx.fillRect(x, row * brickH, brickW, brickH);
        
        // Brick borders/cracks with subtle depth
        ctx.strokeStyle = '#08060a';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, row * brickH, brickW, brickH);
        
        // Highlights on the edges
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.fillRect(x + 1, row * brickH + 1, brickW - 2, 1);
        ctx.fillRect(x + 1, row * brickH + 1, 1, brickH - 2);
      }
    }

    // Mid bricks (Parallax layer 2)
    const p2 = offset * 0.4;
    const mBrickW = 80;
    const mBrickH = 40;
    for (let row = 0; row < GROUND_Y / mBrickH; row++) {
      const xOffset = (row % 2 === 0 ? 0 : mBrickW / 2) - (p2 % mBrickW);
      for (let x = xOffset - mBrickW; x < VIRTUAL_WIDTH + mBrickW; x += mBrickW) {
        ctx.fillStyle = '#25202d';
        ctx.fillRect(x + 2, row * mBrickH + 2, mBrickW - 4, mBrickH - 4);
        
        ctx.fillStyle = '#2d2738';
        ctx.fillRect(x + 2, row * mBrickH + 2, mBrickW - 4, 2);
        ctx.fillRect(x + 2, row * mBrickH + 2, 2, mBrickH - 4);
        
        // Darker bottom edge
        ctx.fillStyle = '#1a1621';
        ctx.fillRect(x + 2, (row + 1) * mBrickH - 4, mBrickW - 4, 2);
      }
    }

    // Columns and Torches
    const pCol = offset * 0.6;
    const flicker = Math.sin(frameCount * 0.2) * 2 + Math.random() * 2;
    for (let x = -(pCol % 400); x < VIRTUAL_WIDTH + 200; x += 400) {
      ctx.fillStyle = '#1a1621'; 
      ctx.fillRect(x - 5, 0, 50, GROUND_Y);
      ctx.fillStyle = '#2d2738'; 
      ctx.fillRect(x, 0, 40, GROUND_Y);
      
      ctx.fillStyle = '#3a324a';
      ctx.fillRect(x, 40, 40, 10);
      ctx.fillRect(x, GROUND_Y - 50, 40, 10);
      
      drawTorch(ctx, x + 17, 150, flicker);
    }

    // Ground
    const grad = ctx.createLinearGradient(0, GROUND_Y, 0, VIRTUAL_HEIGHT);
    grad.addColorStop(0, '#362a3d');
    grad.addColorStop(1, '#0f0d12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);

    // Ground texture
    const p3 = offset % 60;
    ctx.fillStyle = '#25202d';
    for (let x = -p3; x < VIRTUAL_WIDTH + 60; x += 60) {
      ctx.fillRect(x + 10, GROUND_Y + 15, 30, 4);
      ctx.fillRect(x + 40, GROUND_Y + 40, 15, 3);
    }
  };

  const drawHero = (ctx: CanvasRenderingContext2D, player: Player) => {
    const { x, y, width, height, isJumping, frame } = player;
    const px = 3; 
    const bounce = isJumping ? 0 : Math.sin(frame * 0.2) * 3;
    const legOffset = isJumping ? 0 : Math.sin(frame * 0.3) * 4;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x + width/2, GROUND_Y, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const capeWarp = Math.sin(frame * 0.15) * 6;
    drawPixelRect(ctx, x - px + capeWarp, y + px*6 + bounce, px*4, height - px*8, '#833440');
    drawPixelRect(ctx, x - px*2 + capeWarp, y + px*9 + bounce, px*2, height - px*11, '#5c242c');

    drawPixelRect(ctx, x + px*4, y + height - px*4 + legOffset, px*3, px*4, '#1a1621');
    drawPixelRect(ctx, x + width - px*7, y + height - px*4 - legOffset, px*3, px*4, '#1a1621');

    drawPixelRect(ctx, x + px*3, y + px*6 + bounce, width - px*6, height - px*10, '#6980CC');
    drawPixelRect(ctx, x + px*4, y + px*7 + bounce, width - px*10, px*4, '#87a2ff'); 

    drawPixelRect(ctx, x - px*2, y + px*9 + bounce, px*4, px*12, '#4A3B52');
    drawPixelRect(ctx, x - px, y + px*10 + bounce, px*2, px*10, '#6980CC');

    drawPixelRect(ctx, x + px*4, y + bounce, width - px*8, px*8, '#2d2738');
    drawPixelRect(ctx, x + px*5, y + px + bounce, width - px*10, px*6, '#4A3B52');
    
    drawPixelRect(ctx, x + px*7, y - px*2 + bounce, px*4, px*2, '#B33E3E');
    drawPixelRect(ctx, x + px*9, y - px*4 + bounce, px*3, px*2, '#FF4500');

    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00FFFF';
    drawPixelRect(ctx, x + width - px*8, y + px*4 + bounce, px, px, '#00FFFF');
    ctx.shadowBlur = 0;

    const swordAnim = Math.sin(frame * 0.15) * 3;
    drawPixelRect(ctx, x + width - px, y + px*5 + swordAnim, px*2, px*14, '#E0E0E0');
    drawPixelRect(ctx, x + width, y + px*5 + swordAnim, px, px*12, '#FFFFFF'); 
    drawPixelRect(ctx, x + width - px*2, y + px*14 + swordAnim, px*4, px*2, '#5C3321'); 
  };

  const drawBeholder = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 3;
    const eyeMovement = Math.sin(gameRef.current.frameCount * 0.2) * 8; 

    const grad = ctx.createRadialGradient(m.x + m.width/2, m.y + m.height/2, 5, m.x + m.width/2, m.y + m.height/2, 50);
    grad.addColorStop(0, 'rgba(179, 62, 62, 0.4)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(m.x - 50, m.y - 50, m.width + 100, m.height + 100);

    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#833440');
    drawPixelRect(ctx, m.x + px, m.y + px, m.width - px*2, m.height - px*2, '#B33E3E');

    drawPixelRect(ctx, m.x + px*3, m.y + px*3, m.width - px*6, m.height - px*6, '#FFFFFF');
    
    drawPixelRect(ctx, m.x + px*6, m.y + px*6 + eyeMovement, px*3, px*4, '#000000');
    drawPixelRect(ctx, m.x + px*7, m.y + px*7 + eyeMovement, px, px, '#FFFFFF');
  };

  const drawMimic = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 3;
    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#5C3321');
    drawPixelRect(ctx, m.x, m.y, m.width, px*4, '#7A4A31');
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 4; i++) drawPixelRect(ctx, m.x + px + i*11, m.y + px*3, px*2, px*3, '#FFFFFF');
    const tongueLen = Math.sin(gameRef.current.frameCount * 0.25) * 12 + 15;
    drawPixelRect(ctx, m.x + m.width/2 - px, m.y + px*4, px*2, tongueLen, '#D44E5E');
    drawPixelRect(ctx, m.x + m.width/2 - px, m.y + px*4 + tongueLen - px, px*3, px, '#D44E5E');
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 3;
    const step = Math.sin(gameRef.current.frameCount * 0.4) * 8;
    drawPixelRect(ctx, m.x + px*2, m.y + px*2, m.width - px*4, m.height - px*2, '#A0A0A0');
    drawPixelRect(ctx, m.x + px*3, m.y, px*7, px*6, '#F0F0F0');
    ctx.fillStyle = '#FF0000';
    drawPixelRect(ctx, m.x + px*4, m.y + px*2, px, px, '#FF0000');
    drawPixelRect(ctx, m.x + px*8, m.y + px*2, px, px, '#FF0000');
    drawPixelRect(ctx, m.x + px, m.y + m.height - px*4 + step, px*3, px*4, '#E0E0E0');
    drawPixelRect(ctx, m.x + m.width - px*4, m.y + m.height - px*4 - step, px*3, px*4, '#E0E0E0');
  };

  const drawDragon = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 3;
    const wing = Math.sin(gameRef.current.frameCount * 0.2) * 20;
    const hover = Math.sin(gameRef.current.frameCount * 0.1) * 15;
    const ry = m.y + hover;
    
    drawPixelRect(ctx, m.x, ry, m.width, m.height/2, '#5c242c'); 
    drawPixelRect(ctx, m.x - px*5, ry - wing, px*8, px*12, '#833440'); 
    drawPixelRect(ctx, m.x + m.width - px*3, ry - wing, px*8, px*12, '#833440'); 
    drawPixelRect(ctx, m.x + m.width, ry + px*2, px*7, px*6, '#5c242c'); 
    drawPixelRect(ctx, m.x + m.width + px*5, ry - px, px*8, px*8, '#833440'); 
    drawPixelRect(ctx, m.x + m.width + px*10, ry + px*2, px, px, '#FFFF00'); 
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
      // Handled by global listener
    }
  }, [telegramUser]);

  const update = useCallback(() => {
    const { player, monsters, particles, state, lastSpawn, frameCount } = gameRef.current;
    if (state !== 'PLAYING') return;

    const currentSpeed = INITIAL_MONSTER_SPEED + (gameRef.current.score / 20);
    gameRef.current.bgOffset += currentSpeed;

    player.vy += GRAVITY;
    player.y += player.vy;
    player.frame++;

    if (player.y > GROUND_Y - player.height) {
      player.y = GROUND_Y - player.height;
      player.vy = 0;
      player.isJumping = false;
    }

    if (frameCount % 8 === 0) {
      particles.push({
        x: VIRTUAL_WIDTH,
        y: Math.random() * VIRTUAL_HEIGHT,
        vx: -(currentSpeed * 0.6 + Math.random() * 2),
        vy: (Math.random() - 0.5) * 0.5,
        life: 1,
        color: 'rgba(255,255,255,0.05)'
      });
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= 0.005;
      if (p.life <= 0 || p.x < -10) particles.splice(i, 1);
    }

    const baseSpawnRate = 100;
    const spawnThreshold = Math.max(25, baseSpawnRate - (gameRef.current.score / 4));
    
    if (frameCount - lastSpawn > spawnThreshold + Math.random() * 40) {
      const rand = Math.random();
      let type: MonsterType = 'MIMIC';
      
      if (gameRef.current.score > 200 && rand > 0.85) type = 'DRAGON';
      else if (gameRef.current.score > 100 && rand > 0.7) type = 'SKELETON';
      else if (gameRef.current.score > 10 && rand > 0.3) type = 'BEHOLDER';
      else if (rand > 0.6) type = 'BEHOLDER';
      else type = 'MIMIC';

      let monsterY = GROUND_Y - 48;
      // Initial spawn point, will be modified by movement logic
      if (type === 'BEHOLDER') monsterY = GROUND_Y - 180;
      if (type === 'DRAGON') monsterY = GROUND_Y - 260;

      monsters.push({
        id: Math.random().toString(36).substr(2, 9),
        type,
        x: VIRTUAL_WIDTH,
        y: monsterY,
        width: type === 'DRAGON' ? 80 : 48,
        height: 48,
        speed: type === 'SKELETON' ? currentSpeed * 1.3 : currentSpeed,
      });
      gameRef.current.lastSpawn = frameCount;
    }

    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      m.x -= m.speed;
      
      // Dynamic vertical movement for Beholders - wide arc from top to floor
      if (m.type === 'BEHOLDER') {
        const phase = (VIRTUAL_WIDTH - m.x) * 0.04;
        const amplitude = 130; 
        const midY = GROUND_Y - 180;
        m.y = midY + Math.sin(phase) * amplitude;
      }

      const hitBoxPadding = 14;
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
    vignette.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    if (gameRef.current.state === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
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
      ctx.fillStyle = 'rgba(20,0,0,0.9)';
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
          <div className="absolute top-4 left-4 font-body text-[10px] text-primary/90 animate-pulse drop-shadow-md">
            DEPTH: {score}m | SPEED: {(INITIAL_MONSTER_SPEED + (score / 20)).toFixed(1)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 w-full gap-4 px-2">
        <div className="bg-[#1a1621] p-5 border-l-4 border-primary shadow-lg">
          <p className="text-[8px] text-gray-500 uppercase mb-2">Distance</p>
          <p className="text-2xl text-white glow-text">{score}m</p>
        </div>
        <div className="bg-[#1a1621] p-5 border-l-4 border-secondary text-right shadow-lg">
          <p className="text-[8px] text-gray-500 uppercase mb-2">High Score</p>
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
