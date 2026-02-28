
'use client';

import React from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Trophy, Medal, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Leaderboard: React.FC = () => {
  const firestore = useFirestore();

  const scoresQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'game_scores'),
      orderBy('score', 'desc'),
      limit(10)
    );
  }, [firestore]);

  const { data: scores, isLoading } = useCollection<{
    score: number;
    username: string;
    createdAt: string;
  }>(scoresQuery);

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[300px] mt-6 bg-black/40 border-2 border-primary/30 p-4">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-accent" />
        <h3 className="text-[10px] uppercase text-accent glow-text">ЗАЛ СЛАВЫ</h3>
      </div>
      
      <div className="space-y-3">
        {scores && scores.length > 0 ? (
          scores.map((record, index) => (
            <div key={record.id} className="flex items-center justify-between gap-2 border-b border-primary/10 pb-1">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="min-w-[16px] text-[8px] text-primary-foreground/50">
                  {index === 0 ? <Medal className="w-3 h-3 text-yellow-400" /> : index + 1}
                </div>
                <span className="text-[8px] truncate uppercase text-white/80">
                  {record.username || 'Аноним'}
                </span>
              </div>
              <span className="text-[8px] font-bold text-primary whitespace-nowrap">
                {Math.floor(record.score)}М
              </span>
            </div>
          ))
        ) : (
          <div className="text-[8px] text-center text-white/30 uppercase">Нет записей</div>
        )}
      </div>
    </div>
  );
};
