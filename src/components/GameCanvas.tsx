"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Player, Monster, MonsterType, GameStatus, EngineState, CharacterClassName } from '@/types/game';
import { useGameLoop } from '@/hooks/use-game-loop';
import { calculateSpeed, checkCollision } from '@/lib/game-math';
import { useDnd } from '@/context/dnd-context';
import { performACCheck, CHARACTER_CLASSES } from '@/lib/dnd-logic';
import { ASSET_MANIFEST } from '@/lib/asset-manifest';
import { Heart, Shield, Zap, Wand2, Loader2, Sword } from 'lucide-react';
import { cn } from '@/lib/utils';

const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 400;
const GRAVITY = 0.65;
const JUMP_STRENGTH = -14;
const GROUND_Y = 340;
const PLAYER_X = 120;

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
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const { hp, maxHp, selectedClass, combatLog, selectClass, takeDamage, addLog, resetDnd } = useDnd();
  
  const [gameState, setGameState] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [invulnerableUntil, setInvulnerableUntil] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  
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
      y: GROUND_Y - ASSET_MANIFEST.PLAYER.height, 
      width: ASSET_MANIFEST.PLAYER.width, 
      height: ASSET_MANIFEST.PLAYER.height, 
      vy: 0, 
      state: 'RUNNING', 
      jumpsRemaining: 2, 
      maxJumps: 2,
      frame: 0 
    } as Player,
    monsters: [] as Monster[],
    parallax: [0, 0, 0], // Слои фона
    particles: [] as Particle[],
    collisionCooldown: 0,
  });

  useEffect(() => {
    const img = new Image();
    img.src = '/Knight2.webp';
    img.onload = () => {
      playerImgRef.current = img;
      setIsImageLoaded(true);
    };
    img.onerror = () => setIsImageLoaded(true);
  }, []);

  const createJumpEffect = (x: number, y: number) => {
    for (let i = 0; i < 8; i++) {
      gameRef.current.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 2,
        life: 1.0,
        color: '#6226B3'
      });
    }
  };

  const drawMonster = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const { x, y, width, height, type } = m;
    const config = ASSET_MANIFEST.MONSTERS[type as keyof typeof ASSET_MANIFEST.MONSTERS] || ASSET_MANIFEST.MONSTERS.SLIME;
    
    ctx.save();
    ctx.fillStyle = config.color;
    
    // Рисуем детального монстра (например, Бехолдера)
    if (type === 'BEHOLDER') {
      const float = Math.sin(Date.now() * 0.005) * 8;
      const fy = y + float;
      // Тело
      ctx.fillRect(x, fy, width, height);
      // Глаз
      ctx.fillStyle = 'white';
      ctx.fillRect(x + width/4, fy + height/4, width/2, height/2);
      ctx.fillStyle = 'red';
      ctx.fillRect(x + width/2 - 2, fy + height/2 - 2, 4, 4);
    } else if (type === 'MIMIC') {
      // Сундук
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = '#1A1621';
      ctx.fillRect(x, y + height/3, width, 4); // Щель
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(x + width/2 - 4, y + height/2, 8, 8); // Замок
    } else {
      ctx.fillRect(x, y, width, height);
    }
    ctx.restore();
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const layers = [ASSET_MANIFEST.PARALLAX.BACK, ASSET_MANIFEST.PARALLAX.MID, ASSET_MANIFEST.PARALLAX.FRONT];
    
    layers.forEach((layer, i) => {
      ctx.fillStyle = layer.color;
      const offset = gameRef.current.parallax[i] % 400;
      
      // Рисуем повторяющиеся элементы (колонны или кирпичи)
      for (let x = -offset; x < VIRTUAL_WIDTH; x += 400) {
        if (i === 0) { // Дальние колонны
          ctx.fillRect(x + 100, 50, 40, 300);
        } else if (i === 1) { // Средние кирпичи
          ctx.fillRect(x + 200, 150, 80, 40);
          ctx.fillRect(x + 50, 250, 80, 40);
        }
      }
    });

    // Пол
    ctx.fillStyle = '#120B1A';
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
    ctx.strokeStyle = '#6226B3';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, GROUND_Y, VIRTUAL_WIDTH, 2);
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    
    // Фоновый градиент
    const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
    grad.addColorStop(0, '#050406');
    grad.addColorStop(1, '#0A080D');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    drawBackground(ctx);

    if (gameState === 'PLAYING' || gameState === 'GAME_OVER') {
      // Частицы
      gameRef.current.particles.forEach((p, i) => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) gameRef.current.particles.splice(i, 1);
      });
      ctx.globalAlpha = 1.0;

      // Монстры
      gameRef.current.monsters.forEach(m => drawMonster(ctx, m));
      
      // Игрок
      const p = gameRef.current.player;
      const isInvul = Date.now() < invulnerableUntil;
      if (!(isInvul && Math.floor(Date.now() / 100) % 2 === 0)) {
        if (playerImgRef.current) {
          ctx.drawImage(playerImgRef.current, p.x, p.y, p.width, p.height);
        } else {
          ctx.fillStyle = '#6226B3';
          ctx.fillRect(p.x + 16, p.y + 16, 40, 40);
        }
      }
    }

    // UI overlays
    if (gameState === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '14px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('НАЖМИТЕ ДЛЯ НАЧАЛА ПРИКЛЮЧЕНИЯ', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    }
  }, [gameState, invulnerableUntil]);

  const handleUpdate = useCallback(({ deltaTime, timestamp }: { deltaTime: number, timestamp: number }) => {
    if (gameState === 'PLAYING') {
      const dtFactor = deltaTime / 16.67;
      engineRef.current.elapsedTime += deltaTime / 1000;
      engineRef.current.speed = calculateSpeed(engineRef.current.elapsedTime);
      const currentSpeed = engineRef.current.speed;

      // Параллакс
      gameRef.current.parallax[0] += currentSpeed * 0.1 * dtFactor;
      gameRef.current.parallax[1] += currentSpeed * 0.4 * dtFactor;
      gameRef.current.parallax[2] += currentSpeed * 1.0 * dtFactor;

      const { player, monsters } = gameRef.current;
      
      player.vy += GRAVITY * dtFactor;
      player.y += player.vy * dtFactor;

      if (player.y > GROUND_Y - player.height) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.state = 'RUNNING';
        player.jumpsRemaining = player.maxJumps;
      }

      engineRef.current.distance += currentSpeed * dtFactor * 0.1;

      // Спавн
      if (timestamp - gameRef.current.collisionCooldown > 1500 && Math.random() < 0.02 * dtFactor) {
        const monsterTypes: MonsterType[] = ['SLIME', 'MIMIC', 'BEHOLDER', 'BAT', 'DRAGON'];
        const type = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];
        const config = ASSET_MANIFEST.MONSTERS[type as keyof typeof ASSET_MANIFEST.MONSTERS];
        
        let yPos = GROUND_Y - config.height;
        if (config.type === 'AIR_LOW') yPos = GROUND_Y - 100;
        if (config.type === 'AIR_HIGH') yPos = GROUND_Y - 180;

        monsters.push({
          id: Math.random().toString(),
          type,
          obstacleType: config.type as any,
          x: VIRTUAL_WIDTH,
          y: yPos,
          width: config.width,
          height: config.height,
          speed: currentSpeed,
        });
        gameRef.current.collisionCooldown = timestamp; // Используем как таймер спавна
      }

      // Обновление монстров и коллизии
      for (let i = monsters.length - 1; i >= 0; i--) {
        const m = monsters[i];
        m.x -= currentSpeed * dtFactor;

        if (checkCollision(player, m, ASSET_MANIFEST.PLAYER.hitboxPadding) && Date.now() > invulnerableUntil) {
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 300);
          
          if (selectedClass) {
            const check = performACCheck(selectedClass.armorClass);
            if (check.type === 'SUCCESS' || check.type === 'CRIT_SUCCESS') {
              addLog(check.message, 'success');
              setInvulnerableUntil(Date.now() + 1000);
            } else {
              addLog(check.message, 'fail');
              takeDamage(1);
              setInvulnerableUntil(Date.now() + 1500);
            }
          }
        }

        if (m.x + m.width < -100) monsters.splice(i, 1);
      }

      if (hp <= 0) setGameState('GAME_OVER');
      setScore(Math.floor(engineRef.current.distance));
    }
    draw();
  }, [gameState, hp, selectedClass, invulnerableUntil, addLog, takeDamage, draw]);

  useGameLoop(handleUpdate, true);

  const startNewGame = () => {
    engineRef.current.elapsedTime = 0;
    engineRef.current.distance = 0;
    gameRef.current.monsters = [];
    gameRef.current.particles = [];
    gameRef.current.player.y = GROUND_Y - ASSET_MANIFEST.PLAYER.height;
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
        player.vy = JUMP_STRENGTH;
        player.jumpsRemaining--;
        createJumpEffect(player.x + player.width / 2, player.y + player.height);
      }
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleInput();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput]);

  if (!isImageLoaded) {
    return (
      <div className="flex flex-col items-center justify-center bg-[#0A080D] w-full max-w-[800px] aspect-[2/1] border-4 border-primary">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-[10px] uppercase text-secondary">ПОДГОТОВКА ПОДЗЕМЕЛЬЯ...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-4xl px-4">
      {gameState === 'CLASS_SELECTION' && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
          <h2 className="text-xl text-primary mb-8 uppercase glow-text">ВЫБЕРИТЕ КЛАСС</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
            {(Object.keys(CHARACTER_CLASSES) as CharacterClassName[]).map((key) => {
              const cls = CHARACTER_CLASSES[key];
              return (
                <button
                  key={key}
                  onClick={() => { selectClass(key); startNewGame(); }}
                  className="bg-[#1A1621] border-2 border-primary p-4 hover:bg-primary/20 hover:border-accent transition-all flex flex-col items-center gap-3 group"
                >
                  <div className="group-hover:scale-110 transition-transform">
                    {key === 'FIGHTER' && <Shield className="text-primary" />}
                    {key === 'ROGUE' && <Zap className="text-accent" />}
                    {key === 'WIZARD' && <Wand2 className="text-secondary" />}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">{cls.label}</span>
                  <span className="text-[7px] opacity-60 uppercase">{cls.description}</span>
                  <div className="mt-2 text-[7px] text-secondary">AC: {cls.armorClass} | HP: {cls.maxHp}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {gameState !== 'START' && gameState !== 'CLASS_SELECTION' && (
        <div className="flex justify-between w-full bg-[#1A1621] p-3 border-4 border-primary shadow-lg">
          <div className="flex items-center gap-2">
            {Array.from({ length: maxHp }).map((_, i) => (
              <Heart key={i} size={16} fill={i < hp ? '#ff0000' : 'none'} color={i < hp ? '#ff0000' : '#444'} className={i < hp ? 'animate-pulse' : ''} />
            ))}
          </div>
          <div className="flex items-center gap-4 text-[8px] uppercase tracking-tighter">
            <span className="text-secondary opacity-70">{selectedClass?.label}</span>
            <span className="text-primary font-bold">{score}м</span>
          </div>
        </div>
      )}

      <div 
        className={cn(
          "relative border-4 border-primary shadow-[0_0_40px_rgba(98,38,179,0.3)] overflow-hidden cursor-crosshair transition-transform",
          isShaking && "animate-shake"
        )}
        onClick={handleInput}
      >
        <canvas 
          ref={canvasRef} 
          width={VIRTUAL_WIDTH} 
          height={VIRTUAL_HEIGHT} 
          className="image-pixelated w-full h-auto max-w-[800px]" 
        />
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center p-4 animate-in zoom-in">
            <h2 className="text-2xl text-red-500 mb-4 uppercase glow-text">ПОРАЖЕНИЕ</h2>
            <p className="text-[10px] text-white mb-8 uppercase">ДИСТАНЦИЯ: {score} МЕТРОВ</p>
            <button onClick={handleInput} className="bg-primary px-6 py-3 text-[10px] uppercase hover:bg-accent transition-colors">
              ВОЗРОДИТЬСЯ
            </button>
          </div>
        )}
      </div>

      {gameState === 'PLAYING' && (
        <div className="w-full bg-[#050406] p-4 border-l-4 border-primary h-28 overflow-hidden flex flex-col-reverse gap-2 shadow-inner">
          {combatLog.map((log) => (
            <div key={log.id} className={cn(
              "text-[7px] uppercase flex items-center gap-2 animate-in slide-in-from-left-2",
              log.type === 'success' ? 'text-green-400' : 
              log.type === 'fail' ? 'text-red-400' : 
              log.type === 'critical' ? 'text-accent font-bold' : 'text-gray-500'
            )}>
              <Sword size={8} /> {log.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
