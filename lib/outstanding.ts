import 'server-only';
import { db } from '@/lib/db';

// BLD-1066 — outstanding payments from late cancellations and no-shows.
//
// An appointment cancelled inside 24h (lateCancel, fee not waived) or marked a
// no-show owes the full treatment fee until it is either charged (chargedAt)
// or waived (feeWaived). Deriving the balance from those fields means paying
// or waiving clears every warning automatically — there is no separate flag
// to forget to reset.

export type OutstandingItem = {
  bookingId: string;
  treatmentTitle: string;
  startAt: Date;
  pricePence: number;
  kind: 'late-cancel' | 'no-show';
};

export type OutstandingBalance = { totalPence: number; items: OutstandingItem[] };

export async function outstandingBalance(clientId: string): Promise<OutstandingBalance> {
  const rows = await db.booking.findMany({
    where: {
      clientId,
      chargedAt: null,
      feeWaived: false,
      pricePence: { gt: 0 },
      OR: [
        { status: 'CANCELLED', lateCancel: true },
        { status: 'NO_SHOW' },
      ],
    },
    orderBy: { startAt: 'desc' },
    select: { id: true, treatmentTitle: true, startAt: true, pricePence: true, status: true },
  }).catch(() => []);
  const items: OutstandingItem[] = rows.map((b) => ({
    bookingId: b.id, treatmentTitle: b.treatmentTitle, startAt: b.startAt, pricePence: b.pricePence,
    kind: b.status === 'NO_SHOW' ? 'no-show' : 'late-cancel',
  }));
  return { totalPence: items.reduce((s, i) => s + i.pricePence, 0), items };
}
