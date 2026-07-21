import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-531: staff authoring for flashcard decks + cards. Requires settings.manage.
// Editing content never touches a learner's spaced-repetition state (review rows
// are only removed if the parent card/deck is deleted).
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const isHttpUrl = (s: string) => /^https?:\/\//i.test(s.trim());

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { db } = await import('@/lib/db');
  const { currentTenantId } = await import('@/lib/tenant');
  const tenantId = await currentTenantId();
  const ok = (extra: object = {}) => NextResponse.json({ ok: true, ...extra });
  const bad = (e = 'Bad request') => NextResponse.json({ ok: false, error: e }, { status: 400 });

  switch (b.op) {
    case 'createDeck': {
      if (!b.courseId) return bad();
      const order = await db.flashcardDeck.count({ where: { courseId: String(b.courseId) } });
      const d = await db.flashcardDeck.create({ data: { tenantId, courseId: String(b.courseId), title: str(b.title).slice(0, 160) || 'New deck', description: str(b.description).slice(0, 400) || null, order } });
      return ok({ id: d.id });
    }
    case 'updateDeck': {
      if (!b.id) return bad();
      await db.flashcardDeck.update({ where: { id: String(b.id) }, data: { title: str(b.title).slice(0, 160) || 'Deck', description: str(b.description).slice(0, 400) || null } });
      return ok();
    }
    case 'deleteDeck': {
      if (!b.id) return bad();
      await db.flashcardDeck.delete({ where: { id: String(b.id) } });
      return ok();
    }
    case 'reorderDecks': {
      if (!Array.isArray(b.ids)) return bad();
      await Promise.all((b.ids as string[]).map((id, i) => db.flashcardDeck.update({ where: { id }, data: { order: i } }).catch(() => {})));
      return ok();
    }
    case 'createCard': {
      if (!b.deckId) return bad();
      const order = await db.flashcard.count({ where: { deckId: String(b.deckId) } });
      const c = await db.flashcard.create({ data: { tenantId, deckId: String(b.deckId), front: 'New card — front', back: 'Back', order } });
      return ok({ id: c.id });
    }
    case 'updateCard': {
      if (!b.id) return bad();
      const front = str(b.front).slice(0, 2000).trim();
      const back = str(b.back).slice(0, 2000).trim();
      if (!front || !back) return bad('A card needs a front and a back.');
      const imageUrl = str(b.imageUrl).slice(0, 1000).trim();
      await db.flashcard.update({ where: { id: String(b.id) }, data: { front, back, imageUrl: imageUrl && isHttpUrl(imageUrl) ? imageUrl : null } });
      return ok();
    }
    case 'deleteCard': {
      if (!b.id) return bad();
      await db.flashcard.delete({ where: { id: String(b.id) } });
      return ok();
    }
    case 'reorderCards': {
      if (!Array.isArray(b.ids)) return bad();
      await Promise.all((b.ids as string[]).map((id, i) => db.flashcard.update({ where: { id }, data: { order: i } }).catch(() => {})));
      return ok();
    }
  }
  return bad('Unknown op');
}
