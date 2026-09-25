import 'server-only';
import { db } from '@/lib/db';

// BLD-1572 — "Mark as Debt" / staff-recorded outstanding balance.
//
// Distinct from lib/outstanding.ts (BLD-1066), which derives an owed amount
// automatically from late-cancel/no-show bookings. This is a manual record: a
// staff member typed in an amount owed and a reason (card declined, walked out
// without paying, etc). It persists until explicitly resolved — there is no
// automatic clearing condition.

export type ClientDebtItem = {
  id: string;
  amountPence: number;
  reason: string;
  createdBy: string;
  createdAt: Date;
  bookingId: string | null;
};

export type ClientDebtBalance = { totalPence: number; items: ClientDebtItem[] };

/** Unresolved staff-recorded debts for a client, newest first. */
export async function clientDebtBalance(clientId: string): Promise<ClientDebtBalance> {
  const rows = await db.clientDebt.findMany({
    where: { clientId, resolvedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, amountPence: true, reason: true, createdBy: true, createdAt: true, bookingId: true },
  }).catch(() => []);
  return { totalPence: rows.reduce((s, r) => s + r.amountPence, 0), items: rows };
}
