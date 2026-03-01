import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateTelegramInitData, extractTelegramUser } from '@/lib/telegramAuth';

// GET /api/game/score?telegramId=123
export async function GET(req: NextRequest) {
  const telegramId = req.nextUrl.searchParams.get('telegramId');

  // Топ-10 глобальных рекордов (лучший результат каждого пользователя)
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
      telegramId: r.telegram_id.toString(),
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
        telegramId: userBest.telegram_id.toString(),
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
      if (!isValid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const tgUser = extractTelegramUser(initData);
      if (!tgUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { id, username, first_name, last_name } = tgUser;
      telegramId = id;
      displayName = username || [first_name, last_name].filter(Boolean).join(' ') || 'Аноним';
    } else if (directTelegramId) {
      telegramId = Number(directTelegramId);
      displayName = directUsername || 'Аноним';
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Транзакция: начисляем монеты и обновляем/создаём запись лучшего результата
    await prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({
        where: { telegram_id: BigInt(telegramId) },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // 1. Начисляем монеты (всегда)
      await tx.users.update({
        where: { id: user.id },
        data: {
          coins: {
            increment: Number(coins) || 0
          }
        }
      });

      // 2. Проверяем существующую запись лучшего результата
      const existingScore = await tx.game_scores.findFirst({
        where: { telegram_id: BigInt(telegramId) },
        orderBy: { score: 'desc' },
      });

      // Если записи нет или новый результат лучше – создаём/обновляем
      if (!existingScore || score > existingScore.score) {
        if (existingScore) {
          // Обновляем существующую запись
          await tx.game_scores.update({
            where: { id: existingScore.id },
            data: {
              username: displayName,
              score: score,
              coins: Number(coins) || 0, // сохраняем количество монет за эту игру (но можно и не обновлять, если нужно хранить именно лучший результат)
              character_class: characterClass ?? user.character_class,
              created_at: new Date(), // опционально обновляем дату
            },
          });
        } else {
          // Создаём новую запись
          await tx.game_scores.create({
            data: {
              user_id: user.id,
              telegram_id: BigInt(telegramId),
              username: displayName,
              score: score,
              coins: Number(coins) || 0,
              character_class: characterClass ?? user.character_class,
            },
          });
        }
      } else {
        // Результат не лучше – ничего не делаем с game_scores
        // Можно залогировать, если нужно
        console.log(`User ${telegramId} scored ${score}, but best is ${existingScore.score}. No update.`);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error:', error);
    if (error.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
