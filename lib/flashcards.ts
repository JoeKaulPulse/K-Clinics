import 'server-only';
import { db } from '@/lib/db';
import { currentTenantId } from '@/lib/tenant';
import { studentCanAccess } from '@/lib/lms';

// BLD-531: flashcards + spaced repetition (SM-2-lite). Decks belong to a course;
// each learner has per-card review state that schedules when a card is next due.

export type DeckSummary = { id: string; title: string; description: string | null; courseId: string; courseTitle: string; total: number; due: number };
export type SessionCard = { id: string; front: string; back: string; imageUrl: string | null };
export type Grade = 0 | 1 | 2; // 0 = again, 1 = good, 2 = easy

const SESSION_LIMIT = 20;
const DAY = 24 * 60 * 60 * 1000;

/** SM-2-lite next-state from a grade. Pure — easy to reason about and test. */
export function schedule(prev: { ease: number; intervalDays: number; reps: number; lapses: number }, grade: Grade): { ease: number; intervalDays: number; reps: number; lapses: number; dueAt: Date } {
  let { ease, intervalDays, reps, lapses } = prev;
  if (grade === 0) {
    reps = 0; lapses += 1; intervalDays = 0; ease = Math.max(130, ease - 20);
  } else {
    reps += 1;
    if (grade === 2) ease += 15;
    if (reps === 1) intervalDays = grade === 2 ? 3 : 1;
    else if (reps === 2) intervalDays = grade === 2 ? 6 : 3;
    else intervalDays = Math.max(1, Math.round(intervalDays * (ease / 100)));
  }
  // "Again" comes back in ~10 minutes; otherwise after the computed interval.
  const dueAt = new Date(Date.now() + (intervalDays === 0 ? 10 * 60 * 1000 : intervalDays * DAY));
  return { ease, intervalDays, reps, lapses, dueAt };
}

/** Courses the student can access (enrolled + in window). */
async function accessibleCourseIds(studentId: string): Promise<string[]> {
  const rows = await db.enrolment.findMany({ where: { studentId, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] } }, select: { courseId: true } });
  const ids = [...new Set(rows.map((r) => r.courseId))];
  const ok = await Promise.all(ids.map(async (id) => ((await studentCanAccess(studentId, id)) ? id : null)));
  return ok.filter((x): x is string => !!x);
}

/** Decks across the student's accessible courses, with total + due counts. */
export async function listDecks(studentId: string): Promise<DeckSummary[]> {
  const courseIds = await accessibleCourseIds(studentId);
  if (!courseIds.length) return [];
  const decks = await db.flashcardDeck.findMany({
    where: { courseId: { in: courseIds } },
    orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
    select: { id: true, title: true, description: true, courseId: true, course: { select: { title: true } }, _count: { select: { cards: true } } },
  });
  const now = new Date();
  return Promise.all(decks.map(async (d) => {
    // due = total − (reviewed cards not yet due). New (un-reviewed) cards count as due.
    const notDue = await db.flashcardReview.count({ where: { studentId, dueAt: { gt: now }, card: { deckId: d.id } } });
    return { id: d.id, title: d.title, description: d.description, courseId: d.courseId, courseTitle: d.course.title, total: d._count.cards, due: Math.max(0, d._count.cards - notDue) };
  }));
}

/** The cards to review now for a deck (due + new, capped). Verifies access. */
export async function getDeckSession(studentId: string, deckId: string, limit = SESSION_LIMIT): Promise<{ ok: boolean; deckTitle?: string; cards?: SessionCard[]; error?: string }> {
  const deck = await db.flashcardDeck.findUnique({ where: { id: deckId }, select: { title: true, courseId: true, cards: { orderBy: { order: 'asc' }, select: { id: true, front: true, back: true, imageUrl: true } } } });
  if (!deck) return { ok: false, error: 'Deck not found.' };
  if (!(await studentCanAccess(studentId, deck.courseId))) return { ok: false, error: 'Not enrolled.' };
  const reviews = await db.flashcardReview.findMany({ where: { studentId, card: { deckId } }, select: { cardId: true, dueAt: true } });
  const dueByCard = new Map(reviews.map((r) => [r.cardId, r.dueAt]));
  const now = Date.now();
  const ranked = deck.cards
    .map((c) => ({ c, due: dueByCard.get(c.id), isNew: !dueByCard.has(c.id) }))
    .filter((x) => x.isNew || (x.due && x.due.getTime() <= now))
    // Overdue first (oldest due), then new cards.
    .sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity))
    .slice(0, limit)
    .map((x) => ({ id: x.c.id, front: x.c.front, back: x.c.back, imageUrl: x.c.imageUrl }));
  return { ok: true, deckTitle: deck.title, cards: ranked };
}

/** Record a review grade for a card and schedule the next due date. */
export async function gradeCard(studentId: string, cardId: string, grade: Grade): Promise<{ ok: boolean; error?: string }> {
  const card = await db.flashcard.findUnique({ where: { id: cardId }, select: { deck: { select: { courseId: true } } } });
  if (!card) return { ok: false, error: 'Card not found.' };
  if (!(await studentCanAccess(studentId, card.deck.courseId))) return { ok: false, error: 'Not enrolled.' };
  const g = (grade === 0 || grade === 1 || grade === 2 ? grade : 1) as Grade;
  const prev = await db.flashcardReview.findUnique({ where: { studentId_cardId: { studentId, cardId } }, select: { ease: true, intervalDays: true, reps: true, lapses: true } });
  const next = schedule(prev ?? { ease: 250, intervalDays: 0, reps: 0, lapses: 0 }, g);
  const tenantId = await currentTenantId();
  await db.flashcardReview.upsert({
    where: { studentId_cardId: { studentId, cardId } },
    update: { ease: next.ease, intervalDays: next.intervalDays, reps: next.reps, lapses: next.lapses, dueAt: next.dueAt },
    create: { tenantId, studentId, cardId, ease: next.ease, intervalDays: next.intervalDays, reps: next.reps, lapses: next.lapses, dueAt: next.dueAt },
  });
  return { ok: true };
}

// ── Admin authoring view ─────────────────────────────────────────────────────
export type AdminDeck = { id: string; title: string; description: string | null; order: number; cards: { id: string; order: number; front: string; back: string; imageUrl: string | null }[] };

export async function adminListDecks(courseId: string): Promise<AdminDeck[]> {
  const decks = await db.flashcardDeck.findMany({
    where: { courseId },
    orderBy: { order: 'asc' },
    select: { id: true, title: true, description: true, order: true, cards: { orderBy: { order: 'asc' }, select: { id: true, order: true, front: true, back: true, imageUrl: true } } },
  });
  return decks;
}
