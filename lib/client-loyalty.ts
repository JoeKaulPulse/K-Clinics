import 'server-only';
import { db, withDbRetry } from '@/lib/db';
import crypto from 'crypto';
import type { ClientPointsCategory } from '@prisma/client';

// ── Client loyalty engine ────────────────────────────────────────────────────
// Points live in an append-only ledger (ClientPoints). A client's balance is the
// sum of their rows, with earned lots dropping out once they pass their 12-month
// expiry (handled by FIFO accounting below, so the balance is always correct
// whether or not the daily expiry sweep has run). Tune all values here.
export const LOYALTY = {
  pointsPerPound: 1,             // earn 1 pt per £1 of completed spend
  pointValuePence: 1,            // a point is worth 1p on redemption → 100 pts = £1
  reviewBonus: 50,               // leaving a review → £0.50
  birthdayBonus: 200,            // annual birthday gift → £2
  referralReward: 2500,          // £25 credit to BOTH sides of a qualifying referral
  referralThresholdPence: 10000, // friend's FIRST treatment must be ≥ £100 to qualify
  expiryMonths: 12,              // earned points expire 12 months after they're earned
  maxRedeemFraction: 0.5,        // points may cover at most 50% of any one booking
};

/** £ value (in pence) of a points balance. */
export function pointsToPence(points: number): number {
  return Math.max(0, Math.round(points * LOYALTY.pointValuePence));
}

/** Categories that represent positive *earned* points (subject to expiry). */
const EARN_CATS: ClientPointsCategory[] = ['SPEND', 'REVIEW', 'BIRTHDAY', 'REFERRAL'];

function expiryFor(category: ClientPointsCategory, points: number): Date | null {
  // Earned, positive points expire; redemptions, refunds, expiry and deductions don't.
  if (points > 0 && (EARN_CATS.includes(category) || category === 'MANUAL')) {
    return new Date(Date.now() + LOYALTY.expiryMonths * 30.44 * 864e5);
  }
  return null;
}

/** Append a ledger entry. Never throws into the caller's critical path. */
export async function awardClientPoints(opts: {
  clientId: string;
  points: number;
  category: ClientPointsCategory;
  reason: string;
  bookingId?: string | null;
  reviewId?: string | null;
  referralId?: string | null;
  awardedBy?: string;
  expiresAt?: Date | null;
}): Promise<{ ok: boolean }> {
  if (!opts.clientId || !opts.points) return { ok: false };
  try {
    await db.clientPoints.create({
      data: {
        clientId: opts.clientId,
        points: Math.round(opts.points),
        category: opts.category,
        reason: opts.reason.slice(0, 200),
        bookingId: opts.bookingId ?? null,
        reviewId: opts.reviewId ?? null,
        referralId: opts.referralId ?? null,
        awardedBy: opts.awardedBy ?? 'system',
        expiresAt: opts.expiresAt !== undefined ? opts.expiresAt : expiryFor(opts.category, opts.points),
      },
    });
    return { ok: true };
  } catch (e) {
    console.error('[loyalty] awardClientPoints failed (continuing):', (e as Error)?.message);
    return { ok: false };
  }
}

type Lot = { remaining: number; expiresAt: Date | null };

/** FIFO accounting over the ledger. Redemptions/expiry/deductions consume the
 *  soonest-to-expire earned points first, so the live balance is correct
 *  regardless of whether the daily expiry sweep has written EXPIRY rows yet.
 *  Returns the spendable balance and the amount currently sitting past expiry. */
/** Spendable balance from raw ledger rows (FIFO expiry consumed soonest-first).
 *  Pure — reused inside the redemption transaction for a consistent read. */
