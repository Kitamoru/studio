"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, Player, Monster, MonsterType, TelegramUser } from '@/types/game';

const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 400;
const GRAVITY = 0.8;
const JUMP_STRENGTH = -15;
const GROUND_Y = 320;
const PLAYER_X = 100;
const INITIAL_MONSTER_SPEED = 5;

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);

  // Game state refs to avoid closure stale state in requestAnimationFrame
  const gameRef = useRef({
    player: { x: PLAYER_X, y: GROUND_Y - 40, width: 40, height: 40, vy: 0, isJumping: false, frame: 0 } as Player,
    monsters: [] as Monster[],
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

  const drawHero = (ctx: CanvasRenderingContext2D, player: Player) => {
    const { x, y, width, height, isJumping, frame } = player;
    const px = 4; // virtual pixel size for 16-bit look
    
    // Body
    drawPixelRect(ctx, x + px, y + px*2, width - px*2, height - px*3, '#6980CC');
    // Head
    drawPixelRect(ctx, x + px*2, y, width - px*4, px*3, '#FFD3A3');
    // Eyes
    drawPixelRect(ctx, x + width - px*4, y + px, px, px, '#000000');
    // Feet (simple animation)
    const legOffset = (!isJumping && Math.floor(frame / 10) % 2 === 0) ? px : 0;
    drawPixelRect(ctx, x + px, y + height - px + legOffset, px*2, px, '#4A3B52');
    drawPixelRect(ctx, x + width - px*3, y + height - px - legOffset, px*2, px, '#4A3B52');
  };

  const drawBeholder = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 4;
    // Body
    drawPixelRect(ctx, m.x, m.y, m.width, m.height, '#B33E3E');
    // Eye
    drawPixelRect(ctx, m.x + px*2, m.y + px*2, m.width - px*4, m.height - px*4, '#FFFFFF');
    drawPixelRect(ctx, m.x + px*4, m.y + px*4, px*2, px*2, '#000000');
    // Tentacles (tiny)
    drawPixelRect(ctx, m.x + px, m.y - px, px, px, '#B33E3E');
    drawPixelRect(ctx, m.x + m.width - px*2, m.y - px, px, px, '#B33E3E');
  };

  const drawMimic = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const px = 4;
    // Lid
    drawPixelRect(ctx, m.x, m.y, m.width, px*3, '#7A4A31');
    // Teeth
    drawPixelRect(ctx, m.x + px, m.y + px*3, px, px, '#FFFFFF');
    drawPixelRect(ctx, m.x + m.width - px*2, m.y + px*3, px, px, '#FFFFFF');
    // Bottom
    drawPixelRect(ctx, m.x, m.y + px*4, m.width, m.height - px*4, '#5C3321');
    // Tongue
    drawPixelRect(ctx, m.x + px*3, m.y + px*4, px*2, px*3, '#D44E5E');
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
    const { player, monsters, state, lastSpawn, frameCount } = gameRef.current;
    if (state !== 'PLAYING') return;

    // Player physics
    player.vy += GRAVITY;
    player.y += player.vy;
    player.frame++;

    if (player.y > GROUND_Y - player.height) {
      player.y = GROUND_Y - player.height;
      player.vy = 0;
      player.isJumping = false;
    }

    // Monster spawning
    if (frameCount - lastSpawn > 100 + Math.random() * 100) {
      const type: MonsterType = Math.random() > 0.5 ? 'BEHOLDER' : 'MIMIC';
      const monsterY = type === 'BEHOLDER' ? GROUND_Y - 120 : GROUND_Y - 40;
      monsters.push({
        id: Math.random().toString(36),
        type,
        x: VIRTUAL_WIDTH,
        y: monsterY,
        width: 40,
        height: 40,
        speed: INITIAL_MONSTER_SPEED + gameRef.current.score / 20,
      });
      gameRef.current.lastSpawn = frameCount;
    }

    // Monster movement & Collision
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      m.x -= m.speed;

      // Simple AABB Collision
      if (
        player.x < m.x + m.width - 10 &&
        player.x + player.width - 10 > m.x &&
        player.y < m.y + m.height - 10 &&
        player.y + player.height - 10 > m.y
      ) {
        gameRef.current.state = 'GAME_OVER';
        setGameState('GAME_OVER');
        submitScore(Math.floor(gameRef.current.score));
        if (gameRef.current.score > highScore) setHighScore(Math.floor(gameRef.current.score));
      }

      // Cleanup & Scoring
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

    // Clear background
    ctx.fillStyle = '#1A1621'; // Slightly darker for depth
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Draw Ground
    ctx.fillStyle = '#4A3B52';
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
    // Ground detail
    ctx.fillStyle = '#362A3D';
    for (let i = 0; i < VIRTUAL_WIDTH; i += 40) {
      ctx.fillRect(i, GROUND_Y + 4, 20, 4);
    }

    // Draw Player
    drawHero(ctx, gameRef.current.player);

    // Draw Monsters
    gameRef.current.monsters.forEach(m => {
      if (m.type === 'BEHOLDER') drawBeholder(ctx, m);
      else drawMimic(ctx, m);
    });

    if (gameRef.current.state === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '20px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('PIXELDUNGEON DASH', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20);
      ctx.font = '12px "Press Start 2P"';
      ctx.fillText('CLICK TO START & JUMP', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 20);
    }

    if (gameRef.current.state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#FF5555';
      ctx.font = '24px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 40);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px "Press Start 2P"';
      ctx.fillText(`SCORE: ${Math.floor(gameRef.current.score)}`, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 10);
      ctx.font = '10px "Press Start 2P"';
      ctx.fillText('CLICK TO RESTART', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 50);
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
    if (gameRef.current.state === 'START') {
      gameRef.current.state = 'PLAYING';
      setGameState('PLAYING');
      setScore(0);
      gameRef.current.score = 0;
    } else if (gameRef.current.state === 'GAME_OVER') {
      gameRef.current.state = 'PLAYING';
      gameRef.current.monsters = [];
      gameRef.current.score = 0;
      gameRef.current.player.y = GROUND_Y - 40;
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
      if (e.code === 'Space') handleInput();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto p-4 gap-6">
      <div 
        ref={containerRef}
        className="relative w-full aspect-[2/1] bg-black border-4 border-[#6226B3] rounded-lg overflow-hidden cursor-pointer shadow-2xl"
        onClick={handleInput}
      >
        <canvas
          ref={canvasRef}
          width={VIRTUAL_WIDTH}
          height={VIRTUAL_HEIGHT}
          className="w-full h-full object-contain image-pixelated"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      <div className="flex justify-between w-full px-4 text-xs sm:text-sm">
        <div className="flex flex-col gap-2">
          <span className="text-secondary">SCORE: {score}</span>
          <span className="text-accent">HIGH: {highScore}</span>
        </div>
        {telegramUser && (
          <div className="text-right text-gray-400">
            <span>PLAYER: {telegramUser.first_name}</span>
          </div>
        )}
      </div>

      {gameState === 'GAME_OVER' && (
        <button
          onClick={handleInput}
          className="px-8 py-4 bg-[#6226B3] text-white rounded-md border-b-4 border-indigo-900 active:translate-y-1 active:border-b-0 transition-all font-headline text-lg"
        >
          TRY AGAIN
        </button>
      )}
    </div>
  );
};

export default GameCanvas;
