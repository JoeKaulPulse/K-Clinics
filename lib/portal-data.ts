import 'server-only';
import { db, withDbRetry } from '@/lib/db';
import { assessmentStatus } from '@/lib/health-assessments';

/** Everything the client dashboard needs, in one query batch. Retried so a
 *  transient DB blip during a deploy doesn't 500 the portal. */
export async function getDashboard(clientId: string) {
  const now = new Date();
  // Bookings are the one thing the dashboard/appointments page can't do without,
  // so a genuine failure there surfaces (retry + error boundary). The rest are
  // non-critical and are isolated — a single bad row or transient miss in any of
  // them must NOT take the whole page down (this used to 500 the appointments page).
  const bookings = await withDbRetry(() => db.booking.findMany({ where: { clientId }, orderBy: { startAt: 'desc' } }));
  const [client, statuses, discount] = await Promise.all([
    db.client.findUnique({ where: { id: clientId } }).catch(() => null),
    assessmentStatus(clientId).catch(() => new Map<string, never>()),
    db.discountClaim.findFirst({ where: { clientId, status: 'ACTIVE' } }).catch(() => null),
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
      lateCancel: b.lateCancel,
      reason: b.lateCancel ? 'Late-cancellation fee' : 'Treatment',
    }));

  // Welcome offer banner — only while it's genuinely a *first-treatment* offer:
  // hide it once the client has booked or had a treatment, and never surface an
  // anti-abuse placeholder ("BLOCKED-…") code, even if such a claim was restored.
  const hasTreatment = bookings.some((b) => b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'COMPLETED');
  const showWelcome = discount && !hasTreatment && !discount.code.startsWith('BLOCKED-');

  return {
    client,
    upcoming,
    past,
    invoices,
    assessments: Object.fromEntries(statuses),
    discount: showWelcome ? { code: discount.code, percent: discount.percent } : null,
  };
}