export function computeBalance(rows: { points: number; expiresAt: Date | null }[]): number {
  const lots = rows.filter((r) => r.points > 0).map((r) => ({ remaining: r.points, expiresAt: r.expiresAt }));
  lots.sort((a, b) => { if (!a.expiresAt) return 1; if (!b.expiresAt) return -1; return +a.expiresAt - +b.expiresAt; });
  let consume = rows.filter((r) => r.points < 0).reduce((s, r) => s - r.points, 0);
  for (const lot of lots) { if (consume <= 0) break; const take = Math.min(lot.remaining, consume); lot.remaining -= take; consume -= take; }
  const now = Date.now();
  let balance = 0;
  for (const lot of lots) { if (lot.remaining <= 0) continue; if (lot.expiresAt && +lot.expiresAt <= now) continue; balance += lot.remaining; }
  return balance;
}

async function reconcile(clientId: string): Promise<{ balance: number; expiredUnswept: number; expiringSoon: number }> {
  const rows = await db.clientPoints.findMany({
    where: { clientId },
    select: { points: true, expiresAt: true },
  });

  const lots: Lot[] = rows.filter((r) => r.points > 0).map((r) => ({ remaining: r.points, expiresAt: r.expiresAt }));
  // Consume soonest-expiring first (nulls — non-expiring — last).
  lots.sort((a, b) => {
    if (!a.expiresAt) return 1;
    if (!b.expiresAt) return -1;
    return +a.expiresAt - +b.expiresAt;
  });

  let consume = rows.filter((r) => r.points < 0).reduce((s, r) => s - r.points, 0);
  for (const lot of lots) {
    if (consume <= 0) break;
    const take = Math.min(lot.remaining, consume);
    lot.remaining -= take;
    consume -= take;
  }

  const now = Date.now();
  const soon = now + 30 * 864e5; // expiring within 30 days
  let balance = 0, expiredUnswept = 0, expiringSoon = 0;
  for (const lot of lots) {
    if (lot.remaining <= 0) continue;
    if (lot.expiresAt && +lot.expiresAt <= now) { expiredUnswept += lot.remaining; continue; }
    balance += lot.remaining;
    if (lot.expiresAt && +lot.expiresAt <= soon) expiringSoon += lot.remaining;
  }
  return { balance, expiredUnswept, expiringSoon };
}

/** Spendable points balance for a client (expiry-correct). */
export async function clientBalance(clientId: string): Promise<number> {
  return (await reconcile(clientId)).balance;
}

/** Recent ledger entries (for portal + admin statements). */
export async function clientLedger(clientId: string, limit = 50) {
  return db.clientPoints.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take: limit });
}

// ── Earning ──────────────────────────────────────────────────────────────────

/** True spend (pence) for a booking: the amount charged, else the listed price. */
function bookingSpendPence(b: { chargedPence: number | null; pricePence: number }): number {
  return b.chargedPence && b.chargedPence > 0 ? b.chargedPence : b.pricePence;
}

/** Award loyalty points for a completed/charged booking (1 pt per £1). Idempotent
 *  per booking. Also triggers referral qualification on the client's first
 *  qualifying treatment. Safe to call from both the completion and charge paths. */
export async function awardClientSpend(bookingId: string): Promise<void> {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, clientId: true, treatmentTitle: true, pricePence: true, chargedPence: true },
  });
  if (!b) return;

  const spend = bookingSpendPence(b);
  if (spend <= 0) return; // amount not known yet (on-consultation, not charged)

  // Idempotent: one SPEND row per booking.
  const existing = await db.clientPoints.findFirst({ where: { bookingId, category: 'SPEND' } });
  if (!existing) {
    const base = Math.floor((spend / 100) * LOYALTY.pointsPerPound);
    // Accelerated earn for members — multiply by the client's current tier rate.
    let pts = base;
    try {
      const { earnMultiplierBps } = await import('@/lib/membership');
      pts = Math.floor((base * (await earnMultiplierBps(b.clientId))) / 100);
    } catch { /* tiers unavailable → base rate */ }
    if (pts > 0) {
      await awardClientPoints({
        clientId: b.clientId, points: pts, category: 'SPEND',
        reason: `Earned on ${b.treatmentTitle}`, bookingId,
      });
    }
  }

  // Refresh the client's membership tier now this spend is realised.
  try {
    const { recomputeClientTier } = await import('@/lib/membership');
    await recomputeClientTier(b.clientId);
  } catch (e) {
    console.error('[membership] recompute failed (continuing):', (e as Error)?.message);
  }

  // Referral qualification runs off the same trigger.
  try {
    await maybeQualifyReferral(b.clientId, b.id, spend);
  } catch (e) {
    console.error('[loyalty] referral qualify failed (continuing):', (e as Error)?.message);
  }
}

