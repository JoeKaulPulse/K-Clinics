import 'server-only';
import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// Real review aggregation. Combines:
//   • our own CRM reviews (the in-house system at /review/[token])
//   • Google Business Profile reviews (via the Places API)
// into one honest aggregate rating + a set of display cards.
//
// Truthfulness rules (do not loosen):
//   • The headline average/count reflect ALL real, rated reviews from every
//     connected source — never a hard-coded or cherry-picked figure.
//   • Only 5★ reviews WITH a written response are shown as testimonial cards.
//   • A client's name is only shown with explicit consent; otherwise the card
//     is attributed to "Verified client".
//   • If there are zero real reviews, getReviewAggregate() returns null and the
//     UI shows no rating widget at all.
//
// Google is OPT-IN via env: GOOGLE_PLACE_ID + GOOGLE_PLACES_API_KEY. Absent
// those, only our own reviews are used. Trustpilot is intentionally not wired.
// ─────────────────────────────────────────────────────────────────────────────

export type ReviewSource = 'google' | 'internal';
export type ReviewCard = { author: string; rating: number; body: string; treatment?: string; source: ReviewSource; date?: string };
export type ReviewAggregate = { average: number; count: number; sources: ReviewSource[]; cards: ReviewCard[] };

type SourceResult = { average: number; count: number; cards: ReviewCard[] } | null;

/** Our own published reviews (the CRM system). */
async function internalSource(): Promise<SourceResult> {
  try {
    // Honest average across ALL published, rated reviews (not just 5★).
    const agg = await db.review.aggregate({
      where: { status: 'PUBLISHED', rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const count = agg._count.rating;
    if (!count) return null;

    // Display cards: 5★ with a written response only. Name only with consent.
    const rows = await db.review.findMany({
      where: { status: 'PUBLISHED', rating: 5, body: { not: null } },
      orderBy: { submittedAt: 'desc' },
      take: 20,
      include: { client: { select: { firstName: true, lastName: true } } },
    });
    const cards: ReviewCard[] = rows
      .filter((r) => (r.body || '').trim().length > 0)
      .map((r) => ({
        author: r.displayConsent
          ? `${r.client.firstName}${r.client.lastName ? ` ${r.client.lastName[0]}.` : ''}`
          : 'Verified client',
        rating: 5,
        body: (r.body || '').trim(),
        treatment: r.treatmentTitle || undefined,
        source: 'internal' as const,
        date: (r.submittedAt || r.createdAt)?.toISOString(),
      }));
    return { average: agg._avg.rating || 0, count, cards };
  } catch {
    return null;
  }
}

type GooglePlaceReview = { author_name?: string; rating?: number; text?: string; time?: number };

/** Google Business Profile reviews via the Places API (opt-in via env). */
async function googleSource(): Promise<SourceResult> {
  const placeId = process.env.GOOGLE_PLACE_ID;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!placeId || !key) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=rating,user_ratings_total,reviews&reviews_sort=newest&key=${key}`;
    // Cache for 6h — Google rate-limits and reviews change slowly.
    const res = await fetch(url, { next: { revalidate: 21600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: { rating?: number; user_ratings_total?: number; reviews?: GooglePlaceReview[] } };
    const r = data.result;
    if (!r || !r.user_ratings_total) return null;

    // Google review author names are already public on Google, so no extra
    // consent is needed — but we still only surface 5★ written reviews.
    const cards: ReviewCard[] = (r.reviews || [])
      .filter((rv) => rv.rating === 5 && (rv.text || '').trim().length > 0)
      .map((rv) => ({
        author: rv.author_name?.trim() || 'Google reviewer',
        rating: 5,
        body: (rv.text || '').trim(),
        source: 'google' as const,
        date: rv.time ? new Date(rv.time * 1000).toISOString() : undefined,
      }));
    return { average: r.rating || 0, count: r.user_ratings_total, cards };
  } catch {
    return null;
  }
}

/** Combined, truthful aggregate. Returns null when no real reviews exist. */
export async function getReviewAggregate(): Promise<ReviewAggregate | null> {
  const [internal, google] = await Promise.all([internalSource(), googleSource()]);
  const present = [
    ['internal', internal] as const,
    ['google', google] as const,
  ].filter(([, s]) => s && s.count > 0) as [ReviewSource, NonNullable<SourceResult>][];

  if (present.length === 0) return null;

  const count = present.reduce((s, [, src]) => s + src.count, 0);
  const weighted = present.reduce((s, [, src]) => s + src.average * src.count, 0);
  const average = count > 0 ? Math.round((weighted / count) * 10) / 10 : 0;

  // Interleave cards newest-first across sources.
  const cards = present
    .flatMap(([, src]) => src.cards)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return { average, count, sources: present.map(([name]) => name), cards };
}
