'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTelegramUser } from '@/context/telegram-context';

interface ScoreRecord {
  rank: number;
  telegramId: string;
  username: string;
  characterClass: string | null;
  score: number;
}

interface LeaderboardData {
  topScores: ScoreRecord[];
  personalBest: {
    telegramId: string;
    username: string;
    score: number;
    rank: number;
  } | null;
}

export const Leaderboard: React.FC = () => {
  const { user, isLoading: isUserLoading } = useTelegramUser();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = user ? `?telegramId=${user.id}` : '';
      const res = await fetch(`/api/game/score${params}`);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const json: LeaderboardData = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isUserLoading) {
      fetchLeaderboard();
    }
  }, [isUserLoading, fetchLeaderboard]);

  // Позволяет родительскому компоненту (GameCanvas) триггерить обновление после game over
  useEffect(() => {
    const handler = () => fetchLeaderboard();
    window.addEventListener('game:score-saved', handler);
    return () => window.removeEventListener('game:score-saved', handler);
  }, [fetchLeaderboard]);

  if (isLoading || isUserLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const topScores = data?.topScores ?? [];
  const personalBest = data?.personalBest ?? null;
  const isUserInTop10 = topScores.some(r => r.telegramId === String(user?.id));

  return (
    <div className="w-full max-w-[320px] mt-6 bg-black/60 border-2 border-primary/40 p-4 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-center gap-2 mb-4 border-b border-primary/20 pb-2">
        <Trophy className="w-4 h-4 text-accent" />
        <h3 className="text-[10px] uppercase text-accent glow-text">ЗАЛ СЛАВЫ</h3>
      </div>

      <div className="space-y-2">
        {topScores.length > 0 ? (
          topScores.map((record) => {
            const isMe = record.telegramId === String(user?.id);
            return (
              <div
                key={`${record.telegramId}-${record.rank}`}
                className={cn(
                  'flex items-center justify-between gap-2 border-b border-primary/10 pb-1.5 transition-colors',
                  isMe && 'bg-primary/20 border-accent/30 -mx-2 px-2'
                )}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="min-w-[20px] text-[8px] flex justify-center">
                    {record.rank === 1 ? <Medal className="w-3.5 h-3.5 text-yellow-400" /> :
                     record.rank === 2 ? <Medal className="w-3.5 h-3.5 text-slate-300" /> :
                     record.rank === 3 ? <Medal className="w-3.5 h-3.5 text-amber-600" /> :
                     <span className="text-primary-foreground/50">{record.rank}</span>}
                  </div>
                  <span className={cn(
                    'text-[8px] truncate uppercase',
                    isMe ? 'text-accent font-bold' : 'text-white/80'
                  )}>
                    {record.username || 'Аноним'}
                    {isMe && <span className="text-[6px] opacity-70"> (ВЫ)</span>}
                  </span>
                </div>
                <span className={cn(
                  'text-[8px] font-bold whitespace-nowrap',
                  isMe ? 'text-accent' : 'text-primary'
                )}>
                  {Math.floor(record.score)}М
                </span>
              </div>
            );
          })
        ) : (
          <div className="text-[8px] text-center text-white/30 uppercase py-4">Нет записей</div>
        )}

        {/* Личный рекорд если не в топ-10 */}
        {!isUserInTop10 && personalBest && (
          <>
            <div className="flex justify-center py-1">
              <span className="text-primary/40 text-[8px]">...</span>
            </div>
            <div className="flex items-center justify-between gap-2 border-2 border-accent/30 bg-primary/20 p-2 -mx-1">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="min-w-[20px] text-[8px] text-accent font-bold text-center">
                  #{personalBest.rank}
                </div>
                <span className="text-[8px] truncate uppercase text-accent font-bold">
                  {personalBest.username || 'ВЫ'}
                  <span className="text-[6px] opacity-70"> (ВЫ)</span>
                </span>
              </div>
              <span className="text-[8px] font-bold text-accent whitespace-nowrap">
                {Math.floor(personalBest.score)}М
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 pt-2 border-t border-primary/20 text-center">
        <p className="text-[6px] text-white/40 uppercase tracking-tighter">
          УСТАНОВИТЕ НОВЫЙ РЕКОРД, ЧТОБЫ ПОДНЯТЬСЯ ВЫШЕ!
        </p>
      </div>
    </div>
  );
};
