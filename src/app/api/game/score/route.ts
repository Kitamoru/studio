import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { score, userId, username } = body;

    if (typeof score !== 'number') {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    const db = getFirebaseAdmin();
    await db.collection('scores').add({
      score,
      userId: userId || null,
      username: username || 'Anonymous',
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save score:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
