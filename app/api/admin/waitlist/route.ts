import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-1646 — staff-initiated waitlist signup: a client calls to ask to be put
// on the list (or staff spot a good candidate on the phone) and there was
// previously no way to record it except the client's own public form. Mirrors
// lib/waitlist.ts's joinWaitlist() dedupe rules, just triggered from the admin
// side for an existing client record.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled.' }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('bookings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
  const treatmentSlug = typeof body.treatmentSlug === 'string' ? body.treatmentSlug.trim() : '';
  const fromDate = typeof body.fromDate === 'string' ? new Date(body.fromDate) : null;
  const toDate = typeof body.toDate === 'string' ? new Date(body.toDate) : null;
  if (!clientId || !treatmentSlug || !fromDate || !toDate || Number.isNaN(+fromDate) || Number.isNaN(+toDate)) {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }
  if (+toDate < +fromDate) return NextResponse.json({ ok: false, error: 'Window end is before its start.' }, { status: 400 });

  const { getTreatment } = await import('@/lib/treatments');
  const treatment = getTreatment(treatmentSlug);
  if (!treatment) return NextResponse.json({ ok: false, error: 'Unknown treatment.' }, { status: 400 });

  try {
    const { db } = await import('@/lib/db');
    const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return NextResponse.json({ ok: false, error: 'Client not found.' }, { status: 404 });

    const { joinWaitlist } = await import('@/lib/waitlist');
    const r = await joinWaitlist({ clientId, treatmentSlug, treatmentTitle: treatment.title, fromDate, toDate });
    return NextResponse.json({ ok: true, created: r.created });
  } catch (e) {
    Sentry.captureException(e, { tags: { area: 'admin/waitlist/create' } });
    return NextResponse.json({ ok: false, error: 'Could not add to the waitlist.' }, { status: 500 });
  }
}
