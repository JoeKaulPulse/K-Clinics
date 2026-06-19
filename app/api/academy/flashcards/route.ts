import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-531: trainee flashcards.
//   GET                 → decks across the trainee's courses (with due counts)
//   GET ?deck=<id>      → the review session (due + new cards) for a deck
//   POST { cardId, grade } → record a review (0 again / 1 good / 2 easy)
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const deckId = new URL(req.url).searchParams.get('deck');
  const fc = await import('@/lib/flashcards');
  if (deckId) {
    const res = await fc.getDeckSession(student.id, deckId);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }
  const decks = await fc.listDecks(student.id);
  return NextResponse.json({ ok: true, decks });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body?.cardId) return NextResponse.json({ ok: false, error: 'Missing card.' }, { status: 400 });
  const grade = Number(body.grade);
  const g = (grade === 0 || grade === 1 || grade === 2 ? grade : 1) as 0 | 1 | 2;
  const { gradeCard } = await import('@/lib/flashcards');
  const res = await gradeCard(student.id, String(body.cardId), g);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
