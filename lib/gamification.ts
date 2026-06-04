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
  // ── Commercial / profitability signals ──
  revenuePencePerPoint: 500,  // 1 pt per £5 of charged treatment revenue
  upsellPencePerPoint: 250,   // add-ons earn faster (1 pt per £2.50 — higher margin)
  rebookBonus: 20,            // securing a repeat booking from your client
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

  // Idempotent: don't re-award if this booking was already scored (e.g. the
  // status is toggled COMPLETED → NO_SHOW → COMPLETED again).
  const already = await db.staffPoints.findFirst({ where: { bookingId, category: { in: ['EFFICIENCY', 'CONSUMABLES'] } } });
  if (already) return;

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

/** Profitability points when a booking is charged: revenue delivered, plus an
 *  accelerated bonus for add-ons/enhancements sold. Idempotent per booking. */
export async function awardForCharge(bookingId: string) {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, practitionerId: true, chargedPence: true, treatmentTitle: true, items: { select: { isAddon: true, pricePence: true, discountPence: true } } },
  });
  if (!b?.practitionerId || !b.chargedPence || b.chargedPence <= 0) return;
  const already = await db.staffPoints.findFirst({ where: { bookingId, category: 'REVENUE' } });
  if (already) return;

  const revenuePts = Math.floor(b.chargedPence / POINTS.revenuePencePerPoint);
  if (revenuePts > 0) await awardPoints({ staffId: b.practitionerId, points: revenuePts, category: 'REVENUE', reason: `Revenue: ${b.treatmentTitle}`, bookingId });

  const addonPence = b.items.filter((i) => i.isAddon).reduce((s, i) => s + Math.max(0, i.pricePence - i.discountPence), 0);
  const upsellPts = Math.floor(addonPence / POINTS.upsellPencePerPoint);
  if (upsellPts > 0) await awardPoints({ staffId: b.practitionerId, points: upsellPts, category: 'UPSELL', reason: `Add-on sale: ${b.treatmentTitle}`, bookingId });
}

/** Reward the practitioner of a client's previous completed treatment when that
 *  client books again — the experience that earned the repeat. Idempotent per
 *  new booking. */
export async function awardForRebooking(newBookingId: string) {
  const nb = await db.booking.findUnique({ where: { id: newBookingId }, select: { id: true, clientId: true, createdAt: true } });
  if (!nb?.clientId) return;
  const already = await db.staffPoints.findFirst({ where: { bookingId: newBookingId, category: 'REBOOK' } });
  if (already) return;
  // The most recent completed booking the client had before this one.
  const prev = await db.booking.findFirst({
    where: { clientId: nb.clientId, status: 'COMPLETED', practitionerId: { not: null }, id: { not: newBookingId } },
    orderBy: { startAt: 'desc' },
    select: { practitionerId: true, treatmentTitle: true },
  });
  if (!prev?.practitionerId) return;
  await awardPoints({ staffId: prev.practitionerId, points: POINTS.rebookBonus, category: 'REBOOK', reason: `Repeat booking secured (after ${prev.treatmentTitle})`, bookingId: newBookingId });
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

/** A staff member's spendable balance — the sum of their ledger (incl. redemptions). */
export async function staffBalance(staffId: string): Promise<number> {
  const agg = await db.staffPoints.aggregate({ where: { staffId }, _sum: { points: true } });
  return agg._sum.points ?? 0;
}

/** Redeem a catalogue reward: verify balance + stock, deduct points, log it.
 *  Balance and stock are re-checked *inside* a serializable transaction so two
 *  concurrent redemptions can never overspend points or oversell stock.
 *  Returns { ok } or { ok:false, error }. */
export async function redeemReward(staffId: string, rewardId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.$transaction(async (tx) => {
      const reward = await tx.reward.findUnique({ where: { id: rewardId } });
      if (!reward || !reward.active) throw new RedeemError('This reward is not available.');
      if (reward.stock != null && reward.stock <= 0) throw new RedeemError('This reward is out of stock.');

      const agg = await tx.staffPoints.aggregate({ where: { staffId }, _sum: { points: true } });
      const balance = agg._sum.points ?? 0;
      if (balance < reward.costPoints) throw new RedeemError(`Not enough points — you have ${balance}, this costs ${reward.costPoints}.`);

      // Deduct via a ledger row (keeps balance a pure sum), record the
      // redemption, and decrement finite stock — atomically.
      await tx.staffPoints.create({
        data: { staffId, points: -reward.costPoints, category: 'REDEMPTION', reason: `Redeemed: ${reward.name}`, awardedBy: 'self' },
      });
      if (reward.stock != null) await tx.reward.update({ where: { id: rewardId }, data: { stock: { decrement: 1 } } });
      await tx.rewardRedemption.create({ data: { rewardId, staffId, costPoints: reward.costPoints, status: 'PENDING' } });

      try {
        const { logAudit } = await import('@/lib/audit');
        await logAudit({ action: 'REWARD_REDEEMED', actor: staffId, summary: `Redeemed "${reward.name}" for ${reward.costPoints} pts` });
      } catch { /* non-fatal */ }
    }, { isolationLevel: 'Serializable' });
    return { ok: true };
  } catch (e) {
    if (e instanceof RedeemError) return { ok: false, error: e.message };
    // Serialization failure (concurrent redemption) or other DB error.
    console.error('[gamification] redeemReward failed:', (e as Error)?.message);
    return { ok: false, error: 'Could not redeem — please try again.' };
  }
}

/** Internal sentinel so transaction guards return a friendly message. */
class RedeemError extends Error {}

/** Manager decision on a pending redemption. Declining refunds the points. */
export async function decideRedemption(redemptionId: string, decision: 'FULFILLED' | 'DECLINED', by: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const r = await db.rewardRedemption.findUnique({ where: { id: redemptionId }, include: { reward: true } });
  if (!r) return { ok: false, error: 'Not found.' };
  if (r.status !== 'PENDING') return { ok: false, error: 'Already decided.' };

  await db.$transaction(async (tx) => {
    await tx.rewardRedemption.update({ where: { id: redemptionId }, data: { status: decision, decidedBy: by, decidedAt: new Date(), note: note || null } });
    if (decision === 'DECLINED') {
      // Refund the points and return stock.
      await tx.staffPoints.create({ data: { staffId: r.staffId, points: r.costPoints, category: 'REDEMPTION', reason: `Refund: ${r.reward.name} (declined)`, awardedBy: by } });
      if (r.reward.stock != null) await tx.reward.update({ where: { id: r.rewardId }, data: { stock: { increment: 1 } } });
    }
  });
  return { ok: true };
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
