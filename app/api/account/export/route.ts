import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Client self-service data export (GDPR subject access). Returns the signed-in
// client's own record as JSON. Secrets are never included; clinical answers are
// summarised (the encrypted detail is shared by the clinic on request, with
// identity checks) — this gives the client their account + booking history.
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getClientSession } = await import('@/lib/auth');
  const session = await getClientSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const { db } = await import('@/lib/db');
  const c = await db.client.findUnique({
    where: { id: session.sub },
    include: {
      bookings: { orderBy: { startAt: 'desc' }, select: { treatmentTitle: true, startAt: true, status: true, chargedPence: true, chargedAt: true } },
      assessments: { orderBy: { submittedAt: 'desc' }, select: { type: true, version: true, submittedAt: true, sourceLocale: true } },
      discountClaims: { select: { code: true, percent: true, status: true, createdAt: true } },
      emails: { orderBy: { createdAt: 'desc' }, take: 50, select: { kind: true, subject: true, status: true, createdAt: true } },
    },
  });
  if (!c) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

  const out = {
    exportedAt: new Date().toISOString(),
    account: {
      firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone,
      dateOfBirth: c.dob, preferredLanguage: c.locale, marketingOptIn: c.marketingOptIn,
      memberSince: c.createdAt, lastVisit: c.lastVisitAt,
    },
    appointments: c.bookings,
    healthForms: c.assessments, // metadata only; encrypted detail provided on verified request
    offers: c.discountClaims,
    emails: c.emails,
  };

  const name = [c.firstName, c.lastName].filter(Boolean).join('-').toLowerCase() || 'account';
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="kclinics-my-data-${name}.json"`,
    },
  });
}
