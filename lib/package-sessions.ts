import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

// BLD-1014 / BLD-1098 — package (course) session tracking.
//
// A package purchase is a booking whose primary line item has sessions > 1
// (BLD-409). Follow-up sessions are ordinary bookings linked back via
// Booking.packageBookingId. Balances are DERIVED from bookings — used = the
// completed ones, booked = upcoming ones — so nothing can drift out of sync
// with the diary.
//
// A cancelled or missed session does not consume the package by default —
// UNLESS it is marked package-consumed (Booking.packageSessionUsedAt), in which
// case it counts as used exactly like a completed one. That mark is written
// three ways:
//   • by an admin, case by case, on a cancelled session (BLD-1096);
//   • automatically on a NO_SHOW (BLD-1347) — the session IS the fee, because
//     the money already sits on the purchase booking and the £0 linked session
//     has no card charge to take;
//   • automatically on a cancellation inside 24 hours (BLD-1347), under the same
//     published policy that charges a late-cancellation fee on a paid booking.
// A staff waive skips the mark, which is the override in both automatic cases.
//
// The booking's own status is never changed by the mark — it stays CANCELLED or
// NO_SHOW in the diary and appointment history.

export type PackageView = {
  purchaseBookingId: string;
  label: string; // e.g. "Laser Hair Removal — Full Body"
  treatmentSlug: string;
  sessionsTotal: number;
  sessionsUsed: number; // completed sessions (incl. the purchase visit itself)
  sessionsBooked: number; // pending/confirmed, not yet taken
  sessionsRemaining: number; // total − used − booked (never below 0)
  paid: boolean; // settled AND not fully refunded — i.e. the sessions are spendable
  // BLD-1380: fully refunded (refundedPence >= chargedPence). Distinct from
  // !paid: the money WAS taken and has since been given back, so every surface
  // that renders a balance must say "Refunded", never "Payment pending" — the
  // latter reads as a demand for money the client has already had returned.
  refunded: boolean;
  purchasedAt: Date;
};

