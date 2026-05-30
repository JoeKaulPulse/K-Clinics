import 'server-only';
import { db } from '@/lib/db';
import { assessmentStatus } from '@/lib/health-assessments';

/** Everything the client dashboard needs, in one query batch. */
export async function getDashboard(clientId: string) {
  const now = new Date();
  const [client, bookings, statuses, discount] = await Promise.all([
    db.client.findUnique({ where: { id: clientId } }),
    db.booking.findMany({ where: { clientId }, orderBy: { startAt: 'desc' } }),
    assessmentStatus(clientId),
    db.discountClaim.findFirst({ where: { clientId, status: 'ACTIVE' } }),
  ]);

  const upcoming = bookings
    .filter((b) => b.startAt >= now && (b.status === 'CONFIRMED' || b.status === 'PENDING'))
    .sort((a, b) => +a.startAt - +b.startAt);
  const past = bookings.filter((b) => !upcoming.includes(b));

  // Invoices = bookings that were charged (service or late-cancel fee).
  const invoices = bookings
    .filter((b) => b.chargedAt && b.chargedPence)
    .map((b) => ({
      id: b.id,
      title: b.treatmentTitle,
      amountPence: b.chargedPence!,
      paidAt: b.chargedAt!,
      reference: b.id.slice(-8).toUpperCase(),
      reason: b.lateCancel ? 'Late-cancellation fee' : 'Treatment',
    }));

  return {
    client,
    upcoming,
    past,
    invoices,
    assessments: Object.fromEntries(statuses),
    discount: discount ? { code: discount.code, percent: discount.percent } : null,
  };
}
