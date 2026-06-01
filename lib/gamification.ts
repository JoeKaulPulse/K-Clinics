import 'server-only';
import { db } from '@/lib/db';
import type { PointsCategory } from '@prisma/client';

// Staff gamification engine. Points are awarded into an append-only ledger
// (StaffPoints); a member's score is the sum of their rows. Awards are driven
// primarily by client reviews, then by commercial signals (efficiency, minimal
// consumable waste, punctuality). Managers can also award/deduct manually.
//
// Point values are deliberately simple + transparent. Tune here.
export const POINTS = {
  reviewPerStar: 10,        // ×rating → 50 for a 5★
  fiveStarBonus: 25,        // extra for a perfect review
  onTimeFinish: 5,          // finished within booked time
  overrunPenaltyPerMin: -1, // per minute over (capped)
  overrunCapMin: 15,
  lowWasteBonus: 5,         // a session with no wasted consumables
};

/** Append a points entry. Never throws to the caller's critical path. */
export async function awardPoints(opts: {
  staffId: string;
  points: number;
  category: PointsCategory;
  reason: string;
  bookingId?: string | null;
  reviewId?: string | null;
  awardedBy?: string;
}) {
  if (!opts.staffId || !opts.points) return;
  try {
    await db.staffPoints.create({
      data: {
        staffId: opts.staffId,
        points: Math.round(opts.points),
        category: opts.category,
        reason: opts.reason,
        bookingId: opts.bookingId ?? null,
        reviewId: opts.reviewId ?? null,
        awardedBy: opts.awardedBy ?? 'system',
      },
    });
  } catch (e) {
    console.error('[gamification] awardPoints failed (continuing):', (e as Error)?.message);
  }
}

/** Award efficiency + waste points when an appointment completes. */
export async function awardForCompletedAppointment(bookingId: string) {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, practitionerId: true, durationMin: true, actualMinutes: true, treatmentTitle: true },
  });
  if (!b?.practitionerId) return;

  // Efficiency: on/under time is rewarded; overrun lightly penalised (capped).
  if (b.actualMinutes != null) {
    const delta = b.actualMinutes - b.durationMin;
    if (delta <= 0) {
      await awardPoints({ staffId: b.practitionerId, points: POINTS.onTimeFinish, category: 'EFFICIENCY', reason: `On-time: ${b.treatmentTitle}`, bookingId });
    } else {
      const penalty = Math.max(POINTS.overrunPenaltyPerMin * Math.min(delta, POINTS.overrunCapMin), POINTS.overrunPenaltyPerMin * POINTS.overrunCapMin);
      await awardPoints({ staffId: b.practitionerId, points: penalty, category: 'EFFICIENCY', reason: `Overran by ${delta} min: ${b.treatmentTitle}`, bookingId });
    }
  }

  // Consumables: reward a session with no WASTED movements.
  const wasted = await db.stockMovement.count({ where: { bookingId, reason: 'WASTED' } });
  if (wasted === 0) {
    await awardPoints({ staffId: b.practitionerId, points: POINTS.lowWasteBonus, category: 'CONSUMABLES', reason: `No waste: ${b.treatmentTitle}`, bookingId });
  }
}

/** Award review points when a client review is approved (avoids gaming on raw
 *  submission — only counts moderated reviews). */
export async function awardForReview(reviewId: string) {
  const r = await db.review.findUnique({ where: { id: reviewId }, select: { id: true, clinicianId: true, rating: true } });
  if (!r?.clinicianId || !r.rating) return;
  // Don't double-award the same review.
  const existing = await db.staffPoints.findFirst({ where: { reviewId, category: 'REVIEW' } });
  if (existing) return;
  let pts = r.rating * POINTS.reviewPerStar;
  if (r.rating === 5) pts += POINTS.fiveStarBonus;
  await awardPoints({ staffId: r.clinicianId, points: pts, category: 'REVIEW', reason: `${r.rating}★ client review`, reviewId });
}

export type LeaderRow = {
  staffId: string; name: string; title: string | null; color: string | null;
  total: number; reviewPoints: number; reviewCount: number; avgRating: number | null;
};

/** Leaderboard + per-category breakdown over an optional window (days). */
export async function leaderboard(days?: number): Promise<LeaderRow[]> {
  const since = days ? new Date(Date.now() - days * 864e5) : undefined;
  const where = since ? { createdAt: { gte: since } } : {};

  const [grouped, staff, reviewAgg] = await Promise.all([
    db.staffPoints.groupBy({ by: ['staffId'], where, _sum: { points: true } }),
    db.adminUser.findMany({ where: { active: true }, select: { id: true, name: true, email: true, title: true, color: true } }),
    db.review.groupBy({ by: ['clinicianId'], where: { rating: { not: null }, ...(since ? { submittedAt: { gte: since } } : {}) }, _avg: { rating: true }, _count: { rating: true } }),
  ]);

  const reviewPts = await db.staffPoints.groupBy({ by: ['staffId'], where: { category: 'REVIEW', ...where }, _sum: { points: true } });
  const totalMap = new Map(grouped.map((g) => [g.staffId, g._sum.points ?? 0]));
  const revPtMap = new Map(reviewPts.map((g) => [g.staffId, g._sum.points ?? 0]));
  const revAggMap = new Map(reviewAgg.filter((a) => a.clinicianId).map((a) => [a.clinicianId as string, a]));

  return staff
    .map((s) => {
      const agg = revAggMap.get(s.id);
      return {
        staffId: s.id,
        name: s.name || s.email,
        title: s.title,
        color: s.color,
        total: totalMap.get(s.id) ?? 0,
        reviewPoints: revPtMap.get(s.id) ?? 0,
        reviewCount: agg?._count.rating ?? 0,
        avgRating: agg?._avg.rating ?? null,
      };
    })
    .filter((r) => r.total !== 0 || r.reviewCount > 0)
    .sort((a, b) => b.total - a.total);
}

/** Recent ledger entries for one staff member. */
export async function staffLedger(staffId: string, limit = 50) {
  return db.staffPoints.findMany({ where: { staffId }, orderBy: { createdAt: 'desc' }, take: limit });
}

/** One staff member's standing — total points, rank, review stats, breakdown,
 *  and recent ledger entries. For the clinician's own "My performance" view. */
export async function staffStanding(staffId: string) {
  const board = await leaderboard(); // all-time
  const rank = board.findIndex((r) => r.staffId === staffId);
  const me = board.find((r) => r.staffId === staffId);

  const [byCategory, recent] = await Promise.all([
    db.staffPoints.groupBy({ by: ['category'], where: { staffId }, _sum: { points: true } }),
    db.staffPoints.findMany({ where: { staffId }, orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);

  return {
    total: me?.total ?? 0,
    rank: rank >= 0 ? rank + 1 : null,
    totalStaff: board.length,
    avgRating: me?.avgRating ?? null,
    reviewCount: me?.reviewCount ?? 0,
    byCategory: byCategory.map((c) => ({ category: c.category, points: c._sum.points ?? 0 })).sort((a, b) => b.points - a.points),
    recent: recent.map((r) => ({ id: r.id, points: r.points, category: r.category as string, reason: r.reason, createdAt: r.createdAt.toISOString() })),
  };
}
