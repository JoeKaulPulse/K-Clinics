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
  // BLD-574: split the appointment *display* lists into two bounded queries to
  // cap memory for long-tenured clients (upcoming: next 10; past: last 50).
  // Invoices and the welcome-offer gate are derived from their OWN targeted
  // queries, NOT from these display windows — otherwise a client with >50 past
  // bookings would silently lose older invoices (and their lifetime total would
  // understate), and the first-treatment offer could re-surface for someone
  // whose only treatments fell outside the 50-row window.
  const [upcoming, pastRaw, charged, treatmentCount, client, statuses, discount] = await Promise.all([
    withDbRetry(() => db.booking.findMany({ where: { clientId, startAt: { gte: now }, status: { in: ['CONFIRMED', 'PENDING'] } }, orderBy: { startAt: 'asc' }, take: 10 })),
    withDbRetry(() => db.booking.findMany({ where: { clientId, OR: [{ startAt: { lt: now } }, { status: { notIn: ['CONFIRMED', 'PENDING'] } }] }, orderBy: { startAt: 'desc' }, take: 50 })),
    // Charged bookings only — the naturally-bounded set that backs the invoices
    // page (full financial record, independent of the display windows).
    withDbRetry(() => db.booking.findMany({ where: { clientId, chargedAt: { not: null }, chargedPence: { not: null } }, orderBy: { chargedAt: 'desc' }, select: { id: true, treatmentTitle: true, chargedPence: true, chargedAt: true, lateCancel: true } })),
    db.booking.count({ where: { clientId, status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] } } }).catch(() => 0),
    db.client.findUnique({ where: { id: clientId } }).catch(() => null),
    assessmentStatus(clientId).catch(() => new Map<string, never>()),
    db.discountClaim.findFirst({ where: { clientId, status: 'ACTIVE' } }).catch(() => null),
  ]);

  // Invoices = bookings that were charged (service or late-cancel fee).
  const invoices = charged.map((b) => ({
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
  const hasTreatment = treatmentCount > 0;
  const showWelcome = discount && !hasTreatment && !discount.code.startsWith('BLOCKED-');

  return {
    client,
    upcoming,
    past: pastRaw,
    invoices,
    assessments: Object.fromEntries(statuses),
    discount: showWelcome ? { code: discount.code, percent: discount.percent } : null,
  };
}
