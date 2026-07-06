import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Internal Incident (Accident) form — staff-only. Any staff who can edit clients
// may log/read incidents (matches note-taking); the routes are admin-only and never
// reachable from the client portal. Free-text is encrypted at rest. (BLD-760)
const CATEGORIES = ['Slip/trip/fall', 'Burn/scald', 'Allergic reaction', 'Equipment', 'Needlestick', 'Other'];
const SEVERITIES = ['minor', 'moderate', 'serious'];
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const optStr = (v: unknown, max: number) => str(v, max) || null;

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('clients.edit');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const clientId = new URL(req.url).searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ ok: false, error: 'Missing clientId.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const { decClinical } = await import('@/lib/clinical-crypto');
  const rows = await db.incident.findMany({
    where: { clientId },
    orderBy: { occurredAt: 'desc' },
    include: { booking: { select: { id: true, treatmentTitle: true, startAt: true } } },
  });
  const incidents = rows.map((r) => ({
    id: r.id,
    occurredAt: r.occurredAt,
    category: r.category,
    severity: r.severity,
    location: r.location,
    description: decClinical(r.description),
    injury: decClinical(r.injury),
    actionTaken: decClinical(r.actionTaken),
    witnesses: decClinical(r.witnesses),
    riddorReportable: r.riddorReportable,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    booking: r.booking ? { id: r.booking.id, treatmentTitle: r.booking.treatmentTitle, startAt: r.booking.startAt } : null,
  }));
  return NextResponse.json({ ok: true, incidents });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('clients.edit');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const clientId = str(b.clientId, 40);
  const description = str(b.description, 4000);
  if (!clientId || !description) {
    return NextResponse.json({ ok: false, error: 'Client and a description of what happened are required.' }, { status: 400 });
  }

  const { db } = await import('@/lib/db');
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ ok: false, error: 'Client not found.' }, { status: 404 });

  // Only link a booking that actually belongs to this client.
  let bookingId: string | null = null;
  const rawBooking = str(b.bookingId, 40);
  if (rawBooking) {
    const bk = await db.booking.findFirst({ where: { id: rawBooking, clientId }, select: { id: true } });
    bookingId = bk?.id ?? null;
  }

  const occurredAt = b.occurredAt && !Number.isNaN(Date.parse(String(b.occurredAt))) ? new Date(String(b.occurredAt)) : new Date();
  const category = CATEGORIES.includes(b.category) ? b.category : 'Other';
  const severity = SEVERITIES.includes(b.severity) ? b.severity : 'minor';

  const { encClinical } = await import('@/lib/clinical-crypto');
  const enc = (v: unknown, max: number) => { const s = optStr(v, max); return s ? encClinical(s) : null; };
  try {
    const incident = await db.incident.create({
      data: {
        clientId,
        bookingId,
        occurredAt,
        category,
        severity,
        location: optStr(b.location, 200),
        description: encClinical(description),
        injury: enc(b.injury, 2000),
        actionTaken: enc(b.actionTaken, 2000),
        witnesses: enc(b.witnesses, 500),
        riddorReportable: Boolean(b.riddorReportable),
        createdBy: session.email,
      },
      select: { id: true },
    });
    // Surface a NON-sensitive marker in the client's treatment-history timeline so
    // the incident is visible in context. The description/injury detail stays in the
    // clients.edit-gated incident card (the timeline is visible to clients.view-only
    // staff), so no health free-text goes here. Non-fatal: the Incident row is the
    // source of truth.
    try {
      await db.interaction.create({
        data: { clientId, type: 'INCIDENT', summary: `Incident logged — ${category} (${severity})`, author: session.email },
      });
    } catch { /* non-fatal */ }
    const { logAudit } = await import('@/lib/audit');
    // Keep injury/clinical free-text OUT of the audit summary (mirrors medical-flag).
    await logAudit({ action: 'INCIDENT_LOGGED', actor: session.email, actorRole: session.role, clientId, bookingId, summary: `Incident logged — ${category}`, meta: { incidentId: incident.id, severity, riddorReportable: Boolean(b.riddorReportable) } });
    return NextResponse.json({ ok: true, id: incident.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Could not save the incident.' }, { status: 500 });
  }
}
