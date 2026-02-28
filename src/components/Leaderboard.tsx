
'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { Trophy, Medal, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreRecord {
  id: string;
  score: number;
  username: string;
  userId: string;
  createdAt: any;
}

export const Leaderboard: React.FC = () => {
  const firestore = useFirestore();
  const { user } = useUser();
  const [userBestScore, setUserBestScore] = useState<ScoreRecord | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);

  // 1. Fetch Top 10 Scores
  const scoresQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'game_scores'),
      orderBy('score', 'desc'),
      limit(10)
    );
  }, [firestore]);

  const { data: topScores, isLoading: isTopLoading } = useCollection<ScoreRecord>(scoresQuery);

  // 2. Fetch User's Personal Rank and Best Score
  useEffect(() => {
    async function fetchUserStats() {
      if (!firestore || !user) return;

      try {
        // Find user's best score
        const userQuery = query(
          collection(firestore, 'game_scores'),
          where('userId', '==', user.uid),
          orderBy('score', 'desc'),
          limit(1)
        );
        const userSnap = await getDocs(userQuery);

        if (!userSnap.empty) {
          const bestScoreDoc = userSnap.docs[0];
          const bestScoreData = { ...bestScoreDoc.data(), id: bestScoreDoc.id } as ScoreRecord;
          setUserBestScore(bestScoreData);

          // Calculate Rank: Count all documents with score higher than user's best
          const rankQuery = query(
            collection(firestore, 'game_scores'),
            where('score', '>', bestScoreData.score)
          );
          const countSnapshot = await getCountFromServer(rankQuery);
          setUserRank(countSnapshot.data().count + 1);
        }
      } catch (err) {
        console.error('Error fetching leaderboard stats:', err);
      }
    }

    fetchUserStats();
  }, [firestore, user, topScores]); // Refresh stats when top scores change (after game over)

  if (isTopLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const isUserInTop10 = topScores?.some(record => record.userId === user?.uid);

  return (
    <div className="w-full max-w-[320px] mt-6 bg-black/60 border-2 border-primary/40 p-4 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-center gap-2 mb-4 border-b border-primary/20 pb-2">
        <Trophy className="w-4 h-4 text-accent" />
        <h3 className="text-[10px] uppercase text-accent glow-text">ЗАЛ СЛАВЫ</h3>
      </div>
      
      <div className="space-y-2">
        {topScores && topScores.length > 0 ? (
          topScores.map((record, index) => {
            const isMe = record.userId === user?.uid;
            return (
              <div 
                key={record.id} 
                className={cn(
                  "flex items-center justify-between gap-2 border-b border-primary/10 pb-1.5 transition-colors",
                  isMe && "bg-primary/20 border-accent/30 -mx-2 px-2"
                )}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="min-w-[20px] text-[8px] flex justify-center">
                    {index === 0 ? <Medal className="w-3.5 h-3.5 text-yellow-400" /> : 
                     index === 1 ? <Medal className="w-3.5 h-3.5 text-slate-300" /> :
                     index === 2 ? <Medal className="w-3.5 h-3.5 text-amber-600" /> :
                     <span className="text-primary-foreground/50">{index + 1}</span>}
                  </div>
                  <span className={cn(
                    "text-[8px] truncate uppercase",
                    isMe ? "text-accent font-bold" : "text-white/80"
                  )}>
                    {record.username || 'Аноним'} {isMe && <span className="text-[6px] opacity-70">(ВЫ)</span>}
                  </span>
                </div>
                <span className={cn(
                  "text-[8px] font-bold whitespace-nowrap",
                  isMe ? "text-accent" : "text-primary"
                )}>
                  {Math.floor(record.score)}М
                </span>
              </div>
            );
          })
        ) : (
          <div className="text-[8px] text-center text-white/30 uppercase py-4">Нет записей</div>
        )}

        {/* Separator and User's Personal Best (if not in Top 10) */}
        {!isUserInTop10 && userBestScore && userRank && (
          <>
            <div className="flex justify-center py-1">
              <span className="text-primary/40 text-[8px]">...</span>
            </div>
            <div className="flex items-center justify-between gap-2 border-2 border-accent/30 bg-primary/20 p-2 -mx-1">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="min-w-[20px] text-[8px] text-accent font-bold text-center">
                  #{userRank}
                </div>
                <span className="text-[8px] truncate uppercase text-accent font-bold">
                  {userBestScore.username || 'ВЫ'} <span className="text-[6px] opacity-70">(ВЫ)</span>
                </span>
              </div>
              <span className="text-[8px] font-bold text-accent whitespace-nowrap">
                {Math.floor(userBestScore.score)}М
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 pt-2 border-t border-primary/20 text-center">
        <p className="text-[6px] text-white/40 uppercase tracking-tighter">УСТАНОВИТЕ НОВЫЙ РЕКОРД, ЧТОБЫ ПОДНЯТЬСЯ ВЫШЕ!</p>
      </div>
    </div>
  );
};
