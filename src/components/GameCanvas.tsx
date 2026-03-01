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
import { useTelegramUser } from '@/context/telegram-context';
import { Leaderboard } from './Leaderboard';

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
  vy: number; // легкое вертикальное движение
  size: number;
  baseOpacity: number; // базовая прозрачность
  phase: number; // фаза для мерцания
}

interface Coin {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
  frame: number;
}

const GameCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const { hp, maxHp, selectedClass, combatLog, selectClass, takeDamage, heal, addLog, resetDnd } = useDnd();

  const { user, initData } = useTelegramUser();

  const [gameState, setGameState] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [collectedCoins, setCollectedCoins] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [invulnerableUntil, setInvulnerableUntil] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 450, height: 800 });
  const lastRegenRef = useRef(0);
  const scoreSavedRef = useRef(false);

  // Константы для логики (высота остается фиксированной для физики)
  const VIRTUAL_HEIGHT = 800;
  const GROUND_Y = VIRTUAL_HEIGHT - 100;
  const PLAYER_X = 60;
  const GRAVITY = 0.65;
  const JUMP_STRENGTH = -14;

  const engineRef = useRef<EngineState & { collectedCoins: number }>({
    speed: 5.0,
    distance: 0,
    status: 'START',
    lastTimestamp: 0,
    elapsedTime: 0,
    collectedCoins: 0,
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
    coins: [] as Coin[],
    parallax: [0, 0, 0, 0],
    particles: [] as Particle[],
    ambientParticles: [] as AmbientParticle[],
    collisionCooldown: 0,
  });

  // Обработка изменения размера экрана и инициализация пыли
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setCanvasSize({ width: clientWidth, height: clientHeight });

        // Инициализация мерцающей пыли
        if (gameRef.current.ambientParticles.length === 0) {
          for (let i = 0; i < 60; i++) {
            gameRef.current.ambientParticles.push({
              x: Math.random() * clientWidth,
              y: Math.random() * GROUND_Y, // пыль летает только над полом
              speed: 0.1 + Math.random() * 0.4,
              vy: (Math.random() - 0.5) * 0.2, // легкое покачивание по вертикали
              size: 0.5 + Math.random() * 2.5,
              baseOpacity: 0.1 + Math.random() * 0.4,
              phase: Math.random() * Math.PI * 2
            });
          }
        }
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [GROUND_Y]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.headerColor = '#0D0B12';

      tg.BackButton.show();
      tg.BackButton.onClick(() => tg.close());

      return () => {
        tg.BackButton.hide();
      };
    }
  }, []);

  useEffect(() => {
    const img = new Image();
    img.src = '/Knight2.webp';
    img.onload = () => {
      playerImgRef.current = img;
      setIsImageLoaded(true);
    };
    img.onerror = () => setIsImageLoaded(true);
  }, []);

  const saveScore = useCallback(async () => {
    if (scoreSavedRef.current || (!initData && !user)) return;
    scoreSavedRef.current = true;

    try {
      const payload = initData
        ? { initData, score: Math.floor(engineRef.current.distance), coins: engineRef.current.collectedCoins, characterClass: selectedClass?.name ?? null }
        : { telegramId: user!.id, username: user!.displayName, score: Math.floor(engineRef.current.distance), coins: engineRef.current.collectedCoins, characterClass: selectedClass?.name ?? null };

      await fetch('/api/game/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      window.dispatchEvent(new Event('game:score-saved'));
    } catch (err) {
      console.error('Failed to save score:', err);
    }
  }, [initData, user, selectedClass]);

  useEffect(() => {
    if (gameState === 'GAME_OVER') {
      saveScore();
    }
  }, [gameState, saveScore]);

  const createParticleEffect = (x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      gameRef.current.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color
      });
    }
  };

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

  const drawDragon = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, time: number) => {
  const flap = Math.sin(time * 0.005) * 20;        // взмах крыльев
  const hover = Math.sin(time * 0.003) * 8;        // парение

  // ---- Тело (овал) ----
  const bodyX = x + width * 0.4;
  const bodyY = y + height * 0.6 + hover;
  const bodyWidth = width * 0.6;
  const bodyHeight = height * 0.4;

  const bodyGrad = ctx.createRadialGradient(bodyX - 10, bodyY - 10, 5, bodyX, bodyY, bodyWidth);
  bodyGrad.addColorStop(0, '#B91C1C');
  bodyGrad.addColorStop(0.7, '#7F1D1D');
  bodyGrad.addColorStop(1, '#450A0A');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(bodyX, bodyY, bodyWidth / 2, bodyHeight / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Шипы на спине
  ctx.fillStyle = '#1A0202';
  for (let i = 0; i < 5; i++) {
    const spikeX = bodyX - bodyWidth / 2 + 10 + i * 20;
    const spikeY = bodyY - bodyHeight / 2 - 5;
    ctx.beginPath();
    ctx.moveTo(spikeX - 5, spikeY);
    ctx.lineTo(spikeX, spikeY - 12);
    ctx.lineTo(spikeX + 5, spikeY);
    ctx.fill();
  }

  // ---- Шея и голова ----
  const neckX = bodyX - bodyWidth / 2 + 5;
  const neckY = bodyY - bodyHeight / 3;
  ctx.strokeStyle = '#7F1D1D';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(neckX, neckY);
  ctx.quadraticCurveTo(neckX - 15, neckY - 30, neckX - 35, neckY - 45);
  ctx.stroke();

  // Голова
  const headX = neckX - 40;
  const headY = neckY - 50;
  ctx.fillStyle = '#7F1D1D';
  ctx.beginPath();
  ctx.ellipse(headX, headY, 18, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Пасть
  ctx.fillStyle = '#450A0A';
  ctx.beginPath();
  ctx.ellipse(headX - 5, headY + 4, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Зубы
  ctx.fillStyle = '#F8FAFC';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(headX - 12 + i * 6, headY + 2);
    ctx.lineTo(headX - 9 + i * 6, headY - 3);
    ctx.lineTo(headX - 6 + i * 6, headY + 2);
    ctx.fill();
  }

  // Рога
  ctx.fillStyle = '#EAB308';
  ctx.beginPath();
  ctx.moveTo(headX - 2, headY - 10);
  ctx.lineTo(headX - 12, headY - 25);
  ctx.lineTo(headX - 2, headY - 20);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(headX + 2, headY - 10);
  ctx.lineTo(headX + 12, headY - 25);
  ctx.lineTo(headX + 2, headY - 20);
  ctx.fill();

  // Глаза (оригинальные, слегка адаптированы под новую голову)
  const eyeX = headX - 5;
  const eyeY = headY - 6;
  const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 12);
  eyeGlow.addColorStop(0, '#FFF176');
  eyeGlow.addColorStop(0.6, '#F9A825');
  eyeGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = eyeGlow;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'black';
  ctx.fillRect(eyeX - 1, eyeY - 6, 2, 12); // зрачок

  // ---- Крылья ----
  const wingBaseX = bodyX + bodyWidth / 3;
  const wingBaseY = bodyY - bodyHeight / 4;

  // Левое крыло
  ctx.save();
  ctx.translate(wingBaseX, wingBaseY);
  ctx.rotate(0.2 + flap * 0.01);
  ctx.fillStyle = '#7F1D1D';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-50, -70 - flap, -90, -20);
  ctx.quadraticCurveTo(-60, 20, -15, 5);
  ctx.fill();
  // Жилки
  ctx.strokeStyle = '#450A0A';
  ctx.lineWidth = 2;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-i * 20, -i * 5);
    ctx.lineTo(-70, -20 + i * 10);
    ctx.stroke();
  }
  ctx.restore();

  // Правое крыло (зеркально)
  ctx.save();
  ctx.translate(wingBaseX, wingBaseY);
  ctx.scale(-1, 1);
  ctx.rotate(0.2 + flap * 0.01);
  ctx.fillStyle = '#7F1D1D';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-50, -70 - flap, -90, -20);
  ctx.quadraticCurveTo(-60, 20, -15, 5);
  ctx.fill();
  ctx.strokeStyle = '#450A0A';
  ctx.lineWidth = 2;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-i * 20, -i * 5);
    ctx.lineTo(-70, -20 + i * 10);
    ctx.stroke();
  }
  ctx.restore();

  // ---- Хвост ----
  const tailStartX = bodyX + bodyWidth / 2 - 5;
  const tailStartY = bodyY + bodyHeight / 4;
  ctx.strokeStyle = '#7F1D1D';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tailStartX, tailStartY);
  ctx.quadraticCurveTo(tailStartX + 30, tailStartY - 10, tailStartX + 60, tailStartY - 30);
  ctx.stroke();
  // Наконечник хвоста
  ctx.fillStyle = '#450A0A';
  ctx.beginPath();
  ctx.moveTo(tailStartX + 60, tailStartY - 30);
  ctx.lineTo(tailStartX + 70, tailStartY - 45);
  ctx.lineTo(tailStartX + 80, tailStartY - 30);
  ctx.fill();

  // ---- Пламя с искрами ----
  const fireLen = 60 + Math.random() * 60;
  const fireGrad = ctx.createRadialGradient(x - 5, y + 35, 5, x - fireLen, y + 40, fireLen);
  fireGrad.addColorStop(0, '#FFFFFF');
  fireGrad.addColorStop(0.2, '#F59E0B');
  fireGrad.addColorStop(0.5, '#EF4444');
  fireGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = fireGrad;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 28);
  ctx.quadraticCurveTo(
    x - fireLen / 2,
    y + 15 + Math.sin(time * 0.02) * 20,
    x - fireLen,
    y + 38
  );
  ctx.quadraticCurveTo(
    x - fireLen / 2,
    y + 55 + Math.cos(time * 0.02) * 20,
    x + 5,
    y + 42
  );
  ctx.fill();

  // ---- Искры (частицы) ----
  // С вероятностью 30% добавляем искры из пасти
  if (Math.random() < 0.3) {
    const sparkCount = 3 + Math.floor(Math.random() * 4); // 3–6 искр
    for (let i = 0; i < sparkCount; i++) {
      // Позиция около кончика пламени
      const sparkX = x - fireLen * 0.8 + (Math.random() - 0.5) * 30;
      const sparkY = y + 38 + (Math.random() - 0.5) * 20;
      gameRef.current.particles.push({
        x: sparkX,
        y: sparkY,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2 - 1, // лёгкий подъём
        life: 0.8 + Math.random() * 0.4,
        color: `hsl(${20 + Math.random() * 20}, 100%, 60%)`, // жёлто-оранжевые оттенки
      });
    }
  }
};

  // --- УЛУЧШЕННЫЙ ОГР ---
  const drawOgre = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, time: number) => {
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 20, width - 10, height - 20, 20);
    ctx.fill();

    ctx.fillStyle = '#14532D';
    ctx.beginPath(); ctx.arc(x + 10, y + 35, 18, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#15803d';
    ctx.beginPath(); ctx.ellipse(x + width/2, y + height - 25, 20, 15, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.roundRect(x + 10, y, 45, 40, [15, 15, 5, 5]);
    ctx.fill();

    ctx.fillStyle = '#052e16'; ctx.fillRect(x+18, y+12, 30, 4);

    ctx.fillStyle = 'red';
    ctx.beginPath(); ctx.arc(x+25, y+20, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x+40, y+20, 3, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath(); ctx.moveTo(x+20, y+32); ctx.lineTo(x+24, y+24); ctx.lineTo(x+28, y+32); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x+40, y+32); ctx.lineTo(x+44, y+24); ctx.lineTo(x+48, y+32); ctx.fill();

    // Дубина
    ctx.save();
    const clubSwing = Math.sin(time * 0.007) * 0.9;
    ctx.translate(x + width - 5, y + 55);
    ctx.rotate(clubSwing);

    ctx.fillStyle = '#422006';
    ctx.fillRect(-5, -45, 14, 65);
    ctx.fillStyle = '#54300a'; ctx.fillRect(-2, -40, 2, 55);

    ctx.fillStyle = '#713F12'; ctx.beginPath(); ctx.arc(2, -45, 20, 0, Math.PI*2); ctx.fill();

    ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 4;
    for(let i=0; i<8; i++) {
      const ang = (i * Math.PI * 2) / 8;
      ctx.beginPath();
      ctx.moveTo(2 + Math.cos(ang)*15, -45 + Math.sin(ang)*15);
      ctx.lineTo(2 + Math.cos(ang)*30, -45 + Math.sin(ang)*30);
      ctx.stroke();
      ctx.strokeStyle = 'white'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2 + Math.cos(ang)*22, -45 + Math.sin(ang)*22);
      ctx.lineTo(2 + Math.cos(ang)*28, -45 + Math.sin(ang)*28);
      ctx.stroke();
      ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 4;
    }
    ctx.restore();
  };

  const drawMonster = (ctx: CanvasRenderingContext2D, m: Monster) => {
    const { x, y, width, height, type } = m;
    const time = Date.now();
    ctx.save();

    if (type === 'DRAGON') {
      const hover = Math.sin(time * 0.003) * 8;
      drawDragon(ctx, x, y + hover, width, height, time);
    } else if (type === 'OGRE') {
      drawOgre(ctx, x, y, width, height, time);
    } else if (type === 'MIMIC') {
      const snap = Math.abs(Math.sin(time * 0.01)) * 18;
      ctx.fillStyle = '#2D1807';
      ctx.beginPath(); ctx.roundRect(x, y + 25, width, height - 25, 4); ctx.fill();
      ctx.strokeStyle = '#3F2305'; ctx.lineWidth = 1;
      for(let i=5; i<width; i+=10) {
        ctx.beginPath(); ctx.moveTo(x+i, y+27); ctx.lineTo(x+i, y+height-4); ctx.stroke();
      }
      ctx.fillStyle = 'black';
      ctx.fillRect(x + 4, y + 20, width - 8, 10);
      for(let i=0; i<3; i++) {
        const ex = x + 10 + i * 14; const ey = y + 24;
        ctx.fillStyle = '#EAB308'; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(ex, ey, 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#F8FAFC';
      for(let i=0; i<6; i++) {
        const tx = x + 6 + i*6;
        ctx.beginPath(); ctx.moveTo(tx, y + 25); ctx.lineTo(tx + 3, y + 20); ctx.lineTo(tx + 6, y + 25); ctx.fill();
      }
      ctx.save();
      ctx.translate(0, -snap);
      ctx.fillStyle = '#452A12';
      ctx.beginPath(); ctx.roundRect(x, y + 5, width, 18, 6); ctx.fill();
      ctx.fillStyle = '#71717A'; ctx.fillRect(x, y + 5, 8, 18); ctx.fillRect(x + width - 8, y + 5, 8, 18);
      ctx.fillStyle = '#A16207'; ctx.fillRect(x + width/2 - 4, y + 16, 8, 6);
      ctx.fillStyle = '#F8FAFC';
      for(let i=0; i<7; i++) {
        const tx = x + 4 + i*6;
        ctx.beginPath(); ctx.moveTo(tx, y + 23); ctx.lineTo(tx + 3, y + 28); ctx.lineTo(tx + 6, y + 23); ctx.fill();
      }
      ctx.restore();
    } else if (type === 'BAT') {
      const flap = Math.sin(time * 0.02) * 20;
      const hover = Math.sin(time * 0.01) * 15;
      const by = y + hover;
      ctx.fillStyle = '#374151';
      ctx.beginPath(); ctx.ellipse(x + width/2, by + height/2, 10, 14, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1F2937';
      [1, -1].forEach(side => {
        ctx.save();
        ctx.translate(x + width/2, by + height/2);
        ctx.scale(side, 1);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(30, -30 - flap, 45, 0); ctx.quadraticCurveTo(30, 20, 15, 5); ctx.quadraticCurveTo(5, 15, 0, 0); ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle = '#1F2937'; ctx.beginPath(); ctx.arc(x+width/2, by+height/2-10, 8, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(x+width/2-3, by+height/2-10, 2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x+width/2+3, by+height/2-10, 2, 0, Math.PI*2); ctx.fill();
    } else if (type === 'SLIME') {
      const wobble = Math.sin(time * 0.01) * 10;
      ctx.fillStyle = 'rgba(74, 222, 128, 0.5)'; ctx.beginPath(); ctx.ellipse(x + width/2, y + height - (height/2-wobble/2), width/2+wobble, height/2-wobble/2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(21, 128, 61, 0.9)'; ctx.beginPath(); ctx.arc(x + width/2, y + height - 18, 10, 0, Math.PI*2); ctx.fill();
    } else if (type === 'BEHOLDER') {
      const float = Math.sin(time * 0.005) * 15;
      const fy = y + float;
      ctx.fillStyle = '#6D102A';
      ctx.beginPath(); ctx.arc(x + width/2, fy + height/2, width/2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6D102A'; ctx.lineWidth = 4;
      for(let i=0; i<6; i++) {
        const ang = (i * Math.PI) / 3; const tx = x + width/2 + Math.cos(ang) * 40; const ty = fy + height/2 + Math.sin(ang) * 40;
        ctx.beginPath(); ctx.moveTo(x+width/2, fy+height/2); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(x + width/2, fy + height/2, width/4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(x + width/2 + Math.cos(time*0.004)*8, fy + height/2 + Math.sin(time*0.004)*5, 8, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'GHOST') {
      const hover = Math.sin(time * 0.006) * 10;
      ctx.globalAlpha = 0.6 + Math.sin(time*0.01)*0.2;
      ctx.fillStyle = '#F1F5F9';
      ctx.beginPath(); ctx.moveTo(x + width/2, y + hover); ctx.quadraticCurveTo(x + width, y + hover, x + width, y + height/2 + hover); ctx.quadraticCurveTo(x + width, y + height + hover + Math.sin(time*0.01)*10, x + width/2, y + height - 10 + hover); ctx.quadraticCurveTo(x, y + height + hover + Math.sin(time*0.01)*10, x, y + height/2 + hover); ctx.quadraticCurveTo(x, y + hover, x + width/2, y + hover); ctx.fill();
      ctx.fillStyle = '#0EA5E9'; ctx.beginPath(); ctx.arc(x+15, y+25+hover, 4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x+width-15, y+25+hover, 4, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1.0;
    } else {
      ctx.fillStyle = ASSET_MANIFEST.MONSTERS[type as keyof typeof ASSET_MANIFEST.MONSTERS]?.color || 'red';
      ctx.fillRect(x, y, width, height);
    }

    ctx.restore();
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const time = Date.now();

    // Самый дальний слой: черный фон
    ctx.fillStyle = '#050406';
    ctx.fillRect(0, 0, W, GROUND_Y);

    // Слой факелов
    let farOffset = gameRef.current.parallax[0] % 400;
    for (let x = -farOffset; x < W + 400; x += 400) {
      const tx = x + 150; const ty = 250;
      const flicker = Math.random() * 8;

      const grad = ctx.createRadialGradient(tx, ty, 3, tx, ty, 65 + flicker);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.5)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(tx, ty, 65 + flicker, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath(); ctx.moveTo(tx-6, ty+8); ctx.quadraticCurveTo(tx, ty-15-flicker, tx+6, ty+8); ctx.fill();
    }

    // --- Слой мерцающей пыли ---
    gameRef.current.ambientParticles.forEach(p => {
      const twinkle = Math.sin(time * 0.002 + p.phase);
      const currentOpacity = Math.max(0.05, p.baseOpacity + (twinkle * 0.15));

      ctx.fillStyle = '#EAB308';
      ctx.globalAlpha = currentOpacity;
      ctx.fillRect(p.x, p.y, p.size, p.size);

      p.x -= p.speed * (engineRef.current.speed / 5);
      p.y += p.vy;

      if (p.x < -10) {
        p.x = W + 10;
        p.y = Math.random() * GROUND_Y;
      }
      if (p.y < 0) p.y = GROUND_Y;
      if (p.y > GROUND_Y) p.y = 0;
    });
    ctx.globalAlpha = 1.0;

    // Слой арок
    let archOffset = gameRef.current.parallax[1] % 500;
    for (let x = -archOffset; x < W + 500; x += 500) {
      ctx.fillStyle = '#16131C';
      const columnWidth = 140; const columnX = x + 180;
      ctx.beginPath();
      ctx.roundRect(columnX, 100, columnWidth, GROUND_Y - 100, [70, 70, 0, 0]);
      ctx.fill();
      ctx.strokeStyle = '#1E1A26'; ctx.lineWidth = 1;
      for(let i=0; i<5; i++) {
        ctx.beginPath(); ctx.moveTo(columnX + 20, 250 + i*80); ctx.lineTo(columnX + columnWidth - 20, 250 + i*80); ctx.stroke();
      }
    }

    // Слой пола
    ctx.fillStyle = '#050406';
    ctx.fillRect(0, GROUND_Y, W, VIRTUAL_HEIGHT - GROUND_Y);
    ctx.fillStyle = '#6226B3';
    ctx.fillRect(0, GROUND_Y, W, 4);
    let floorOffset = gameRef.current.parallax[2] % 120;
    ctx.strokeStyle = '#1A1621'; ctx.lineWidth = 2;
    for (let x = -floorOffset; x < W + 120; x += 120) {
      ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 4); ctx.lineTo(x, VIRTUAL_HEIGHT); ctx.stroke();
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx);

    // Монеты
    gameRef.current.coins.forEach(coin => {
      const bounce = Math.sin(coin.frame) * 5;
      ctx.save();
      ctx.shadowBlur = 8; ctx.shadowColor = '#EAB308';
      ctx.fillStyle = '#EAB308';
      ctx.beginPath(); ctx.arc(coin.x + 10, coin.y + 10 + bounce, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath(); ctx.arc(coin.x + 7, coin.y + 7 + bounce, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#A16207'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    });

    // Частицы (эффекты)
    gameRef.current.particles.forEach((p, i) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 4, 4);
      p.x += p.vx; p.y += p.vy; p.life -= 0.03;
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
      }
    }

    // Экран старта
    if (gameState === 'START') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#6226B3';
      ctx.font = '14px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('НАЖМИТЕ ДЛЯ НАЧАЛА', W / 2, H / 2 - 50);
    }
  }, [gameState, invulnerableUntil, drawBackground]);

  const handleUpdate = useCallback(({ deltaTime, timestamp }: { deltaTime: number, timestamp: number }) => {
    if (gameState === 'PLAYING') {
      const dtFactor = deltaTime / 16.67;
      const W = canvasRef.current?.width || 450;

      engineRef.current.elapsedTime += deltaTime / 1000;
      engineRef.current.speed = calculateSpeed(engineRef.current.elapsedTime);
      const currentSpeed = engineRef.current.speed;

      gameRef.current.parallax[0] += currentSpeed * 0.3 * dtFactor;
      gameRef.current.parallax[1] += currentSpeed * 0.7 * dtFactor;
      gameRef.current.parallax[2] += currentSpeed * 1.0 * dtFactor;

      const { player, monsters, coins } = gameRef.current;

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

      // Спавн монет
      if (Math.random() < 0.015 * dtFactor) {
        const startX = W + 100;
        const targetY = Math.random() > 0.6 ? GROUND_Y - 40 : GROUND_Y - 140;
        for (let i = 0; i < 3; i++) {
          coins.push({
            id: Math.random().toString(),
            x: startX + (i * 40),
            y: targetY,
            width: 20, height: 20,
            collected: false, frame: Math.random() * 10
          });
        }
      }

      // Логика монет
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        c.x -= currentSpeed * dtFactor;
        c.frame += 0.1;

        if (!c.collected && checkCollision(player, 5, c, 5)) {
          c.collected = true;
          engineRef.current.collectedCoins += 1;
          setCollectedCoins(engineRef.current.collectedCoins);
          createParticleEffect(c.x + 10, c.y + 10, '#EAB308', 8);
        }
        if (c.x < -100 || c.collected) coins.splice(i, 1);
      }

      // Спавн монстров
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
          x: W + 150,
          y: yPos,
          width: config.width,
          height: config.height,
          speed: currentSpeed,
        });
        gameRef.current.collisionCooldown = timestamp;
      }

      // Обработка монстров
      for (let i = monsters.length - 1; i >= 0; i--) {
        const m = monsters[i];
        m.x -= currentSpeed * dtFactor;

        const monsterConfig = ASSET_MANIFEST.MONSTERS[m.type as keyof typeof ASSET_MANIFEST.MONSTERS] || ASSET_MANIFEST.MONSTERS.SLIME;
        if (checkCollision(player, ASSET_MANIFEST.PLAYER.hitboxPadding, m, monsterConfig.hitboxPadding) && Date.now() > invulnerableUntil) {
          setIsShaking(true); setTimeout(() => setIsShaking(false), 300);

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
        if (m.x + m.width < -200) monsters.splice(i, 1);
      }

      if (hp <= 0) setGameState('GAME_OVER');
      setScore(Math.floor(engineRef.current.distance));
    }
    draw();
  }, [gameState, hp, maxHp, selectedClass, invulnerableUntil, addLog, takeDamage, heal, draw, GROUND_Y, GRAVITY]);

  useGameLoop(handleUpdate, true);

  const startNewGame = useCallback((cls?: any) => {
    const currentCls = cls || selectedClass;
    if (!currentCls) return;

    engineRef.current.elapsedTime = 0;
    engineRef.current.distance = 0;
    engineRef.current.collectedCoins = 0;
    setCollectedCoins(0);

    gameRef.current.monsters = [];
    gameRef.current.particles = [];
    gameRef.current.coins = [];
    gameRef.current.player.y = GROUND_Y - ASSET_MANIFEST.PLAYER.height;
    gameRef.current.player.vy = 0;
    gameRef.current.player.maxJumps = currentCls.maxJumps || 1;
    gameRef.current.player.jumpsRemaining = gameRef.current.player.maxJumps;

    lastRegenRef.current = 0;
    setInvulnerableUntil(0);
    resetDnd();
    setGameState('PLAYING');
    setScore(0);
    scoreSavedRef.current = false;
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
  }, [gameState, selectedClass, JUMP_STRENGTH]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); handleInput(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput]);

  if (!isImageLoaded) return <div className="flex flex-col items-center justify-center bg-[#0A080D] w-full h-full"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;

  return (
    <div className="w-full h-screen flex flex-col select-none overflow-hidden touch-none relative bg-[#050406]"
      onClick={handleInput}
    >
      {gameState === 'CLASS_SELECTION' && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl text-primary mb-8 uppercase glow-text">ВЫБЕРИТЕ КЛАСС</h2>
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
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

      <div
        ref={containerRef}
        className={cn(
          "relative flex-1 w-full cursor-pointer overflow-hidden bg-black flex items-center justify-center",
          isShaking && "animate-shake"
        )}
      >
        <div className="relative w-full h-full">
          {gameState === 'START' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
              <Leaderboard />
            </div>
          )}

          {gameState !== 'START' && gameState !== 'CLASS_SELECTION' && (
            <div className="absolute top-0 left-0 right-0 h-[6vh] flex justify-between items-center bg-[#0D0B12]/60 p-3 px-6 backdrop-blur-sm z-10">
              <div className="flex gap-1.5">
                {Array.from({ length: maxHp }).map((_, i) => (
                  <Heart key={i} size={14} fill={i < hp ? '#ff0000' : 'none'} color={i < hp ? '#ff0000' : '#333'} />
                ))}
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2 text-[10px]">
                  <span className="text-primary font-bold">{score}м</span>
                  <span className="text-yellow-400 font-bold">💰 {collectedCoins}</span>
                </div>
                <div className="text-[7px] text-secondary opacity-60 uppercase">
                  {selectedClass?.label}
                </div>
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="image-pixelated w-full h-full block"
          />

          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center p-4">
              <h2 className="text-xl text-red-500 mb-2 uppercase glow-text">ФИНАЛ</h2>
              <p className="text-[10px] text-white mb-4 uppercase">ДИСТАНЦИЯ: {score} МЕТРОВ</p>
              <Leaderboard />
              <button onClick={handleInput} className="bg-primary px-8 py-3 text-[10px] uppercase shadow-[0_4px_0_#4D1091] mt-6 active:translate-y-1 active:shadow-none">ИГРАТЬ СНОВА</button>
            </div>
          )}
        </div>
      </div>

      <div className="w-full h-[25vh] bg-[#050406] p-4 overflow-y-auto flex flex-col gap-2 border-t-2 border-primary/20">
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
