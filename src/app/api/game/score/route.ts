import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateTelegramInitData, extractTelegramUser } from '@/lib/telegramAuth';

// GET /api/game/score?telegramId=123
export async function GET(req: NextRequest) {
  const telegramId = req.nextUrl.searchParams.get('telegramId');

  // Топ-10 глобальных рекордов
  const topScores = await prisma.$queryRaw<
    { telegram_id: bigint; username: string; character_class: string | null; best_score: number }[]
  >`
    SELECT DISTINCT ON (telegram_id)
      telegram_id,
      username,
      character_class,
      score AS best_score
    FROM game_scores
    ORDER BY telegram_id, score DESC
    LIMIT 10
  `;

  const normalizedTop = topScores
    .sort((a, b) => b.best_score - a.best_score)
    .map((r, index) => ({
      rank: index + 1,
      telegramId: r.telegram_id.toString(), // BigInt → string
      username: r.username,
      characterClass: r.character_class,
      score: r.best_score,
    }));

  let personalBest = null;

  if (telegramId) {
    const userBest = await prisma.game_scores.findFirst({
      where: { telegram_id: BigInt(telegramId) },
      orderBy: { score: 'desc' },
    });

    if (userBest) {
      const betterPlayersCount = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT telegram_id) as count
        FROM game_scores
        WHERE score > ${userBest.score}
      `;

      personalBest = {
        telegramId: userBest.telegram_id.toString(), // BigInt → string
        username: userBest.username,
        score: userBest.score,
        rank: Number(betterPlayersCount[0].count) + 1,
      };
    }
  }

  return NextResponse.json({ topScores: normalizedTop, personalBest });
}

// POST /api/game/score
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      initData, 
      telegramId: directTelegramId, 
      username: directUsername, 
      score, 
      coins,
      characterClass 
    } = body;

    let telegramId: number;
    let displayName: string;

    // Валидация данных
    if (initData) {
      const isValid = validateTelegramInitData(initData);
      if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      
      const tgUser = extractTelegramUser(initData);
      if (!tgUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      
      telegramId = tgUser.id;
      displayName = tgUser.username || [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Аноним';
    } else if (directTelegramId) {
      telegramId = Number(directTelegramId);
      displayName = directUsername || 'Аноним';
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Транзакция
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({
        where: { telegram_id: BigInt(telegramId) },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const newGameScore = await tx.game_scores.create({
        data: {
          user_id: user.id,
          telegram_id: BigInt(telegramId),
          username: displayName,
          score: score,
          coins: Number(coins) || 0,
          character_class: characterClass ?? user.character_class,
        },
      });

      await tx.users.update({
        where: { id: user.id },
        data: {
          coins: {
            increment: Number(coins) || 0
          }
        }
      });

      return newGameScore;
    });

    // Сериализация BigInt
    const serializedResult = {
      ...result,
      telegram_id: result.telegram_id.toString(), // единственное BigInt поле
    };

    return NextResponse.json({ success: true, data: serializedResult });
  } catch (error: any) {
    console.error('API Error:', error);
    if (error.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