/** Award a bonus when a client review is published/approved. Idempotent. */
export async function awardClientReview(reviewId: string): Promise<void> {
  const r = await db.review.findUnique({ where: { id: reviewId }, select: { id: true, clientId: true } });
  if (!r?.clientId) return;
  const existing = await db.clientPoints.findFirst({ where: { reviewId, category: 'REVIEW' } });
  if (existing) return;
  await awardClientPoints({ clientId: r.clientId, points: LOYALTY.reviewBonus, category: 'REVIEW', reason: 'Thank you for your review', reviewId });
}

// ── Referrals ──────────────────────────────────────────────────────────────

/** A client's own shareable referral code, generated on first use. */
export async function getOrCreateReferralCode(clientId: string): Promise<string> {
  const c = await db.client.findUnique({ where: { id: clientId }, select: { referralCode: true, firstName: true } });
  if (c?.referralCode) return c.referralCode;
  const base = (c?.firstName || 'KC').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'KC';
  for (let i = 0; i < 6; i++) {
    const code = `${base}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    try {
      await db.client.update({ where: { id: clientId }, data: { referralCode: code } });
      return code;
    } catch { /* unique clash — retry */ }
  }
  // Fallback: collision-proof long code.
  const code = `KC-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  await db.client.update({ where: { id: clientId }, data: { referralCode: code } });
  return code;
}

/** Link a brand-new client to the referrer behind a code (called at sign-up).
 *  Guards against self-referral and double-referral. Best-effort. */
export async function linkReferral(code: string, newClientId: string, referredEmail?: string): Promise<void> {
  if (!code?.trim()) return;
  try {
    const referrer = await db.client.findUnique({ where: { referralCode: code.trim().toUpperCase() }, select: { id: true } });
    if (!referrer || referrer.id === newClientId) return; // unknown code or self-referral
    // A client can only be referred once.
    const already = await db.referral.findUnique({ where: { referredId: newClientId } });
    if (already) return;
    await db.referral.create({
      data: { referrerId: referrer.id, referredId: newClientId, referredEmail: referredEmail || null, status: 'JOINED' },
    });
    await db.client.update({ where: { id: newClientId }, data: { referredById: referrer.id } });
  } catch (e) {
    console.error('[loyalty] linkReferral failed (continuing):', (e as Error)?.message);
  }
}

/** When a referred friend's FIRST treatment of ≥ £100 completes, credit £25 to
 *  both sides. Idempotent (referral status guards re-entry). */
async function maybeQualifyReferral(clientId: string, bookingId: string, spendPence: number): Promise<void> {
  const ref = await db.referral.findUnique({ where: { referredId: clientId } });
  if (!ref || ref.status !== 'JOINED') return; // not referred, or already decided

  // "First treatment" = no earlier SPEND award exists for this client besides
  // the one just (or about to be) made for this booking.
  const priorSpend = await db.clientPoints.findFirst({
    where: { clientId, category: 'SPEND', bookingId: { not: bookingId } },
  });
  if (priorSpend) {
    // They've already had a first treatment that didn't qualify — close it out.
    await db.referral.update({ where: { id: ref.id }, data: { status: 'EXPIRED' } });
    return;
  }

  if (spendPence < LOYALTY.referralThresholdPence) {
    // First treatment was under £100 — referral doesn't qualify.
    await db.referral.update({ where: { id: ref.id }, data: { status: 'EXPIRED' } });
    return;
  }

  // Qualify: credit both sides.
  await db.referral.update({ where: { id: ref.id }, data: { status: 'QUALIFIED', qualifiedAt: new Date(), rewardedAt: new Date() } });
  await awardClientPoints({ clientId: ref.referrerId, points: LOYALTY.referralReward, category: 'REFERRAL', reason: 'A friend you referred completed their first treatment', referralId: ref.id });
  await awardClientPoints({ clientId, points: LOYALTY.referralReward, category: 'REFERRAL', reason: 'Welcome bonus for joining via a friend', referralId: ref.id });
}

// ── Redemption ─────────────────────────────────────────────────────────────

/** Apply points against an upcoming booking as money off, capped at 50% of the
 *  price. `points` must be a positive multiple of 100 (whole pounds). Returns the
 *  pence discounted. Replaces any prior redemption on the same booking. */
export async function redeemPointsOnBooking(clientId: string, bookingId: string, points: number): Promise<{ ok: boolean; error?: string; discountPence?: number }> {
  try {
    const b = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true, clientId: true, status: true, pricePence: true, treatmentTitle: true } });
    if (!b || b.clientId !== clientId) return { ok: false, error: 'Booking not found.' };
    if (b.status === 'COMPLETED' || b.status === 'CANCELLED' || b.status === 'NO_SHOW') return { ok: false, error: 'This booking can no longer be changed.' };
    if (b.pricePence <= 0) return { ok: false, error: 'Points can’t be applied to this booking.' };

    const want = Math.max(0, Math.floor(points / 100) * 100); // whole pounds only
    const capPoints = Math.floor(Math.floor(b.pricePence * LOYALTY.maxRedeemFraction) / LOYALTY.pointValuePence);

    // Read balance and write the ledger + booking atomically (Serializable) so
    // concurrent redemptions can't both pass the balance check and overspend.
    return await db.$transaction(async (tx) => {
      const cur = await tx.booking.findUnique({ where: { id: bookingId }, select: { pointsRedeemed: true } });
      // Refund any existing redemption first so this is a clean re-apply.
      if (cur && cur.pointsRedeemed > 0) {
        await tx.clientPoints.create({ data: { clientId, points: cur.pointsRedeemed, category: 'REDEMPTION', reason: `Points returned (re-applied): ${b.treatmentTitle}`.slice(0, 200), bookingId, awardedBy: 'system', expiresAt: null } });
        await tx.booking.update({ where: { id: bookingId }, data: { pointsRedeemed: 0, pointsRedeemedPence: 0 } });
      }
      if (want === 0) return { ok: true, discountPence: 0 }; // cleared the redemption

      const rows = await tx.clientPoints.findMany({ where: { clientId }, select: { points: true, expiresAt: true } });
      const balance = computeBalance(rows);
      const spend = Math.min(want, capPoints, balance);
      if (spend <= 0) return { ok: false, error: balance < 100 ? 'You need at least 100 points to redeem.' : 'Nothing to redeem here.' };
      if (spend < want && want > balance) return { ok: false, error: `You only have ${balance} points.` };

      const discountPence = spend * LOYALTY.pointValuePence;
      await tx.clientPoints.create({ data: { clientId, points: -spend, category: 'REDEMPTION', reason: `Applied to ${b.treatmentTitle}`.slice(0, 200), bookingId, awardedBy: 'system', expiresAt: null } });
      await tx.booking.update({ where: { id: bookingId }, data: { pointsRedeemed: spend, pointsRedeemedPence: discountPence } });
      return { ok: true, discountPence };
    }, { isolationLevel: 'Serializable' });
  } catch (e) {
    console.error('[loyalty] redeemPointsOnBooking failed:', (e as Error)?.message);
    return { ok: false, error: 'Could not apply points — please try again.' };
  }
}

