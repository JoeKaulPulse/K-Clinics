'use server';

import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';

// BLD-1872: the dashboard "Up next" card used to decrypt the next arrival's
// allergies/medical flag on every /admin render and audit that as a clinical
// view, filling the Activity Log with views nobody initiated. The card now only
// says a flag is on file; the text is fetched here when a user taps "Show", so
// the decrypt, the display and the audit row all follow a real user action.
export async function revealArrivalClinical(bookingId: string): Promise<{ allergies: string | null; medicalFlag: string | null } | null> {
  if (!crmEnabled || typeof bookingId !== 'string' || !bookingId) return null;
  const session = await getSession();
  if (!session?.email) return null;
  if (!sessionCan(session, 'bookings.view') || !sessionCan(session, 'clients.clinical.view')) return null;

  const { db } = await import('@/lib/db');
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, clientId: true, practitionerId: true, client: { select: { allergies: true, medicalFlag: true } } },
  });
  if (!b) return null;
  // Same practitioner scoping as getBooking() (BLD-1693): a PRACTITIONER only
  // reaches their own bookings; elevated roles are unscoped.
  if (session.role === 'PRACTITIONER' && b.practitionerId !== session.sub) return null;

  const { decClinical } = await import('@/lib/clinical-crypto');
  const allergies = decClinical(b.client.allergies)?.trim() || null;
  const medicalFlag = decClinical(b.client.medicalFlag)?.trim() || null;
  if (allergies || medicalFlag) {
    const { auditClinicalView } = await import('@/lib/clinical-view-audit');
    auditClinicalView({ actor: session.email, actorRole: session.role, clientId: b.clientId, surface: 'admin-dashboard-reveal', bookingId: b.id });
  }
  return { allergies, medicalFlag };
}