const LIVE = ['PENDING', 'CONFIRMED'] as const;
// BLD-1096 / BLD-1347: a linked session still counts toward the package's derived
// totals when it's either genuinely live/completed, OR it's a cancelled/missed
// appointment that has been marked package-consumed (kept out of the query by a
// plain `notIn: ['CANCELLED', 'NO_SHOW']` filter, so that case needs its own OR branch).
const SESSION_INCLUDED: Prisma.BookingWhereInput = {
  OR: [
    { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    { status: { in: ['CANCELLED', 'NO_SHOW'] }, packageSessionUsedAt: { not: null } },
  ],
};

/** Every booking that occupies a slot on this package: the purchase visit itself
 *  plus each linked session that still counts. Exported so a booking transaction
 *  can re-check the balance under Serializable isolation against the SAME
 *  definition the derived view uses, instead of a second, drifting copy. */
export function packageOccupancyWhere(purchaseBookingId: string): Prisma.BookingWhereInput {
  return { AND: [{ OR: [{ id: purchaseBookingId }, { packageBookingId: purchaseBookingId }] }, SESSION_INCLUDED] };
}

/** Has this session been spent — completed, or cancelled/missed and marked
 *  package-consumed? Shared so the query filter above and the count below can
 *  never disagree about what "used" means. */
const isUsed = (s: { status: string; packageSessionUsedAt: Date | null }): boolean =>
  s.status === 'COMPLETED' || ((s.status === 'CANCELLED' || s.status === 'NO_SHOW') && Boolean(s.packageSessionUsedAt));

/** BLD-1347: spend one session off the client's package balance for a session
 *  they missed or cancelled late. The money already sits on the purchase
 *  booking, so consuming the session IS how the fee is taken — the £0 linked
 *  booking has no card charge to make.
 *
 *  Only ever marks a FOLLOW-UP session (one linked back via packageBookingId).
 *  The course purchase booking itself is excluded for the BLD-1096 reason: a
 *  cancelled purchase drops the whole package from clientPackages(), so marking
 *  it would change no balance while claiming a session had been deducted.
 *  Idempotent — a session already marked is left alone, so a re-run (or a
 *  status flipped back and forth) can't deduct twice. Never throws.
 *
 *  Returns true only when this call was the one that spent the session. */
export async function consumePackageSession(bookingId: string, by: string): Promise<boolean> {
  const res = await db.booking.updateMany({
    where: { id: bookingId, packageBookingId: { not: null }, packageSessionUsedAt: null },
    data: { packageSessionUsedAt: new Date(), packageSessionUsedBy: by },
  }).catch(() => ({ count: 0 }));
  return res.count > 0;
}

/** All packages a client has bought, newest first. */
export async function clientPackages(clientId: string): Promise<PackageView[]> {
  const purchases = await db.booking.findMany({
    where: {
      clientId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      items: { some: { isAddon: false, sessions: { gt: 1 } } },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, treatmentSlug: true, treatmentTitle: true, status: true,
      chargedAt: true, prepaidAt: true, createdAt: true,
      chargedPence: true, refundedPence: true,
      items: { where: { isAddon: false }, orderBy: { createdAt: 'asc' }, take: 1, select: { sessions: true, label: true } },
      packageSessions: { where: SESSION_INCLUDED, select: { status: true, packageSessionUsedAt: true } },
    },
  }).catch(() => []);

  return purchases.map((p) => {
    const total = p.items[0]?.sessions ?? 1;
    const all = [{ status: p.status, packageSessionUsedAt: null as Date | null }, ...p.packageSessions];
    const used = all.filter(isUsed).length;
    const booked = all.filter((s) => (LIVE as readonly string[]).includes(s.status)).length;
    // BLD-1380: a fully refunded purchase must not read as paid, or the client
    // can keep booking/spending sessions they got their money back for.
    const fullyRefunded = (p.chargedPence ?? 0) > 0 && (p.refundedPence ?? 0) >= (p.chargedPence ?? 0);
    return {
      purchaseBookingId: p.id,
      label: p.items[0]?.label || p.treatmentTitle,
      treatmentSlug: p.treatmentSlug,
      sessionsTotal: total,
      sessionsUsed: used,
      sessionsBooked: booked,
      sessionsRemaining: Math.max(0, total - used - booked),
      paid: Boolean(p.chargedAt || p.prepaidAt) && !fullyRefunded,
      refunded: fullyRefunded,
      purchasedAt: p.createdAt,
    };
  });
}

/** "Session X of N" for a booking that is part of a package (the purchase
 *  booking itself or a linked session). Null when the booking isn't one. */
export async function packageSessionNumber(bookingId: string): Promise<{ session: number; total: number; purchaseBookingId: string } | null> {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, packageBookingId: true, items: { where: { isAddon: false }, orderBy: { createdAt: 'asc' }, take: 1, select: { sessions: true } } },
  }).catch(() => null);
  if (!b) return null;
  const purchaseId = b.packageBookingId ?? (b.items[0] && (b.items[0].sessions ?? 1) > 1 ? b.id : null);
  if (!purchaseId) return null;
  const purchase = await db.booking.findUnique({
    where: { id: purchaseId },
    select: {
      id: true, startAt: true,
      items: { where: { isAddon: false }, orderBy: { createdAt: 'asc' }, take: 1, select: { sessions: true } },
      packageSessions: { where: SESSION_INCLUDED, select: { id: true, startAt: true } },
    },
  }).catch(() => null);
  if (!purchase) return null;
  const total = purchase.items[0]?.sessions ?? 1;
  const ordered = [{ id: purchase.id, startAt: purchase.startAt }, ...purchase.packageSessions].sort((a, b2) => +a.startAt - +b2.startAt);
  const idx = ordered.findIndex((s) => s.id === bookingId);
  if (idx === -1) return null;
  return { session: idx + 1, total, purchaseBookingId: purchase.id };
}
