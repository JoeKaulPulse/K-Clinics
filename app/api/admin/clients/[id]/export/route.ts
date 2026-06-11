import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Subject Access Request export — a full JSON of a client's record. Clinical
// (encrypted health) data is only included for staff who may view it.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { id } = await params;
  const { getSession, sessionCan, canViewClinical } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'clients.export')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { db } = await import('@/lib/db');
  const c = await db.client.findUnique({
    where: { id },
    include: {
      consultations: true, interactions: true, appointments: true, bookings: true,
      emails: true, discountClaims: true, tasks: true,
    },
  });
  if (!c) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

  // Decrypt the at-rest clinical/contact free-text so the subject's export is
  // readable (tolerant of legacy plaintext).
  const { decClinical } = await import('@/lib/clinical-crypto');
  c.medicalFlag = decClinical(c.medicalFlag);
  c.allergies = decClinical(c.allergies);
  for (const con of c.consultations) { con.concerns = decClinical(con.concerns); con.message = decClinical(con.message); con.medicalNotes = decClinical(con.medicalNotes); }
  for (const bk of c.bookings) { bk.allergyNote = decClinical(bk.allergyNote); }
  for (const it of c.interactions) { it.detail = decClinical(it.detail); }

  // Strip secrets from the dump.
  const { passwordHash, resetTokenHash, resetTokenExp, ...client } = c as Record<string, unknown> & { passwordHash?: unknown; resetTokenHash?: unknown; resetTokenExp?: unknown };
  void passwordHash; void resetTokenHash; void resetTokenExp;

  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), exportedBy: session!.email, client };

  if (canViewClinical(session!.role)) {
    const assessments = await db.healthAssessment.findMany({ where: { clientId: id }, orderBy: { submittedAt: 'desc' } });
    const { formatAssessment } = await import('@/lib/health-assessments');
    out.healthAssessments = await Promise.all(assessments.map((a) => formatAssessment(a.id)));
  }

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'ASSESSMENT_VIEWED', actor: session!.email, actorRole: session!.role, clientId: id, summary: 'Client data exported (SAR)' });

  const name = [c.firstName, c.lastName].filter(Boolean).join('-').toLowerCase() || 'client';
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="kclinics-${name}-${id}.json"`,
    },
  });
}
