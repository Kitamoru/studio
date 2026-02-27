"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Player, Monster, MonsterType, GameStatus, EngineState, CharacterClassName, ObstacleType } from '@/types/game';
import { useGameLoop } from '@/hooks/use-game-loop';
import { calculateSpeed, checkCollision } from '@/lib/game-math';
import { useDnd } from '@/context/dnd-context';
import { performACCheck, CHARACTER_CLASSES } from '@/lib/dnd-logic';
import { Heart, Shield, Zap, Wand2, Loader2 } from 'lucide-react';

const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 400;
const GRAVITY = 0.65;
const JUMP_STRENGTH = -14;
const GROUND_Y = 340;
const PLAYER_X = 120;
const PLAYER_SIZE = 72;

// Конфигурация бестиария
const BESTIARY: Record<MonsterType, { width: number; height: number; type: ObstacleType; color: string }> = {
  SLIME: { width: 40, height: 30, type: 'GROUND', color: '#4ade80' },
  GOBLIN: { width: 44, height: 44, type: 'GROUND', color: '#84cc16' },
  SKELETON: { width: 40, height: 50, type: 'GROUND', color: '#e5e7eb' },
  MIMIC: { width: 48, height: 48, type: 'GROUND', color: '#78350f' },
  BAT: { width: 32, height: 32, type: 'AIR', color: '#4b5563' },
  BEHOLDER: { width: 52, height: 52, type: 'AIR', color: '#9f1239' },
  OGRE: { width: 64, height: 80, type: 'TALL', color: '#1e3a8a' },
  GHOST: { width: 48, height: 60, type: 'TALL', color: '#cbd5e1' },
  DRAGON: { width: 90, height: 70, type: 'TALL', color: '#b91c1c' },
};

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const { hp, maxHp, selectedClass, combatLog, selectClass, takeDamage, addLog, resetDnd } = useDnd();
  
  const [gameState, setGameState] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [invulnerableUntil, setInvulnerableUntil] = useState(0);

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
      maxJumps: 2,
      frame: 0 
    } as Player,
    monsters: [] as Monster[],
    bgOffset: 0,
    lastSpawnTime: 0,
    collisionCooldown: 0,
  });

  useEffect(() => {
    const img = new Image();
    img.src = '/Knight2.webp';
    img.onload = () => {
      playerImgRef.current = img;
      setIsImageLoaded(true);
      setLoadError(false);
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

  const drawMonster = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const { x, y, width, height, type } = m;
    const config = BESTIARY[type];
    
    ctx.save();
    const drawX = Math.floor(x);
    const drawY = Math.floor(y);

    switch(type) {
      case 'SLIME':
        drawPixelRect(ctx, drawX, drawY + 10, width, height - 10, config.color);
        drawPixelRect(ctx, drawX + 4, drawY + 6, width - 8, 4, config.color);
        break;
      case 'BEHOLDER':
        const float = Math.sin(Date.now() * 0.005) * 10;
        const fy = drawY + float;
        drawPixelRect(ctx, drawX, fy, width, height, config.color);
        drawPixelRect(ctx, drawX + 16, fy + 12, 20, 20, 'white');
        drawPixelRect(ctx, drawX + 22, fy + 18, 8, 8, 'red');
        break;
      case 'MIMIC':
        drawPixelRect(ctx, drawX, drawY, width, height, config.color);
        drawPixelRect(ctx, drawX, drawY + 10, width, 4, '#1a1a1a');
        drawPixelRect(ctx, drawX + 20, drawY + 16, 8, 8, '#ffd700');
        break;
      case 'DRAGON':
        drawPixelRect(ctx, drawX, drawY, width, height, config.color);
        drawPixelRect(ctx, drawX + width - 20, drawY - 20, 30, 40, config.color); // Head
        drawPixelRect(ctx, drawX + 10, drawY + 10, width - 20, 20, '#fbbf24'); // Wings
        break;
      default:
        drawPixelRect(ctx, drawX, drawY, width, height, config.color);
    }
    ctx.restore();
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Floor
    ctx.fillStyle = '#221e2b';
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
    
    if (gameState === 'PLAYING' || gameState === 'GAME_OVER') {
      gameRef.current.monsters.forEach(m => drawMonster(ctx, m));
      
      const p = gameRef.current.player;
      const isInvul = Date.now() < invulnerableUntil;
      if (!(isInvul && Math.floor(Date.now() / 100) % 2 === 0)) {
        if (playerImgRef.current && !loadError) {
          ctx.drawImage(playerImgRef.current, Math.floor(p.x), Math.floor(p.y), p.width, p.height);
        } else {
          // Запасной герой
          drawPixelRect(ctx, p.x + 12, p.y + 12, 48, 48, '#6226B3');
        }
      }
    }

    if (gameState === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '16px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('НАЖМИТЕ ИЛИ ПРОБЕЛ', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    }

    if (gameState === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(40,0,0,0.8)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#ff0000';
      ctx.font = '32px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('ВЫ ПОГИБЛИ', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20);
      ctx.fillStyle = 'white';
      ctx.font = '12px "Press Start 2P"';
      ctx.fillText(`СЧЕТ: ${score}м`, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 30);
      ctx.fillText('КЛИК ИЛИ ПРОБЕЛ ДЛЯ ВОЗРОЖДЕНИЯ', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 70);
    }
  }, [gameState, score, invulnerableUntil, loadError]);

  const handleUpdate = useCallback(({ deltaTime, timestamp }: { deltaTime: number, timestamp: number }) => {
    if (gameState === 'PLAYING') {
      const dtFactor = deltaTime / 16.67;
      engineRef.current.elapsedTime += deltaTime / 1000;
      engineRef.current.speed = calculateSpeed(engineRef.current.elapsedTime);
      const currentSpeed = engineRef.current.speed;

      const { player, monsters } = gameRef.current;
      
      player.vy += GRAVITY * dtFactor;
      player.y += player.vy * dtFactor;

      if (player.y > GROUND_Y - player.height) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.state = 'RUNNING';
        player.jumpsRemaining = player.maxJumps;
      }

      gameRef.current.bgOffset += currentSpeed * dtFactor;
      engineRef.current.distance += currentSpeed * dtFactor * 0.1;

      const minDistance = currentSpeed * 60; 
      const lastMonster = monsters[monsters.length - 1];
      const distanceToLast = lastMonster ? (VIRTUAL_WIDTH - lastMonster.x) : Infinity;

      if (distanceToLast > minDistance && Math.random() < 0.02 * dtFactor) {
        const types = Object.keys(BESTIARY) as MonsterType[];
        const type = types[Math.floor(Math.random() * types.length)];
        const config = BESTIARY[type];

        let yPos = GROUND_Y - config.height;
        if (config.type === 'AIR') yPos = GROUND_Y - 140 - Math.random() * 60;

        monsters.push({
          id: Math.random().toString(36).substr(2, 9),
          type,
          obstacleType: config.type,
          x: VIRTUAL_WIDTH,
          y: yPos,
          width: config.width,
          height: config.height,
          speed: currentSpeed,
        });
        gameRef.current.lastSpawnTime = timestamp;
      }

      for (let i = monsters.length - 1; i >= 0; i--) {
        const m = monsters[i];
        m.x -= currentSpeed * dtFactor;

        if (checkCollision(player, m, 15) && timestamp > gameRef.current.collisionCooldown && Date.now() > invulnerableUntil) {
          gameRef.current.collisionCooldown = timestamp + 1000;
          
          if (selectedClass) {
            const check = performACCheck(selectedClass.armorClass);
            if (check.type === 'SUCCESS' || check.type === 'CRIT_SUCCESS') {
              addLog(check.message, 'success');
              setInvulnerableUntil(Date.now() + 1000);
            } else {
              addLog(check.message, check.type === 'CRIT_FAIL' ? 'critical' : 'fail');
              takeDamage(check.type === 'CRIT_FAIL' ? 2 : 1);
              setInvulnerableUntil(Date.now() + 1500);
            }
          }
        }

        if (m.x + m.width < -100) monsters.splice(i, 1);
      }

      if (hp <= 0) {
        setGameState('GAME_OVER');
        if (Math.floor(engineRef.current.distance) > highScore) setHighScore(Math.floor(engineRef.current.distance));
      }
      setScore(Math.floor(engineRef.current.distance));
    }
    draw();
  }, [gameState, hp, selectedClass, invulnerableUntil, highScore, addLog, takeDamage, draw]);

  useGameLoop(handleUpdate, true);

  const startNewGame = () => {
    engineRef.current.elapsedTime = 0;
    engineRef.current.distance = 0;
    gameRef.current.monsters = [];
    gameRef.current.player.y = GROUND_Y - PLAYER_SIZE;
    gameRef.current.player.vy = 0;
    gameRef.current.player.maxJumps = selectedClass?.name === 'ROGUE' ? 3 : 2;
    gameRef.current.player.jumpsRemaining = gameRef.current.player.maxJumps;
    resetDnd();
    setGameState('PLAYING');
    setScore(0);
  };

  const handleInput = useCallback(() => {
    if (gameState === 'START' || gameState === 'GAME_OVER') {
      setGameState('CLASS_SELECTION');
    } else if (gameState === 'PLAYING') {
      const { player } = gameRef.current;
      if (player.jumpsRemaining > 0) {
        player.vy = JUMP_STRENGTH * (selectedClass?.jumpMultiplier || 1);
        player.state = 'JUMPING';
        player.jumpsRemaining--;
      }
    }
  }, [gameState, selectedClass]);

  // Обработка клавиши Пробел
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); // Предотвращаем прокрутку страницы
        handleInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput]);

  if (!isImageLoaded) {
    return (
      <div className="flex flex-col items-center justify-center bg-[#0a080d] w-full max-w-[800px] aspect-[2/1] border-4 border-primary">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-xs uppercase text-secondary">ЗАГРУЗКА БЕСТИАРИЯ...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-4xl px-4">
      {gameState === 'CLASS_SELECTION' && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl text-primary mb-8 uppercase">ВЫБЕРИТЕ КЛАСС</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
            {(Object.keys(CHARACTER_CLASSES) as CharacterClassName[]).map((key) => {
              const cls = CHARACTER_CLASSES[key];
              return (
                <button
                  key={key}
                  onClick={() => { selectClass(key); startNewGame(); }}
                  className="bg-[#1a1621] border-2 border-primary p-4 hover:bg-primary/20 transition-all flex flex-col items-center gap-3"
                >
                  {key === 'FIGHTER' && <Shield className="text-primary" />}
                  {key === 'ROGUE' && <Zap className="text-yellow-500" />}
                  {key === 'WIZARD' && <Wand2 className="text-blue-400" />}
                  <span className="text-sm font-bold">{cls.label}</span>
                  <span className="text-[8px] opacity-70">{cls.description}</span>
                  <div className="mt-2 text-[8px] text-secondary">AC: {cls.armorClass} | HP: {cls.maxHp}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {gameState !== 'START' && gameState !== 'CLASS_SELECTION' && (
        <div className="flex justify-between w-full bg-[#1a1621] p-3 border-b-4 border-primary">
          <div className="flex items-center gap-2">
            {Array.from({ length: maxHp }).map((_, i) => (
              <Heart key={i} size={20} fill={i < hp ? '#ff0000' : 'none'} color={i < hp ? '#ff0000' : '#444'} />
            ))}
          </div>
          <div className="flex items-center gap-4 text-[10px] uppercase">
            <span className="text-secondary">{selectedClass?.label}</span>
            <span className="text-primary">{score}м</span>
          </div>
        </div>
      )}

      <div 
        className="relative border-4 border-primary shadow-[0_0_30px_rgba(98,38,179,0.4)] overflow-hidden cursor-pointer"
        onClick={handleInput}
      >
        <canvas ref={canvasRef} width={VIRTUAL_WIDTH} height={VIRTUAL_HEIGHT} className="image-pixelated w-full h-auto max-w-[800px]" />
      </div>

      {gameState === 'PLAYING' && (
        <div className="w-full bg-[#0a080d] p-4 border-l-4 border-primary h-32 overflow-hidden flex flex-col-reverse gap-1">
          {combatLog.map((log) => (
            <div key={log.id} className={`text-[8px] uppercase ${
              log.type === 'success' ? 'text-green-400' : 
              log.type === 'fail' ? 'text-red-400' : 
              log.type === 'critical' ? 'text-red-600 font-bold' : 'text-gray-400'
            }`}>
              {">"} {log.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
