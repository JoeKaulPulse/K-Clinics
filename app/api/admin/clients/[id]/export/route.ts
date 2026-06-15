import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Subject Access Request export — Art.15 GDPR. Includes every data category
// that the Art.17 erasure path covers (parity). Clinical data (health
// assessments, signed consents, before-photos, AI analysis findings) is only
// included for staff who hold the revocable clients.clinical.view permission.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { id } = await params;
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'clients.export')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { db } = await import('@/lib/db');
  const c = await db.client.findUnique({
    where: { id },
    include: {
      consultations: true, interactions: true, appointments: true, bookings: true,
      emails: true, discountClaims: true, tasks: true,
      // Art.15 parity additions (BLD-315):
      aiAnalyses: { select: { id: true, status: true, areas: true, summary: true, createdAt: true } },
      reviews: { select: { id: true, rating: true, body: true, status: true, createdAt: true } },
      npsResponses: { select: { id: true, score: true, comment: true, createdAt: true } },
      followUps: { select: { id: true, treatmentTitle: true, sentAt: true, respondedAt: true, sentiment: true, comment: true, createdAt: true } },
      waitlist: { select: { id: true, treatmentTitle: true, fromDate: true, toDate: true, status: true, createdAt: true } },
      callRecords: { select: { id: true, direction: true, durationSec: true, answeredAt: true, endedAt: true } },
      referralsMade: { select: { id: true, referredEmail: true, status: true, qualifiedAt: true, rewardedAt: true, createdAt: true } },
      referredVia: { select: { id: true, status: true, createdAt: true } },
      points: { select: { id: true, points: true, category: true, reason: true, createdAt: true } },
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

  // Clinical data: gated on revocable permission, not just role. (BLD-315)
  if (sessionCan(session, 'clients.clinical.view')) {
    const assessments = await db.healthAssessment.findMany({ where: { clientId: id }, orderBy: { submittedAt: 'desc' } });
    const { formatAssessment } = await import('@/lib/health-assessments');
    out.healthAssessments = await Promise.all(assessments.map((a) => formatAssessment(a.id)));

    // Signed consent records — metadata only (encrypted body/signature stays sealed).
    out.signedConsents = await db.signedConsent.findMany({
      where: { clientId: id },
      select: { id: true, templateKey: true, title: true, kind: true, declined: true, signerName: true, signedAt: true },
    });

    // Before-photos — metadata only (encrypted image data excluded from export).
    out.beforePhotos = await db.beforePhoto.findMany({
      where: { clientId: id },
      select: { id: true, area: true, capturedBy: true, attestation: true, createdAt: true },
    });
  }

  // Chat conversations linked to this client (any role with export permission).
  out.chatConversations = await db.chatConversation.findMany({
    where: { clientId: id },
    select: { id: true, status: true, mode: true, createdAt: true, messages: { select: { id: true, body: true, sender: true, createdAt: true } } },
  });

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'DATA_EXPORTED', actor: session!.email, actorRole: session!.role, clientId: id, summary: 'Client data exported (SAR / Art.15)' });

  const name = [c.firstName, c.lastName].filter(Boolean).join('-').toLowerCase() || 'client';
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="kclinics-${name}-${id}.json"`,
    },
  });
}
