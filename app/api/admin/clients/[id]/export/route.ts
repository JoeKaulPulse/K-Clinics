import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Subject Access Request export — a full JSON of a client's record per Art.15
// GDPR (right to know what data is held). Clinical (encrypted health) data is
// only included for staff who hold the revocable clients.clinical.view permission.
// (BLD-315: broadened to include all data categories the erasure path covers.)
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
      consultations: { include: { notes: true } },
      interactions: true,
      appointments: true,
      bookings: true,
      emails: true,
      discountClaims: true,
      tasks: true,
      // Data categories confirmed by the erasure path (Art.15 parity with Art.17).
      followUps: true,
      aiAnalyses: { select: { id: true, status: true, areas: true, summary: true, createdAt: true } },
      reviews: { select: { id: true, rating: true, body: true, status: true, createdAt: true } },
      npsResponses: { select: { id: true, score: true, comment: true, createdAt: true } },
      waitlist: { select: { id: true, treatmentTitle: true, fromDate: true, toDate: true, status: true, createdAt: true } },
      referralsMade: { select: { id: true, code: true, status: true, rewardPence: true, createdAt: true } },
      referredVia: { select: { id: true, code: true, createdAt: true } },
      callRecords: { select: { id: true, direction: true, duration: true, callerNumber: true, answeredAt: true, endedAt: true } },
      points: { select: { id: true, balance: true, updatedAt: true } },
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

  // Clinical data: gated on the revocable clients.clinical.view permission (not
  // just role) so that permission revocation immediately blocks access. (BLD-315)
  if (sessionCan(session, 'clients.clinical.view')) {
    const assessments = await db.healthAssessment.findMany({ where: { clientId: id }, orderBy: { submittedAt: 'desc' } });
    const { formatAssessment } = await import('@/lib/health-assessments');
    out.healthAssessments = await Promise.all(assessments.map((a) => formatAssessment(a.id)));

    // Signed consent records (encrypted cipher holds signature + body).
    out.signedConsents = await db.signedConsent.findMany({
      where: { clientId: id },
      select: { id: true, templateKey: true, title: true, kind: true, declined: true, signerName: true, signedAt: true },
    });

    // Before-photos (encrypted image data excluded from export — referenced by id).
    out.beforePhotos = await db.beforePhoto.findMany({
      where: { clientId: id },
      select: { id: true, area: true, capturedBy: true, attestation: true, createdAt: true },
    });
  }

  // Chat conversations linked to this client.
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
