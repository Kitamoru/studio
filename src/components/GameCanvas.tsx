
"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Player, Monster, MonsterType, GameStatus, EngineState, CharacterClassName } from '@/types/game';
import { useGameLoop } from '@/hooks/use-game-loop';
import { calculateSpeed, checkCollision } from '@/lib/game-math';
import { useDnd } from '@/context/dnd-context';
import { performACCheck, CHARACTER_CLASSES } from '@/lib/dnd-logic';
import { ASSET_MANIFEST } from '@/lib/asset-manifest';
import { Heart, Shield, Zap, Wand2, Loader2, Sword, Music } from 'lucide-react';
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
  const { hp, maxHp, selectedClass, combatLog, selectClass, takeDamage, heal, addLog, resetDnd } = useDnd();
  
  const [gameState, setGameState] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [invulnerableUntil, setInvulnerableUntil] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const lastRegenRef = useRef(0);

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
    parallax: [0, 0, 0, 0],
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
        opacity: 0.2 + Math.random() * 0.4
      });
    }

    const img = new Image();
    img.src = '/Knight2.webp';
    img.onload = () => {
      playerImgRef.current = img;
      setIsImageLoaded(true);
    };
    img.onerror = () => setIsImageLoaded(true);
  }, []);

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
      const flap = Math.sin(time * 0.005) * 35;
      const hover = Math.sin(time * 0.003) * 8;
      const dy = y + hover;

      const bodyGrad = ctx.createLinearGradient(x, dy, x + width, dy + height);
      bodyGrad.addColorStop(0, '#991B1B');
      bodyGrad.addColorStop(1, '#450A0A');
      ctx.fillStyle = bodyGrad;
      
      ctx.beginPath();
      ctx.moveTo(x + width - 20, dy + height/2);
      ctx.quadraticCurveTo(x + width + 50, dy + height/2 + Math.sin(time*0.004)*40, x + width + 20, dy + height - 10);
      ctx.strokeStyle = '#450A0A'; ctx.lineWidth = 14; ctx.stroke();

      ctx.fillStyle = '#450A0A';
      [ {ox: 30, sx: 1}, {ox: 10, sx: -1} ].forEach(wing => {
        ctx.save();
        ctx.translate(x + width/2 + wing.ox, dy + 40);
        ctx.scale(wing.sx, 1);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(80, -60 - flap, 100, 20);
        ctx.quadraticCurveTo(50, 40, 0, 10);
        ctx.fill();
        ctx.restore();
      });

      ctx.beginPath();
      ctx.roundRect(x + 20, dy + 20, width - 40, height - 20, [30, 10, 10, 30]);
      ctx.fill();

      ctx.fillStyle = '#1A0202';
      for(let i=0; i<5; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 35 + i*18, dy + 20);
        ctx.lineTo(x + 44 + i*18, dy + 2);
        ctx.lineTo(x + 53 + i*18, dy + 20);
        ctx.fill();
      }

      ctx.fillStyle = '#7F1D1D';
      ctx.beginPath();
      ctx.roundRect(x - 10, dy + 10, 55, 45, [20, 5, 5, 20]);
      ctx.fill();

      const eyeGlow = ctx.createRadialGradient(x+8, dy+25, 0, x+8, dy+25, 12);
      eyeGlow.addColorStop(0, '#FDE047');
      eyeGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = eyeGlow;
      ctx.beginPath(); ctx.arc(x+8, dy+25, 12, 0, Math.PI*2); ctx.fill();

      const fireLen = 40 + Math.random() * 40;
      const fireGrad = ctx.createRadialGradient(x-5, dy+30, 5, x-fireLen, dy+35, fireLen);
      fireGrad.addColorStop(0, '#F59E0B');
      fireGrad.addColorStop(0.4, '#EF4444');
      fireGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.moveTo(x, dy + 25);
      ctx.quadraticCurveTo(x - fireLen/2, dy + 10 + Math.sin(time*0.02)*20, x - fireLen, dy + 35);
      ctx.quadraticCurveTo(x - fireLen/2, dy + 50 + Math.sin(time*0.02)*20, x, dy + 40);
      ctx.fill();

    } else if (type === 'OGRE') {
      ctx.fillStyle = '#166534';
      ctx.beginPath(); ctx.roundRect(x + 5, y + 15, width - 10, height - 15, 15); ctx.fill();
      ctx.fillStyle = '#422006';
      ctx.beginPath(); ctx.roundRect(x, y + 10, 30, 25, 8); ctx.fill();
      ctx.fillStyle = '#14532D';
      ctx.beginPath(); ctx.roundRect(x + 10, y, 40, 35, 10); ctx.fill();
      
      ctx.save();
      const clubSwing = Math.sin(time * 0.007) * 0.8;
      ctx.translate(x + width - 5, y + 50);
      ctx.rotate(clubSwing);
      ctx.fillStyle = '#422006';
      ctx.fillRect(-4, -40, 12, 60);
      ctx.fillStyle = '#713F12';
      ctx.beginPath(); ctx.arc(2, -40, 18, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 3;
      for(let i=0; i<6; i++) {
        const ang = (i * Math.PI * 2) / 6;
        ctx.beginPath();
        ctx.moveTo(2 + Math.cos(ang)*15, -40 + Math.sin(ang)*15);
        ctx.lineTo(2 + Math.cos(ang)*24, -40 + Math.sin(ang)*24);
        ctx.stroke();
      }
      ctx.restore();

    } else if (type === 'MIMIC') {
      const snap = Math.sin(time * 0.015) * 10;
      ctx.fillStyle = '#261102';
      ctx.beginPath(); ctx.roundRect(x, y + 10, width, height - 10, 6); ctx.fill();
      ctx.strokeStyle = '#3F2305'; ctx.lineWidth = 2;
      for(let i=1; i<3; i++) {
        ctx.beginPath(); ctx.moveTo(x + i*(width/3), y + 12); ctx.lineTo(x + i*(width/3), y + height); ctx.stroke();
      }
      ctx.fillStyle = '#A16207';
      ctx.fillRect(x, y + 10, 8, height - 10);
      ctx.fillRect(x + width - 8, y + 10, 8, height - 10);
      
      for(let i=0; i<4; i++) {
        const ex = x + 8 + i*10;
        const ey = y + 20 + Math.sin(time*0.012 + i)*5;
        ctx.fillStyle = '#EAB308'; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(ex, ey, 1.5, 0, Math.PI*2); ctx.fill();
      }

      ctx.fillStyle = '#BE123C';
      ctx.beginPath();
      ctx.moveTo(x + width/2, y + 30);
      ctx.quadraticCurveTo(x + width + 30 + snap, y + 15 + Math.sin(time*0.015)*25, x + width/2, y + 45);
      ctx.fill();

      ctx.fillStyle = '#F8FAFC';
      for(let i=0; i<8; i++) {
        const tx = x + 2 + i*6;
        ctx.beginPath(); ctx.moveTo(tx, y + 10); ctx.lineTo(tx + 3, y + 22 + snap); ctx.lineTo(tx + 6, y + 10); ctx.fill();
      }
    } else if (type === 'SLIME') {
      const wobble = Math.sin(time * 0.01) * 8;
      ctx.fillStyle = 'rgba(74, 222, 128, 0.4)'; 
      ctx.beginPath(); ctx.ellipse(x + width/2, y + height - (height/2-wobble/2), width/2+wobble, height/2-wobble/2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(21, 128, 61, 0.8)'; 
      ctx.beginPath(); ctx.arc(x + width/2, y + height - 15, 8, 0, Math.PI*2); ctx.fill();
    } else if (type === 'BEHOLDER') {
      const float = Math.sin(time * 0.005) * 12;
      const fy = y + float;
      ctx.fillStyle = '#6D102A';
      ctx.beginPath(); ctx.arc(x + width/2, fy + height/2, width/2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(x + width/2, fy + height/2, width/4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(x + width/2 + Math.cos(time*0.003)*5, fy + height/2 + Math.sin(time*0.003)*3, 6, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = ASSET_MANIFEST.MONSTERS[type as keyof typeof ASSET_MANIFEST.MONSTERS]?.color || 'red';
      ctx.fillRect(x, y, width, height);
    }
    
    ctx.restore();
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    // 1. Самый дальний слой: Темная стена
    ctx.fillStyle = '#050406';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, GROUND_Y);

    // 2. Факелы на дальней стене (движутся со скоростью дальней стены)
    let farOffset = gameRef.current.parallax[0] % 400;
    for (let x = -farOffset; x < VIRTUAL_WIDTH + 400; x += 400) {
      const tx = x + 150;
      const ty = 250;
      const flicker = Math.random() * 6;
      
      const grad = ctx.createRadialGradient(tx, ty, 2, tx, ty, 45 + flicker);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.5)'); 
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad; 
      ctx.beginPath(); ctx.arc(tx, ty, 45 + flicker, 0, Math.PI * 2); ctx.fill();
      
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath(); ctx.moveTo(tx-4, ty+5); ctx.quadraticCurveTo(tx, ty-10-flicker, tx+4, ty+5); ctx.fill();
    }

    // 3. Слой арок/колонн (движется быстрее, перекрывает факелы)
    let archOffset = gameRef.current.parallax[1] % 500;
    for (let x = -archOffset; x < VIRTUAL_WIDTH + 500; x += 500) {
      ctx.fillStyle = '#16131C';
      // Сама колонна
      const columnWidth = 140;
      const columnX = x + 180;
      
      // Рисуем арку
      ctx.beginPath();
      ctx.roundRect(columnX, 100, columnWidth, GROUND_Y - 100, [70, 70, 0, 0]);
      ctx.fill();
      
      // Небольшая текстура на колонне
      ctx.strokeStyle = '#1E1A26'; ctx.lineWidth = 1;
      for(let i=0; i<5; i++) {
        ctx.beginPath(); ctx.moveTo(columnX + 20, 250 + i*80); ctx.lineTo(columnX + columnWidth - 20, 250 + i*80); ctx.stroke();
      }
    }

    // 4. Летающая пыль (между арками и игроком)
    gameRef.current.ambientParticles.forEach(p => {
      ctx.fillStyle = '#EAB308';
      ctx.globalAlpha = p.opacity;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      p.x -= p.speed * (engineRef.current.speed / 5);
      if (p.x < -10) { p.x = VIRTUAL_WIDTH + 10; p.y = Math.random() * VIRTUAL_HEIGHT; }
    });
    ctx.globalAlpha = 1.0;

    // 5. Пол (в стиле скриншота)
    ctx.fillStyle = '#050406';
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - GROUND_Y);
    
    // Фиолетовая линия по верху пола
    ctx.fillStyle = '#6226B3';
    ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, 4);
    
    // Вертикальные линии разделения пола
    let floorOffset = gameRef.current.parallax[2] % 120;
    ctx.strokeStyle = '#1A1621'; ctx.lineWidth = 2;
    for (let x = -floorOffset; x < VIRTUAL_WIDTH + 120; x += 120) {
      ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 4); ctx.lineTo(x, VIRTUAL_HEIGHT); ctx.stroke();
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
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
  }, [gameState, invulnerableUntil, VIRTUAL_WIDTH, VIRTUAL_HEIGHT, GROUND_Y]);

  const handleUpdate = useCallback(({ deltaTime, timestamp }: { deltaTime: number, timestamp: number }) => {
    if (gameState === 'PLAYING') {
      const dtFactor = deltaTime / 16.67;
      
      engineRef.current.elapsedTime += deltaTime / 1000;
      engineRef.current.speed = calculateSpeed(engineRef.current.elapsedTime);
      const currentSpeed = engineRef.current.speed;

      gameRef.current.parallax[0] += currentSpeed * 0.3 * dtFactor; // Стена (Факелы)
      gameRef.current.parallax[1] += currentSpeed * 0.7 * dtFactor; // Арки (Перекрывают)
      gameRef.current.parallax[2] += currentSpeed * 1.0 * dtFactor; // Пол

      const { player, monsters } = gameRef.current;
      player.vy += GRAVITY * dtFactor;
      player.y += player.vy * dtFactor;

      if (player.y > GROUND_Y - player.height) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.state = 'RUNNING';
        player.jumpsRemaining = player.maxJumps;
      }

      const scoreMultiplier = selectedClass?.name === 'WIZARD' ? 1.25 : 1.0;
      engineRef.current.distance += currentSpeed * dtFactor * 0.1 * scoreMultiplier;

      if (selectedClass?.name === 'BARD' && timestamp - lastRegenRef.current > 20000) {
        if (hp < maxHp) { heal(1); addLog("БАРД: РЕГЕНЕРАЦИЯ (+1 HP)", 'success'); }
        lastRegenRef.current = timestamp;
      }

      if (timestamp - gameRef.current.collisionCooldown > (1800 / (currentSpeed/5)) && Math.random() < 0.04 * dtFactor) {
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
          x: VIRTUAL_WIDTH + 150,
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
          setIsShaking(true); setTimeout(() => setIsShaking(false), 300);
          if (selectedClass) {
            const check = performACCheck(selectedClass.armorClass);
            if (check.type === 'SUCCESS' || check.type === 'CRIT_SUCCESS') {
              addLog(check.message, 'success'); setInvulnerableUntil(Date.now() + 1000);
            } else {
              addLog(check.message, 'fail'); takeDamage(1); setInvulnerableUntil(Date.now() + 1500);
            }
          }
        }
        if (m.x + m.width < -200) monsters.splice(i, 1);
      }
      if (hp <= 0) setGameState('GAME_OVER');
      setScore(Math.floor(engineRef.current.distance));
    }
    draw();
  }, [gameState, hp, maxHp, selectedClass, invulnerableUntil, addLog, takeDamage, heal, draw, GROUND_Y, VIRTUAL_WIDTH]);

  useGameLoop(handleUpdate, true);

  const startNewGame = useCallback((cls?: any) => {
    const currentCls = cls || selectedClass;
    if (!currentCls) return;
    engineRef.current.elapsedTime = 0; engineRef.current.distance = 0;
    gameRef.current.monsters = []; gameRef.current.particles = [];
    gameRef.current.player.y = GROUND_Y - ASSET_MANIFEST.PLAYER.height;
    gameRef.current.player.vy = 0;
    gameRef.current.player.maxJumps = currentCls.maxJumps || 1;
    gameRef.current.player.jumpsRemaining = gameRef.current.player.maxJumps;
    lastRegenRef.current = 0; setInvulnerableUntil(0); resetDnd(); setGameState('PLAYING'); setScore(0);
  }, [selectedClass, resetDnd, GROUND_Y]);

  const handleInput = useCallback(() => {
    if (gameState === 'START' || gameState === 'GAME_OVER') setGameState('CLASS_SELECTION');
    else if (gameState === 'PLAYING') {
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
    const handleKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); handleInput(); } };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput]);

  if (!isImageLoaded) return <div className="flex flex-col items-center justify-center bg-[#0A080D] w-full h-full"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;

  return (
    <div className="w-full h-screen flex flex-col select-none overflow-hidden touch-none relative bg-[#050406]">
      {gameState === 'CLASS_SELECTION' && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl text-primary mb-8 uppercase glow-text">ВЫБЕРИТЕ КЛАСС</h2>
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            {(Object.keys(CHARACTER_CLASSES) as CharacterClassName[]).map((key) => {
              const cls = CHARACTER_CLASSES[key];
              return (
                <button key={key} onClick={() => { selectClass(key); startNewGame(cls); }} className="bg-[#1A1621] border-2 border-primary p-4 active:scale-95 transition-all">
                  <div className="flex flex-col items-center gap-2">
                    {key === 'FIGHTER' && <Shield className="text-primary w-6 h-6" />}
                    {key === 'ROGUE' && <Zap className="text-accent w-6 h-6" />}
                    {key === 'WIZARD' && <Wand2 className="text-secondary w-6 h-6" />}
                    {key === 'BARD' && <Music className="text-pink-400 w-6 h-6" />}
                    <span className="text-[10px] font-bold uppercase">{cls.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div ref={containerRef} className={cn("relative w-full h-[66vh] cursor-pointer overflow-hidden bg-black mx-auto", isShaking && "animate-shake")} style={{ maxWidth: '800px' }} onClick={handleInput}>
        {gameState !== 'START' && gameState !== 'CLASS_SELECTION' && (
          <div className="absolute top-0 left-0 right-0 h-[6vh] flex justify-between items-center bg-[#0D0B12]/60 p-3 px-6 backdrop-blur-sm z-10">
            <div className="flex gap-1.5">
              {Array.from({ length: maxHp }).map((_, i) => (
                <Heart key={i} size={14} fill={i < hp ? '#ff0000' : 'none'} color={i < hp ? '#ff0000' : '#333'} />
              ))}
            </div>
            <div className="text-right">
               <div className="text-[10px] text-primary font-bold">{score}м</div>
               <div className="text-[7px] text-secondary opacity-60 uppercase">{selectedClass?.label}</div>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} width={VIRTUAL_WIDTH} height={VIRTUAL_HEIGHT} className="image-pixelated w-full h-full block mx-auto" />
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center p-4">
            <h2 className="text-xl text-red-500 mb-2 uppercase glow-text">ФИНАЛ</h2>
            <p className="text-[10px] text-white mb-6 uppercase">ДИСТАНЦИЯ: {score} МЕТРОВ</p>
            <button onClick={handleInput} className="bg-primary px-8 py-3 text-[10px] uppercase shadow-[0_4px_0_#4D1091]">ИГРАТЬ СНОВА</button>
          </div>
        )}
      </div>

      <div className="w-full h-[34vh] bg-[#050406] p-4 overflow-y-auto flex flex-col gap-2 border-t-2 border-primary/20 mx-auto" style={{ maxWidth: '800px' }}>
        {combatLog.map((log) => (
          <div key={log.id} className={cn("text-[8px] uppercase flex items-center gap-2", log.type === 'success' ? 'text-green-400' : log.type === 'fail' ? 'text-red-400' : 'text-gray-500')}>
            <Sword size={10} /> {log.text}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default GameCanvas;