/** Return points tied to a booking (e.g. when it's cancelled). Idempotent. */
export async function refundBookingPoints(bookingId: string): Promise<void> {
  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true, clientId: true, pointsRedeemed: true, treatmentTitle: true } });
  if (!b || b.pointsRedeemed <= 0) return;
  await awardClientPoints({ clientId: b.clientId, points: b.pointsRedeemed, category: 'REDEMPTION', reason: `Points returned (cancelled): ${b.treatmentTitle}`, bookingId });
  await db.booking.update({ where: { id: bookingId }, data: { pointsRedeemed: 0, pointsRedeemedPence: 0 } });
}

// ── Maintenance (cron) ───────────────────────────────────────────────────────

/** Daily birthday gift — points for portal-active clients on their birthday.
 *  Idempotent within the year (one BIRTHDAY row per client per ~year). */
export async function awardBirthdayPoints(): Promise<number> {
  const today = new Date();
  const clients = await db.client.findMany({ where: { dob: { not: null }, portalActive: true }, select: { id: true, dob: true, firstName: true } });
  let n = 0;
  for (const c of clients) {
    if (!c.dob || c.dob.getMonth() !== today.getMonth() || c.dob.getDate() !== today.getDate()) continue;
    const since = new Date(Date.now() - 350 * 864e5);
    const recent = await db.clientPoints.findFirst({ where: { clientId: c.id, category: 'BIRTHDAY', createdAt: { gte: since } } });
    if (recent) continue;
    const res = await awardClientPoints({ clientId: c.id, points: LOYALTY.birthdayBonus, category: 'BIRTHDAY', reason: 'Happy birthday from KClinics 🎂' });
    if (res.ok) n++;
  }
  return n;
}

