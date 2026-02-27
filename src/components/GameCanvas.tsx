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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface AmbientParticle {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
}

const GameCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const { hp, maxHp, selectedClass, combatLog, selectClass, takeDamage, addLog, resetDnd } = useDnd();
  
  const [gameState, setGameState] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [invulnerableUntil, setInvulnerableUntil] = useState(0);
  const [isShaking, setIsShaking] = useState(false);

  // Фиксированное виртуальное разрешение для портретного режима
  const VIRTUAL_WIDTH = 450;
  const VIRTUAL_HEIGHT = 800;
  const GROUND_Y = VIRTUAL_HEIGHT - 100;
  const PLAYER_X = 60;
  const GRAVITY = 0.65;
  const JUMP_STRENGTH = -14;

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
      jumpsRemaining: 1, 
      maxJumps: 1,
      frame: 0 
    } as Player,
    monsters: [] as Monster[],
    parallax: [0, 0, 0],
    particles: [] as Particle[],
    ambientParticles: [] as AmbientParticle[],
    collisionCooldown: 0,
  });

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.headerColor = '#0D0B12';
    }
  }, []);

  useEffect(() => {
    gameRef.current.ambientParticles = [];
    for (let i = 0; i < 40; i++) {
      gameRef.current.ambientParticles.push({
        x: Math.random() * VIRTUAL_WIDTH, 
        y: Math.random() * VIRTUAL_HEIGHT,
        speed: 0.2 + Math.random() * 0.5,
        size: 1 + Math.random() * 2,
        opacity: 0.1 + Math.random() * 0.4
      });
    }

    const img = new Image();
    img.src = '/Knight2.webp';
    img.onload = () => {
      playerImgRef.current = img;
      setIsImageLoaded(true);
    };
    img.onerror = () => setIsImageLoaded(true);
  }, [VIRTUAL_WIDTH, VIRTUAL_HEIGHT]);

  const createJumpEffect = (x: number, y: number, color = '#6226B3', isSecond = false) => {
    const count = isSecond ? 15 : 10;
    const pColor = isSecond ? '#A855F7' : color;
    for (let i = 0; i < count; i++) {
      gameRef.current.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * (isSecond ? 10 : 6),
        vy: (Math.random() - 0.5) * (isSecond ? 6 : 4),
        life: 1.0,
        color: pColor
      });
    }
  };

  const drawMonster = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const { x, y, width, height, type } = m;
    const time = Date.now();
    ctx.save();
    
    if (type === 'DRAGON') {
      const flap = Math.sin(time * 0.004) * 20;
      ctx.fillStyle = '#450A0A';
      ctx.beginPath();
      ctx.moveTo(x + 50, y + 50);
      ctx.lineTo(x - 30, y + 10 - flap);
      ctx.lineTo(x + 20, y + 70);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + width - 50, y + 50);
      ctx.lineTo(x + width + 30, y + 10 - flap);
      ctx.lineTo(x + width - 20, y + 70);
      ctx.fill();
      ctx.fillStyle = '#7F1D1D'; 
      ctx.fillRect(x + 30, y + 40, width - 60, height - 50);
      ctx.fillStyle = '#991B1B';
      for(let i=0; i<3; i++) for(let j=0; j<3; j++) ctx.fillRect(x + 45 + i*15, y + 50 + j*10, 4, 4);
      ctx.fillStyle = '#7F1D1D';
      ctx.fillRect(x + 5, y + 15, 30, 30);
      ctx.fillRect(x + 25, y + 30, 20, 20);
      ctx.fillStyle = '#450A0A';
      ctx.fillRect(x + 10, y + 5, 4, 12); ctx.fillRect(x + 25, y + 5, 4, 12);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(x + 12, y + 22, 6, 6);
      const fireSize = Math.random() * 8;
      ctx.fillStyle = '#EA580C';
      ctx.fillRect(x - 5 - fireSize, y + 35, 15 + fireSize, 6);
    } else if (type === 'BEHOLDER') {
      const float = Math.sin(time * 0.005) * 10;
      const fy = y + float;
      ctx.fillStyle = '#6D102A';
      ctx.beginPath(); ctx.arc(x + width/2, fy + height/2, width/2, 0, Math.PI * 2); ctx.fill();
      for(let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5 + time * 0.002;
        const ox = x + width/2 + Math.cos(angle) * (width/2 + 5);
        const oy = fy + height/2 + Math.sin(angle) * (height/2 + 5);
        ctx.fillStyle = '#4D081A'; ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(x + width/2, fy + height/2, width/4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(x + width/2 + Math.cos(time * 0.003) * 4, fy + height/2 + Math.sin(time * 0.003) * 2, 4, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'SLIME') {
      const wobble = Math.sin(time * 0.01) * 4;
      ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
      ctx.beginPath(); ctx.ellipse(x + width/2, y + height/2 + wobble/2, width/2 + wobble, height/2 - wobble/2, 0, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'BAT') {
      const flap = Math.sin(time * 0.02) * 10;
      ctx.fillStyle = '#4B5563';
      ctx.beginPath(); ctx.moveTo(x, y + flap); ctx.lineTo(x + width/2, y + height/2); ctx.lineTo(x + width, y + flap); ctx.stroke();
      ctx.fillRect(x + width/2 - 4, y + height/2 - 4, 8, 8);
    } else if (type === 'OGRE') {
      ctx.fillStyle = '#14532D';
      ctx.fillRect(x + 10, y + 10, width - 20, height - 10);
      ctx.fillStyle = '#3F6212';
      ctx.fillRect(x + 20, y, 20, 20);
      ctx.fillStyle = '#422006';
      ctx.fillRect(x - 5, y + 20, 15, 40);
    } else if (type === 'GHOST') {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.6)';
      ctx.beginPath();
      ctx.moveTo(x + width/2, y);
      ctx.quadraticCurveTo(x + width, y + height/4, x + width, y + height/2);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x, y + height/2);
      ctx.quadraticCurveTo(x, y + height/4, x + width/2, y);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.fillRect(x + 10, y + 15, 4, 4);
      ctx.fillRect(x + width - 14, y + 15, 4, 4);
    } else {
      ctx.fillStyle = ASSET_MANIFEST.MONSTERS[type as keyof typeof ASSET_MANIFEST.MONSTERS]?.color || '#333';
      ctx.fillRect(x, y, width, height);
    }
    
    ctx.restore();
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    gameRef.current.ambientParticles.forEach(p => {
      ctx.fillStyle = '#EAB308';
      ctx.globalAlpha = p.opacity;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      p.x -= p.speed * (engineRef.current.speed / 5);
      if (p.x < -10) p.x = VIRTUAL_WIDTH + 10;
    });
    ctx.globalAlpha = 1.0;

    let offset0 = gameRef.current.parallax[0] % 400;
    for (let x = -offset0; x < VIRTUAL_WIDTH + 400; x += 400) {
      ctx.fillStyle = '#0D0B12';
      ctx.fillRect(x + 150, 0, 100, VIRTUAL_HEIGHT);
      const torchX = x + 200;
      const torchY = 300;
      ctx.fillStyle = '#2D1409'; ctx.fillRect(torchX - 2, torchY, 4, 15);
      const flicker = Math.random() * 5;
      const grad = ctx.createRadialGradient(torchX, torchY, 0, torchX, torchY, 20 + flicker);
      grad.addColorStop(0, '#F59E0B'); grad.addColorStop(1, 'rgba(234, 179, 8, 0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(torchX, torchY, 20 + flicker, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#16121D';
    let offset1 = gameRef.current.parallax[1] % 300;
    for (let x = -offset1; x < VIRTUAL_WIDTH + 300; x += 300) {
      ctx.fillRect(x + 50, GROUND_Y - 300, 100, 300);
      ctx.beginPath(); ctx.arc(x + 100, GROUND_Y - 300, 50, 0, Math.PI, true); ctx.fill();
    }

    ctx.fillStyle = '#0A080D';
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
    let offset2 = gameRef.current.parallax[2] % 100;
    ctx.strokeStyle = '#25202D';
    for (let x = -offset2; x < VIRTUAL_WIDTH + 100; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, VIRTUAL_HEIGHT); ctx.stroke();
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
    grad.addColorStop(0, '#020103');
    grad.addColorStop(1, '#08060A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    drawBackground(ctx);

    gameRef.current.particles.forEach((p, i) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 4, 4);
      p.x += p.vx; p.y += p.vy; p.life -= 0.03;
      if (p.life <= 0) gameRef.current.particles.splice(i, 1);
    });
    ctx.globalAlpha = 1.0;

    gameRef.current.monsters.forEach(m => drawMonster(ctx, m));
    
    const p = gameRef.current.player;
    const isInvul = Date.now() < invulnerableUntil;
    if (!(isInvul && Math.floor(Date.now() / 100) % 2 === 0)) {
      if (playerImgRef.current) {
        ctx.drawImage(playerImgRef.current, p.x, p.y, p.width, p.height);
        if (selectedClass?.name === 'ROGUE' && p.jumpsRemaining > 0 && p.y < GROUND_Y - p.height - 20) {
          ctx.save();
          ctx.globalAlpha = 0.2 + Math.sin(Date.now() * 0.01) * 0.1;
          ctx.fillStyle = '#A855F7';
          ctx.beginPath(); ctx.arc(p.x + p.width/2, p.y + p.height/2, 45, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
    }

    if (gameState === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#6226B3';
      ctx.font = '14px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('НАЖМИТЕ ДЛЯ НАЧАЛА', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    }
  }, [gameState, invulnerableUntil, selectedClass, VIRTUAL_WIDTH, VIRTUAL_HEIGHT, GROUND_Y]);

  const handleUpdate = useCallback(({ deltaTime, timestamp }: { deltaTime: number, timestamp: number }) => {
    if (gameState === 'PLAYING') {
      const dtFactor = deltaTime / 16.67;
      engineRef.current.elapsedTime += deltaTime / 1000;
      engineRef.current.speed = calculateSpeed(engineRef.current.elapsedTime);
      const currentSpeed = engineRef.current.speed;

      gameRef.current.parallax[0] += currentSpeed * 0.15 * dtFactor;
      gameRef.current.parallax[1] += currentSpeed * 0.5 * dtFactor;
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

      // Логика спавна монстров с учетом окна выживаемости
      if (timestamp - gameRef.current.collisionCooldown > (1600 / (currentSpeed/5)) && Math.random() < 0.04 * dtFactor) {
        const monsterTypes: MonsterType[] = ['SLIME', 'MIMIC', 'BEHOLDER', 'BAT', 'DRAGON', 'OGRE', 'GHOST'];
        const type = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];
        const config = ASSET_MANIFEST.MONSTERS[type as keyof typeof ASSET_MANIFEST.MONSTERS] || ASSET_MANIFEST.MONSTERS.SLIME;
        
        let yPos = GROUND_Y - config.height;
        if (config.type === 'AIR_LOW') yPos = GROUND_Y - 110;
        if (config.type === 'AIR_HIGH') yPos = GROUND_Y - 200;

        monsters.push({
          id: Math.random().toString(),
          type,
          obstacleType: config.type as any,
          x: VIRTUAL_WIDTH + 100,
          y: yPos,
          width: config.width,
          height: config.height,
          speed: currentSpeed,
        });
        gameRef.current.collisionCooldown = timestamp;
      }

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
        if (m.x + m.width < -150) monsters.splice(i, 1);
      }
      if (hp <= 0) setGameState('GAME_OVER');
      setScore(Math.floor(engineRef.current.distance));
    }
    draw();
  }, [gameState, hp, selectedClass, invulnerableUntil, addLog, takeDamage, draw, GROUND_Y, VIRTUAL_WIDTH]);

  useGameLoop(handleUpdate, true);

  const startNewGame = useCallback((cls?: any) => {
    const currentCls = cls || selectedClass;
    if (!currentCls) return;

    engineRef.current.elapsedTime = 0;
    engineRef.current.distance = 0;
    gameRef.current.monsters = [];
    gameRef.current.particles = [];
    gameRef.current.player.y = GROUND_Y - ASSET_MANIFEST.PLAYER.height;
    gameRef.current.player.vy = 0;
    gameRef.current.player.maxJumps = currentCls.maxJumps || 1;
    gameRef.current.player.jumpsRemaining = gameRef.current.player.maxJumps;
    resetDnd();
    setGameState('PLAYING');
    setScore(0);
  }, [selectedClass, resetDnd, GROUND_Y]);

  const handleInput = useCallback(() => {
    if (gameState === 'START' || gameState === 'GAME_OVER') {
      setGameState('CLASS_SELECTION');
    } else if (gameState === 'PLAYING') {
      const { player } = gameRef.current;
      if (player.jumpsRemaining > 0) {
        player.vy = JUMP_STRENGTH * (selectedClass?.jumpMultiplier || 1.0);
        const isSecond = player.jumpsRemaining < player.maxJumps;
        player.jumpsRemaining--;
        createJumpEffect(player.x + player.width / 2, player.y + player.height, isSecond ? '#A855F7' : '#6226B3', isSecond);
      }
    }
  }, [gameState, selectedClass]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); handleInput(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput]);

  if (!isImageLoaded) {
    return (
      <div className="flex flex-col items-center justify-center bg-[#0A080D] w-full h-full">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-[10px] uppercase text-secondary">ЗАГРУЗКА...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col select-none overflow-hidden touch-none relative bg-[#050406]">
      {gameState === 'CLASS_SELECTION' && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
          <h2 className="text-xl text-primary mb-8 uppercase glow-text">ВЫБЕРИТЕ КЛАСС</h2>
          <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
            {(Object.keys(CHARACTER_CLASSES) as CharacterClassName[]).map((key) => {
              const cls = CHARACTER_CLASSES[key];
              return (
                <button
                  key={key}
                  onClick={() => { selectClass(key); startNewGame(cls); }}
                  className="bg-[#1A1621] border-2 border-primary p-4 active:scale-95 transition-all flex flex-col items-center gap-2"
                >
                  <div className="flex items-center gap-3">
                    {key === 'FIGHTER' && <Shield className="text-primary w-5 h-5" />}
                    {key === 'ROGUE' && <Zap className="text-accent w-5 h-5" />}
                    {key === 'WIZARD' && <Wand2 className="text-secondary w-5 h-5" />}
                    <span className="text-[12px] font-bold uppercase">{cls.label}</span>
                  </div>
                  <div className="text-[8px] text-secondary opacity-80">AC: {cls.armorClass} | HP: {cls.maxHp}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Игровая зона 2/3 */}
      <div 
        ref={containerRef}
        className={cn(
          "relative w-full h-[66vh] cursor-pointer overflow-hidden bg-black",
          isShaking && "animate-shake"
        )}
        onClick={handleInput}
      >
        {gameState !== 'START' && gameState !== 'CLASS_SELECTION' && (
          <div className="absolute top-0 left-0 right-0 h-[6vh] flex justify-between items-center bg-[#0D0B12]/60 p-3 px-6 backdrop-blur-sm z-10">
            <div className="flex gap-1.5">
              {Array.from({ length: maxHp }).map((_, i) => (
                <Heart key={i} size={14} fill={i < hp ? '#ff0000' : 'none'} color={i < hp ? '#ff0000' : '#333'} className={i < hp ? 'animate-pulse' : ''} />
              ))}
            </div>
            <div className="flex flex-col items-end">
               <span className="text-[10px] text-primary font-bold">{score}м</span>
               <span className="text-[7px] text-secondary opacity-60 uppercase">{selectedClass?.label}</span>
            </div>
          </div>
        )}

        <canvas 
          ref={canvasRef} 
          width={VIRTUAL_WIDTH} 
          height={VIRTUAL_HEIGHT} 
          className="image-pixelated w-full h-full block" 
        />
        
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center p-4 animate-in zoom-in">
            <h2 className="text-xl text-red-500 mb-2 uppercase glow-text">ФИНАЛ</h2>
            <p className="text-[10px] text-white mb-6 uppercase">ДИСТАНЦИЯ: {score} МЕТРОВ</p>
            <button onClick={handleInput} className="bg-primary px-8 py-3 text-[10px] uppercase active:scale-90 transition-transform shadow-[0_4px_0_#4D1091]">
              ПОПРОБОВАТЬ СНОВА
            </button>
          </div>
        )}
      </div>

      {/* Лог боя 1/3 */}
      <div className="w-full h-[34vh] bg-[#050406] p-4 overflow-y-auto flex flex-col gap-2 border-t-2 border-primary/20 scrollbar-hide">
        {combatLog.map((log) => (
          <div key={log.id} className={cn(
            "text-[8px] uppercase flex items-center gap-2 animate-in slide-in-from-left-2",
            log.type === 'success' ? 'text-green-400' : 
            log.type === 'fail' ? 'text-red-400' : 
            log.type === 'critical' ? 'text-accent font-bold' : 'text-gray-500'
          )}>
            <Sword size={10} /> {log.text}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default GameCanvas;