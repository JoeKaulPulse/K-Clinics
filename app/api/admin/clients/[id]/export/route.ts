import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Subject Access Request export — a full JSON of a client's record (Art. 15
// UK GDPR). Clinical (encrypted health) data is only included for staff who
// hold the revocable clients.clinical.view permission (BLD-315).
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
      // BLD-315: previously omitted data-subject records now included.
      aiAnalyses: { include: { images: true } },
      followUps: true,
      reviews: true,
      npsResponses: true,
      waitlist: true,
      referralsMade: true,
      callRecords: { select: { id: true, direction: true, duration: true, callerNumber: true, answeredAt: true, endedAt: true, transcript: true, createdAt: true } },
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

  // BLD-315: use the revocable permission, not the role-based canViewClinical.
  const canSeeClinical = sessionCan(session, 'clients.clinical.view');
  if (canSeeClinical) {
    const assessments = await db.healthAssessment.findMany({ where: { clientId: id }, orderBy: { submittedAt: 'desc' } });
    const { formatAssessment } = await import('@/lib/health-assessments');
    out.healthAssessments = await Promise.all(assessments.map((a) => formatAssessment(a.id)));
  }

  // BLD-315: signed consents and before-photos are clinical records not declared
  // as Client relations in the schema; query them separately.
  const [signedConsents, beforePhotos, chatConversations, shopOrders] = await Promise.all([
    canSeeClinical
      ? db.signedConsent.findMany({ where: { clientId: id }, orderBy: { signedAt: 'desc' } })
      : Promise.resolve([] as unknown[]),
    canSeeClinical
      ? db.beforePhoto.findMany({ where: { clientId: id }, select: { id: true, area: true, capturedBy: true, createdAt: true } })
      : Promise.resolve([] as unknown[]),
    db.chatConversation.findMany({ where: { clientId: id }, orderBy: { updatedAt: 'desc' } }),
    db.order.findMany({ where: { clientId: id }, include: { items: true }, orderBy: { createdAt: 'desc' } }),
  ]);
  out.signedConsents = signedConsents;
  out.beforePhotos = beforePhotos;
  out.chatConversations = chatConversations;
  out.shopOrders = shopOrders;

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'DATA_EXPORTED', actor: session!.email, actorRole: session!.role, clientId: id, summary: 'Client data exported (SAR — Art. 15 UK GDPR)' });

  const name = [c.firstName, c.lastName].filter(Boolean).join('-').toLowerCase() || 'client';
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="kclinics-${name}-${id}.json"`,
    },
  });
}