/** Materialise EXPIRY rows for points that have passed their 12-month expiry.
 *  Balance is already expiry-correct via reconcile(); this just records the
 *  expiry in the ledger so client statements show it. Idempotent. */
export async function expireOldPoints(): Promise<number> {
  // Clients with at least one past-due earned lot.
  const due = await db.clientPoints.findMany({
    where: { points: { gt: 0 }, expiresAt: { lte: new Date() } },
    select: { clientId: true },
    distinct: ['clientId'],
  });
  let expired = 0;
  for (const { clientId } of due) {
    const { expiredUnswept } = await reconcile(clientId);
    if (expiredUnswept > 0) {
      const res = await awardClientPoints({ clientId, points: -expiredUnswept, category: 'EXPIRY', reason: 'Points expired (12 months)' });
      if (res.ok) expired += expiredUnswept;
    }
  }
  return expired;
}

// ── Portal / admin summaries ─────────────────────────────────────────────────

export type LoyaltySummary = {
  balance: number;
  valuePence: number;
  expiringSoon: number;
  referralCode: string | null;
  referralsQualified: number;
  referralsPending: number;
};

/** Everything the portal rewards card needs. Does not mint a referral code
 *  (that happens when the client opens the referral panel). */
export async function clientLoyaltySummary(clientId: string): Promise<LoyaltySummary> {
  // Retried, and degrades to an empty (zero-balance) summary rather than throwing
  // — a loyalty card is non-essential and must never 500 the whole dashboard.
  try {
    const [rec, client, refs] = await withDbRetry(() => Promise.all([
      reconcile(clientId),
      db.client.findUnique({ where: { id: clientId }, select: { referralCode: true } }),
      db.referral.groupBy({ by: ['status'], where: { referrerId: clientId }, _count: true }),
    ]));
    const byStatus = new Map(refs.map((r) => [r.status, r._count]));
    return {
      balance: rec.balance,
      valuePence: pointsToPence(rec.balance),
      expiringSoon: rec.expiringSoon,
      referralCode: client?.referralCode ?? null,
      referralsQualified: byStatus.get('QUALIFIED') ?? 0,
      referralsPending: byStatus.get('JOINED') ?? 0,
    };
  } catch {
    return { balance: 0, valuePence: 0, expiringSoon: 0, referralCode: null, referralsQualified: 0, referralsPending: 0 };
  }
}
