import 'server-only';
import { db } from '@/lib/db';

// BLD-1014 / BLD-1098 — package (course) session tracking.
//
// A package purchase is a booking whose primary line item has sessions > 1
// (BLD-409). Follow-up sessions are ordinary bookings linked back via
// Booking.packageBookingId. Balances are DERIVED from bookings — used = the
// completed ones, booked = upcoming ones — so nothing can drift out of sync
// with the diary. Cancelled/no-show sessions do not consume the package
// (no-show fees are handled by the ordinary late-cancel path).

export type PackageView = {
  purchaseBookingId: string;
  label: string; // e.g. "Laser Hair Removal — Full Body"
  treatmentSlug: string;
  sessionsTotal: number;
  sessionsUsed: number; // completed sessions (incl. the purchase visit itself)
  sessionsBooked: number; // pending/confirmed, not yet taken
  sessionsRemaining: number; // total − used − booked (never below 0)
  paid: boolean; // charged or BNPL pre-paid
  purchasedAt: Date;
};

const LIVE = ['PENDING', 'CONFIRMED'] as const;

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
      items: { where: { isAddon: false }, orderBy: { createdAt: 'asc' }, take: 1, select: { sessions: true, label: true } },
      packageSessions: { where: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } }, select: { status: true } },
    },
  }).catch(() => []);

  return purchases.map((p) => {
    const total = p.items[0]?.sessions ?? 1;
    const all = [{ status: p.status }, ...p.packageSessions];
    const used = all.filter((s) => s.status === 'COMPLETED').length;
    const booked = all.filter((s) => (LIVE as readonly string[]).includes(s.status)).length;
    return {
      purchaseBookingId: p.id,
      label: p.items[0]?.label || p.treatmentTitle,
      treatmentSlug: p.treatmentSlug,
      sessionsTotal: total,
      sessionsUsed: used,
      sessionsBooked: booked,
      sessionsRemaining: Math.max(0, total - used - booked),
      paid: Boolean(p.chargedAt || p.prepaidAt),
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
      packageSessions: { where: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } }, select: { id: true, startAt: true } },
    },
  }).catch(() => null);
  if (!purchase) return null;
  const total = purchase.items[0]?.sessions ?? 1;
  const ordered = [{ id: purchase.id, startAt: purchase.startAt }, ...purchase.packageSessions].sort((a, b2) => +a.startAt - +b2.startAt);
  const idx = ordered.findIndex((s) => s.id === bookingId);
  if (idx === -1) return null;
  return { session: idx + 1, total, purchaseBookingId: purchase.id };
}
