"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Player, Monster, MonsterType, GameStatus, EngineState, CharacterClassName } from '@/types/game';
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
const PLAYER_SIZE = 72; // Увеличено на 50%

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

  // Надежная загрузка ассета
  useEffect(() => {
    const img = new Image();
    img.src = '/Knight2.webp';
    img.onload = () => {
      playerImgRef.current = img;
      setIsImageLoaded(true);
      setLoadError(false);
    };
    img.onerror = () => {
      console.error("Ошибка загрузки Knight2.webp");
      setLoadError(true);
      setIsImageLoaded(true); // Разрешаем играть с заглушкой
    };
  }, []);

  const drawPixelRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, offset: number) => {
    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Параллакс кирпичной стены
    const p1 = offset * 0.4;
    const brickW = 100;
    const brickH = 50;
    for (let row = 0; row < GROUND_Y / brickH; row++) {
      const xOffset = (row % 2 === 0 ? 0 : brickW / 2) - (p1 % brickW);
      for (let x = xOffset - brickW; x < VIRTUAL_WIDTH + brickW; x += brickW) {
        ctx.fillStyle = (Math.floor((x + p1) / brickW) + row) % 2 === 0 ? '#14111a' : '#0f0d14';
        ctx.fillRect(x, row * brickH, brickW - 4, brickH - 4);
      }
    }

    // Пол
    ctx.fillStyle = '#221e2b';
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
    
    // Детализация пола (плитка)
    const floorOffset = offset % 80;
    for (let x = -floorOffset; x < VIRTUAL_WIDTH; x += 80) {
      drawPixelRect(ctx, x, GROUND_Y, 2, VIRTUAL_HEIGHT - GROUND_Y, '#2a2635');
    }
  };

  const drawHero = (ctx: CanvasRenderingContext2D, player: Player) => {
    const isInvul = Date.now() < invulnerableUntil;
    if (isInvul && Math.floor(Date.now() / 100) % 2 === 0) return;

    if (playerImgRef.current && !loadError) {
      ctx.drawImage(playerImgRef.current, Math.floor(player.x), Math.floor(player.y), player.width, player.height);
    } else {
      // Программный Принц (заглушка)
      const x = Math.floor(player.x);
      const y = Math.floor(player.y);
      drawPixelRect(ctx, x + 12, y + 12, 48, 48, '#6226B3'); // Тело
      drawPixelRect(ctx, x + 20, y + 4, 32, 24, '#c0c0c0'); // Шлем
      drawPixelRect(ctx, x + 8, y + 20, 12, 40, '#4a1b8c'); // Плащ
    }
  };

  const drawMonster = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const x = Math.floor(m.x);
    const y = Math.floor(m.y);
    
    if (m.type === 'BEHOLDER') {
      const float = Math.sin(Date.now() * 0.005) * 10;
      const flyY = y + float;
      // Тело бехолдера
      drawPixelRect(ctx, x, flyY, 48, 48, '#833440');
      drawPixelRect(ctx, x + 8, flyY + 8, 32, 32, '#a54452');
      // Глаз
      drawPixelRect(ctx, x + 16, flyY + 12, 16, 16, 'white');
      drawPixelRect(ctx, x + 22, flyY + 18, 4, 4, 'red');
    } else if (m.type === 'MIMIC') {
      // Сундук-мимик
      drawPixelRect(ctx, x, y, 48, 48, '#3a2115'); // Дерево
      drawPixelRect(ctx, x, y + 8, 48, 4, '#1a1a1a'); // Ребро
      drawPixelRect(ctx, x, y + 32, 48, 4, '#1a1a1a'); // Ребро
      drawPixelRect(ctx, x + 20, y + 16, 8, 8, '#ffd700'); // Замок
    } else {
      drawPixelRect(ctx, x, y, 48, 48, '#444');
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawBackground(ctx, gameRef.current.bgOffset);
    
    if (gameState === 'PLAYING' || gameState === 'GAME_OVER') {
      gameRef.current.monsters.forEach(m => drawMonster(ctx, m));
      drawHero(ctx, gameRef.current.player);
    }

    if (gameState === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '16px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('НАЖМИТЕ ДЛЯ НАЧАЛА ПРИКЛЮЧЕНИЯ', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
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
      ctx.fillText(`СЧЕТ: ${score}м | РЕКОРД: ${highScore}м`, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 30);
      ctx.fillText('КЛИК ДЛЯ ВОЗРОЖДЕНИЯ', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 70);
    }
  }, [gameState, score, highScore, invulnerableUntil, loadError]);

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

      const spawnDelay = 2000 / (currentSpeed / 5);
      if (timestamp - gameRef.current.lastSpawnTime > spawnDelay) {
        const type: MonsterType = Math.random() > 0.6 ? 'BEHOLDER' : 'MIMIC';
        monsters.push({
          id: Math.random().toString(36).substr(2, 9),
          type,
          obstacleType: type === 'BEHOLDER' ? 'AIR' : 'GROUND',
          x: VIRTUAL_WIDTH,
          y: type === 'BEHOLDER' ? GROUND_Y - 160 : GROUND_Y - 48,
          width: 48,
          height: 48,
          speed: currentSpeed,
        });
        gameRef.current.lastSpawnTime = timestamp;
      }

      for (let i = monsters.length - 1; i >= 0; i--) {
        const m = monsters[i];
        m.x -= currentSpeed * dtFactor;

        if (checkCollision(player, m, 18) && timestamp > gameRef.current.collisionCooldown && Date.now() > invulnerableUntil) {
          gameRef.current.collisionCooldown = timestamp + 1000;
          
          if (selectedClass) {
            const check = performACCheck(selectedClass.armorClass);
            if (check.type === 'SUCCESS' || check.type === 'CRIT_SUCCESS') {
              addLog(check.message, 'success');
              setInvulnerableUntil(Date.now() + 1000);
            } else {
              addLog(check.message, check.type === 'CRIT_FAIL' ? 'critical' : 'fail');
              const damage = check.type === 'CRIT_FAIL' ? 2 : 1;
              takeDamage(damage);
              setInvulnerableUntil(Date.now() + 1500);
            }
          }
        }

        if (m.x + m.width < -100) monsters.splice(i, 1);
      }

      if (hp <= 0) {
        setGameState('GAME_OVER');
        if (Math.floor(engineRef.current.distance) > highScore) {
          setHighScore(Math.floor(engineRef.current.distance));
        }
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

  const handleInput = () => {
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
  };

  if (!isImageLoaded) {
    return (
      <div className="flex flex-col items-center justify-center bg-[#0a080d] w-full max-w-[800px] aspect-[2/1] border-4 border-primary">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-xs uppercase text-secondary">Загрузка ресурсов...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-4xl px-4">
      {loadError && (
        <div className="bg-red-900/50 text-[8px] p-2 text-center w-full uppercase">
          Внимание: Knight2.webp не найден в /public. Используется программный спрайт.
        </div>
      )}

      {/* HUD: HP и Класс */}
      {gameState !== 'START' && gameState !== 'CLASS_SELECTION' && (
        <div className="flex justify-between w-full bg-[#1a1621] p-3 border-b-4 border-primary shadow-lg">
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

      {/* Выбор класса */}
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
                  <span className="text-[8px] opacity-70 leading-relaxed">{cls.description}</span>
                  <div className="mt-2 text-[8px] text-secondary">AC: {cls.armorClass} | HP: {cls.maxHp}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div 
        className="relative border-4 border-primary shadow-[0_0_30px_rgba(98,38,179,0.4)] overflow-hidden cursor-pointer"
        onClick={handleInput}
      >
        <canvas ref={canvasRef} width={VIRTUAL_WIDTH} height={VIRTUAL_HEIGHT} className="image-pixelated w-full h-auto max-w-[800px]" />
      </div>

      {/* Боевой Лог */}
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

      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="bg-[#1a1621] p-4 border-b-4 border-secondary">
          <p className="text-[8px] text-secondary mb-1 uppercase">РЕКОРД</p>
          <p className="text-lg text-secondary">{highScore}м</p>
        </div>
        <div className="bg-[#1a1621] p-4 border-b-4 border-primary flex items-center justify-center">
           <p className="text-[8px] opacity-50 uppercase text-center">ПРОБЕЛ ИЛИ КЛИК ДЛЯ ПРЫЖКА</p>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
