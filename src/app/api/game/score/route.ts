import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateTelegramData } from '@/lib/telegramAuth';

// GET /api/game/score?telegramId=123
// Возвращает топ-10 и личный рекорд пользователя
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

  // Нормализуем BigInt для JSON
  const normalizedTop = topScores
    .sort((a, b) => b.best_score - a.best_score)
    .map((r, index) => ({
      rank: index + 1,
      telegramId: r.telegram_id.toString(),
      username: r.username,
      characterClass: r.character_class,
      score: r.best_score,
    }));

  // Личный рекорд и ранк пользователя
  let personalBest = null;

  if (telegramId) {
    const userBest = await prisma.game_scores.findFirst({
      where: { telegram_id: BigInt(telegramId) },
      orderBy: { score: 'desc' },
    });

    if (userBest) {
      // Считаем сколько уникальных игроков лучше пользователя
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
// Сохраняет результат после окончания игры
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { initData, score, characterClass } = body;

  // Валидируем через тот же механизм что и Moraleon
  const validation = validateTelegramData(initData);
  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: telegramId, username, first_name, last_name } = validation.user;
  const displayName = username || [first_name, last_name].filter(Boolean).join(' ') || 'Аноним';

  // Находим или создаём пользователя (он уже должен существовать через Moraleon)
  const user = await prisma.users.findUnique({
    where: { telegram_id: BigInt(telegramId) },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Сохраняем результат
  await prisma.game_scores.create({
    data: {
      user_id: user.id,
      telegram_id: BigInt(telegramId),
      username: displayName,
      score,
      character_class: characterClass ?? user.character_class,
    },
  });

  return NextResponse.json({ success: true });
}
