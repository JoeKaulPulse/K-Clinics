import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { encClinical } from '@/lib/clinical-crypto';

export const runtime = 'nodejs';

// Set or clear a client's concise clinical safety flag. Requires clinical access
// (clients.clinical.view implies the clinician sees health data) AND edit rights.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'clients.clinical.view') || !sessionCan(session, 'clients.edit')) {
    return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  }

  const { clientId, flag } = (await req.json().catch(() => ({}))) as { clientId?: string; flag?: string };
  if (!clientId) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });

  const value = (flag || '').trim();
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');

  await db.client.update({
    where: { id: clientId },
    data: {
      medicalFlag: value ? encClinical(value) : null,
      medicalFlagSetBy: value ? session!.email : null,
      medicalFlagAt: value ? new Date() : null,
    },
  });
  await logAudit({
    action: 'MEDICAL_FLAG_REVIEWED',
    actor: session!.email,
    actorRole: session!.role,
    clientId,
    // Never copy the flag's clinical free-text into the audit summary (audit
    // logs are broadly readable + long-retained) — record only the action.
    summary: value ? 'Medical flag set' : 'Medical flag cleared',
  });
  return NextResponse.json({ ok: true });
}
