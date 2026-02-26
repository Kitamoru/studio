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
    ctx.fillStyle = '#1a1621';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    const p1 = offset * 0.2;
    ctx.fillStyle = '#25202d';
    for (let x = -(p1 % 80); x < VIRTUAL_WIDTH; x += 80) {
      for (let y = 0; y < GROUND_Y; y += 40) {
        ctx.fillRect(x, y, 78, 38);
      }
    }
    const p2 = offset * 0.5;
    const flicker = Math.sin(frameCount * 0.2) * 2 + Math.random() * 2;
    for (let x = -(p2 % 300); x < VIRTUAL_WIDTH + 100; x += 300) {
      ctx.fillStyle = '#2d2738';
      ctx.fillRect(x, 0, 40, GROUND_Y);
      ctx.fillStyle = '#3a324a';
      ctx.fillRect(x + 5, 20, 30, 10);
      ctx.fillRect(x + 5, GROUND_Y - 30, 30, 10);
      if (Math.floor((x + p2) / 300) % 2 === 0) {
        drawTorch(ctx, x + 17, 120, flicker);
      }
    }
    const grad = ctx.createLinearGradient(0, GROUND_Y, 0, VIRTUAL_HEIGHT);
    grad.addColorStop(0, '#4a3b52');
    grad.addColorStop(1, '#1a1621');
    ctx.fillStyle = grad;
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
    const p3 = offset % 40;
    ctx.fillStyle = '#362a3d';
    for (let x = -p3; x < VIRTUAL_WIDTH; x += 40) {
      ctx.fillRect(x, GROUND_Y + 10, 20, 4);
    }
  };

  const drawHero = (ctx: CanvasRenderingContext2D, player: Player) => {
    const { x, y, width, height, isJumping, frame } = player;
    const px = 3; 
    const bounce = isJumping ? 0 : Math.sin(frame * 0.2) * 3;
    const legOffset = isJumping ? 0 : Math.sin(frame * 0.3) * 4;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + width/2, GROUND_Y, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cape (flowing)
    const capeWarp = Math.sin(frame * 0.15) * 5;
    ctx.fillStyle = '#833440';
    drawPixelRect(ctx, x - px + capeWarp, y + px*5 + bounce, px*4, height - px*6, '#833440');
    drawPixelRect(ctx, x - px*2 + capeWarp, y + px*8 + bounce, px*2, height - px*10, '#5c242c');

    // Legs
    drawPixelRect(ctx, x + px*4, y + height - px*3 + legOffset, px*2, px*3, '#2d2738');
    drawPixelRect(ctx, x + width - px*6, y + height - px*3 - legOffset, px*2, px*3, '#2d2738');

    // Armor Body
    drawPixelRect(ctx, x + px*3, y + px*5 + bounce, width - px*6, height - px*8, '#6980CC');
    drawPixelRect(ctx, x + px*4, y + px*6 + bounce, width - px*10, px*4, '#87a2ff'); // Highlight

    // Shield
    drawPixelRect(ctx, x - px, y + px*8 + bounce, px*3, px*10, '#4A3B52');
    drawPixelRect(ctx, x, y + px*9 + bounce, px, px*8, '#6980CC');

    // Helmet
    drawPixelRect(ctx, x + px*4, y + bounce, width - px*8, px*6, '#4A3B52');
    drawPixelRect(ctx, x + px*5, y + px + bounce, width - px*10, px*4, '#6980CC');
    
    // Plume (Helmet detail)
    drawPixelRect(ctx, x + px*6, y - px + bounce, px*4, px, '#FF4500');
    drawPixelRect(ctx, x + px*8, y - px*2 + bounce, px*2, px, '#FF4500');

    // Eyes
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00FFFF';
    drawPixelRect(ctx, x + width - px*7, y + px*3 + bounce, px, px, '#00FFFF');
    ctx.shadowBlur = 0;

    // Sword (Detailed)
    const swordAnim = Math.sin(frame * 0.1) * 2;
    drawPixelRect(ctx, x + width - px, y + px*4 + swordAnim, px*2, px*12, '#E0E0E0');
    drawPixelRect(ctx, x + width, y + px*4 + swordAnim, px, px*10, '#FFFFFF'); // Blade highlight
    drawPixelRect(ctx, x + width - px*2, y + px*12 + swordAnim, px*4, px, '#5C3321'); // Guard
  };

  const drawBeholder = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 3;
    const float = Math.sin(gameRef.current.frameCount * 0.1) * 8;
    const grad = ctx.createRadialGradient(m.x + m.width/2, m.y + m.height/2 + float, 5, m.x + m.width/2, m.y + m.height/2 + float, 35);
    grad.addColorStop(0, 'rgba(179, 62, 62, 0.4)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(m.x - 30, m.y + float - 30, m.width + 60, m.height + 60);
    drawPixelRect(ctx, m.x, m.y + float, m.width, m.height, '#B33E3E');
    drawPixelRect(ctx, m.x + px*3, m.y + px*3 + float, m.width - px*6, m.height - px*6, '#FFFFFF');
    drawPixelRect(ctx, m.x + px*6, m.y + px*6 + float, px*3, px*3, '#000000');
  };

  const drawMimic = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 3;
    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#5C3321');
    drawPixelRect(ctx, m.x, m.y, m.width, px*4, '#7A4A31');
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 4; i++) drawPixelRect(ctx, m.x + px + i*10, m.y + px*3, px*2, px*2, '#FFFFFF');
    const tongueLen = Math.sin(gameRef.current.frameCount * 0.2) * 8 + 12;
    drawPixelRect(ctx, m.x + m.width/2 - px, m.y + px*4, px*2, tongueLen, '#D44E5E');
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 3;
    const step = Math.sin(gameRef.current.frameCount * 0.3) * 5;
    drawPixelRect(ctx, m.x + px*2, m.y + px*2, m.width - px*4, m.height - px*2, '#E0E0E0'); // Body
    drawPixelRect(ctx, m.x + px*3, m.y, px*6, px*5, '#F0F0F0'); // Skull
    drawPixelRect(ctx, m.x + px*4, m.y + px*2, px, px, '#000000'); // Eye
    drawPixelRect(ctx, m.x + px*8, m.y + px*2, px, px, '#000000'); // Eye
    drawPixelRect(ctx, m.x + px, m.y + m.height - px*3 + step, px*2, px*3, '#E0E0E0'); // Leg
    drawPixelRect(ctx, m.x + m.width - px*3, m.y + m.height - px*3 - step, px*2, px*3, '#E0E0E0'); // Leg
  };

  const drawDragon = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 3;
    const wing = Math.sin(gameRef.current.frameCount * 0.2) * 15;
    drawPixelRect(ctx, m.x, m.y, m.width, m.height/2, '#833440'); // Body
    drawPixelRect(ctx, m.x - px*4, m.y - wing, px*6, px*8, '#B33E3E'); // Left Wing
    drawPixelRect(ctx, m.x + m.width - px*2, m.y - wing, px*6, px*8, '#B33E3E'); // Right Wing
    drawPixelRect(ctx, m.x + m.width, m.y + px, px*5, px*4, '#833440'); // Neck
    drawPixelRect(ctx, m.x + m.width + px*4, m.y - px, px*6, px*6, '#B33E3E'); // Head
    drawPixelRect(ctx, m.x + m.width + px*8, m.y + px, px, px, '#FFFF00'); // Eye
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
      console.error('Score submission error:', err);
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
        vx: -(currentSpeed * 0.5 + Math.random() * 2),
        vy: (Math.random() - 0.5) * 0.5,
        life: 1,
        color: 'rgba(255,255,255,0.1)'
      });
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= 0.005;
      if (p.life <= 0 || p.x < 0) particles.splice(i, 1);
    }

    const spawnThreshold = Math.max(25, 100 - (gameRef.current.score / 2.5));
    if (frameCount - lastSpawn > spawnThreshold + Math.random() * 60) {
      const rand = Math.random();
      let type: MonsterType = 'MIMIC';
      if (gameRef.current.score > 100 && rand > 0.8) type = 'DRAGON';
      else if (gameRef.current.score > 50 && rand > 0.6) type = 'SKELETON';
      else if (rand > 0.3) type = 'BEHOLDER';

      let monsterY = GROUND_Y - 48;
      if (type === 'BEHOLDER') monsterY = GROUND_Y - 140;
      if (type === 'DRAGON') monsterY = GROUND_Y - 220;

      monsters.push({
        id: Math.random().toString(36),
        type,
        x: VIRTUAL_WIDTH,
        y: monsterY,
        width: type === 'DRAGON' ? 64 : 48,
        height: 48,
        speed: type === 'SKELETON' ? currentSpeed * 1.3 : currentSpeed,
      });
      gameRef.current.lastSpawn = frameCount;
    }

    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      m.x -= m.speed;
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
        gameRef.current.score += 1;
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
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '24px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('PIXELDUNGEON DASH', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px "Press Start 2P"';
      ctx.fillText('PRESS SPACE OR CLICK TO START', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 40);
    }

    if (gameRef.current.state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(20,0,0,0.9)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#FF5555';
      ctx.font = '28px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('YOU PERISHED', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 40);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px "Press Start 2P"';
      ctx.fillText(`DEPTH: ${Math.floor(gameRef.current.score)}m`, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 10);
      ctx.font = '10px "Press Start 2P"';
      ctx.fillText('CLICK TO TRY AGAIN', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 60);
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
        className="relative w-full aspect-[2/1] bg-[#0f0d12] border-8 border-[#2d2738] rounded-none overflow-hidden cursor-pointer shadow-[0_0_60px_rgba(98,38,179,0.4)]"
        onClick={handleInput}
      >
        <canvas
          ref={canvasRef}
          width={VIRTUAL_WIDTH}
          height={VIRTUAL_HEIGHT}
          className="w-full h-full object-contain image-pixelated"
        />
        
        {gameState === 'PLAYING' && (
          <div className="absolute top-4 left-4 font-body text-[10px] text-primary/80 animate-pulse">
            DEPTH: {score}m | SPEED: {Math.floor((INITIAL_MONSTER_SPEED + score/20)*10)/10}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 w-full gap-4 px-2">
        <div className="bg-[#1a1621] p-4 border-l-4 border-primary">
          <p className="text-[8px] text-gray-500 uppercase mb-1">Depth</p>
          <p className="text-xl text-white">{score}m</p>
        </div>
        <div className="bg-[#1a1621] p-4 border-l-4 border-secondary text-right">
          <p className="text-[8px] text-gray-500 uppercase mb-1">Record</p>
          <p className="text-xl text-secondary">{highScore}m</p>
        </div>
      </div>

      {telegramUser && (
        <div className="flex items-center gap-3 bg-[#1a1621] px-6 py-2 border border-[#2d2738]">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] text-gray-400">HERO: {telegramUser.first_name?.toUpperCase()}</span>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
