import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { encClinical } from '@/lib/clinical-crypto';

export const runtime = 'nodejs';

// BLD-760 — Internal Incident (Accident) report. Staff-only: this route lives
// under /api/admin and is NEVER reachable from the client portal. Both verbs
// require an authenticated admin session AND the existing `clients.edit`
// permission (front desk can log a slip/trip they witnessed; no new permission
// key is introduced). The injury/description free-text is encrypted at rest with
// encClinical (the same helper as clinical notes) and never appears in an audit
// summary or on the client timeline — only the non-sensitive classification does.

const CATEGORIES = ['slip_trip', 'adverse_reaction', 'equipment', 'other'];
const SEVERITIES = ['minor', 'moderate', 'serious'];

// GET — list incidents for a client (?clientId=...), newest first.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'clients.edit')) {
    return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  }

  const clientId = new URL(req.url).searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const { decClinical } = await import('@/lib/clinical-crypto');
  const rows = await db.incident.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take: 100 });
  const incidents = rows.map((r) => {
    let detail: { description?: string; injury?: string; actionTaken?: string; witnesses?: string } = {};
    try { detail = JSON.parse(decClinical(r.descriptionEnc) || '{}'); } catch { /* leave blank if undecryptable */ }
    return {
      id: r.id,
      bookingId: r.bookingId,
      category: r.category,
      severity: r.severity,
      location: r.location,
      riddorReportable: r.riddorReportable,
      loggedBy: r.loggedBy,
      createdAt: r.createdAt.toISOString(),
      description: detail.description || '',
      injury: detail.injury || '',
      actionTaken: detail.actionTaken || '',
      witnesses: detail.witnesses || '',
    };
  });
  return NextResponse.json({ ok: true, incidents });
}

// POST — log a new incident against a client (and optionally a booking).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'clients.edit')) {
    return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const clientId = str(body.clientId);
  const bookingIdIn = str(body.bookingId) || null;
  const category = str(body.category);
  const severity = str(body.severity);
  const location = str(body.location).slice(0, 200) || null;
  const description = str(body.description);
  const injury = str(body.injury);
  const actionTaken = str(body.actionTaken);
  const witnesses = str(body.witnesses);
  const riddorReportable = body.riddorReportable === true;

  if (!clientId) return NextResponse.json({ ok: false, error: 'Missing client.' }, { status: 400 });
  if (!CATEGORIES.includes(category)) return NextResponse.json({ ok: false, error: 'Choose what kind of incident it was.' }, { status: 422 });
  if (!SEVERITIES.includes(severity)) return NextResponse.json({ ok: false, error: 'Choose how serious it was.' }, { status: 422 });
  if (!description) return NextResponse.json({ ok: false, error: 'Describe what happened.' }, { status: 422 });

  const { db } = await import('@/lib/db');

  // The client must exist; a supplied booking must belong to that same client
  // (so an incident can't be mis-linked to another client's appointment).
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ ok: false, error: 'Client not found.' }, { status: 404 });
  let bookingId: string | null = null;
  if (bookingIdIn) {
    const bk = await db.booking.findUnique({ where: { id: bookingIdIn }, select: { clientId: true } });
    if (bk && bk.clientId === clientId) bookingId = bookingIdIn;
  }

  // Encrypt the health/injury free-text as a single JSON blob — never plaintext.
  const descriptionEnc = encClinical(JSON.stringify({ description, injury, actionTaken, witnesses }));

  const incident = await db.incident.create({
    data: {
      clientId,
      bookingId,
      category,
      severity,
      location,
      descriptionEnc,
      riddorReportable,
      loggedBy: session!.email,
    },
    select: { id: true },
  });

  // Treatment-history marker — a NON-sensitive line on the client's timeline so
  // the incident is visible in their history. The injury detail stays only in
  // the encrypted incident record above; the timeline text carries none of it.
  try {
    await db.interaction.create({
      data: {
        clientId,
        type: 'APPOINTMENT',
        summary: 'Incident report logged',
        author: session!.email,
      },
    });
  } catch { /* timeline marker is best-effort — never block the incident write */ }

  // Audit — the summary carries NO clinical free-text (audit logs are broadly
  // readable + long-retained). Only the action + non-sensitive classification.
  try {
    const { logAudit } = await import('@/lib/audit');
    await logAudit({
      action: 'INCIDENT_LOGGED',
      actor: session!.email,
      actorRole: session!.role,
      clientId,
      bookingId,
      summary: `Incident logged for client · ${category} · ${severity}${riddorReportable ? ' · RIDDOR' : ''}`,
    });
  } catch { /* audit is best-effort */ }

  return NextResponse.json({ ok: true, id: incident.id });
}
