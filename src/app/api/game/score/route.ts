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
  console.log('[COIN API] POST /api/game/score');
  
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

    console.log('[COIN API] Получены данные:', { 
      coins,
      score,
      telegramId: directTelegramId || 'из initData',
      characterClass 
    });

    let telegramId: number;
    let displayName: string;

    // Валидация данных
    if (initData) {
      const isValid = validateTelegramInitData(initData);
      if (!isValid) {
        console.log('[COIN API] Ошибка валидации initData');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const tgUser = extractTelegramUser(initData);
      if (!tgUser) {
        console.log('[COIN API] Не удалось извлечь пользователя из initData');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { id, username, first_name, last_name } = tgUser;
      telegramId = id;
      displayName = username || [first_name, last_name].filter(Boolean).join(' ') || 'Аноним';
    } else if (directTelegramId) {
      telegramId = Number(directTelegramId);
      displayName = directUsername || 'Аноним';
    } else {
      console.log('[COIN API] Нет данных для авторизации');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[COIN API] Пользователь: ${telegramId}, имя: ${displayName}`);

    // Транзакция: начисляем монеты и обновляем/создаём запись лучшего результата
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({
        where: { telegram_id: BigInt(telegramId) },
      });

      if (!user) {
        console.log(`[COIN API] Пользователь ${telegramId} не найден в БД`);
        throw new Error('User not found');
      }

      console.log(`[COIN API] Найден пользователь: ${user.id}, текущий баланс монет: ${user.coins}`);

      // 1. Начисляем монеты (всегда)
      const updatedUser = await tx.users.update({
        where: { id: user.id },
        data: {
          coins: {
            increment: Number(coins) || 0
          }
        },
      });

      console.log(`[COIN DB] Начислено ${coins} монет пользователю ${telegramId}. Новый баланс: ${updatedUser.coins}`);

      // 2. Проверяем существующую запись лучшего результата
      const existingScore = await tx.game_scores.findFirst({
        where: { telegram_id: BigInt(telegramId) },
        orderBy: { score: 'desc' },
      });

      // Если записи нет или новый результат лучше – создаём/обновляем
      if (!existingScore || score > existingScore.score) {
        console.log(`[COIN RECORD] Новый рекорд! Текущий результат: ${score}, монет за игру: ${coins}`);

        if (existingScore) {
          // Обновляем существующую запись
          const updated = await tx.game_scores.update({
            where: { id: existingScore.id },
            data: {
              username: displayName,
              score: score,
              coins: Number(coins) || 0,
              character_class: characterClass ?? user.character_class,
              created_at: new Date(),
            },
          });
          console.log(`[COIN DB] Запись game_scores обновлена (id: ${updated.id})`);
        } else {
          // Создаём новую запись
          const created = await tx.game_scores.create({
            data: {
              user_id: user.id,
              telegram_id: BigInt(telegramId),
              username: displayName,
              score: score,
              coins: Number(coins) || 0,
              character_class: characterClass ?? user.character_class,
            },
          });
          console.log(`[COIN DB] Создана новая запись game_scores (id: ${created.id})`);
        }
      } else {
        console.log(`[COIN] Игра не улучшила рекорд (лучший: ${existingScore.score}, текущий: ${score}), монеты ${coins} всё равно начислены`);
      }

      return updatedUser;
    });

    console.log(`[COIN API] Транзакция завершена успешно для пользователя ${telegramId}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[COIN API ERROR]', error.message, error.stack);
    if (error.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
