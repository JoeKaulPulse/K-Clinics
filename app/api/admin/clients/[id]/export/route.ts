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
      points: true, // loyalty ledger — the subject's own points history (BLD-315)
      // BLD-701: transcripts are clinical data — fetch without transcript here; added under clinical gate below.
      callRecords: { select: { id: true, direction: true, duration: true, callerNumber: true, answeredAt: true, endedAt: true, createdAt: true } },
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
  // BLD-701: transcripts are clinical data; decryption happens under the clinical gate below.

  // Strip secrets from the dump.
  const { passwordHash, resetTokenHash, resetTokenExp, ...client } = c as Record<string, unknown> & { passwordHash?: unknown; resetTokenHash?: unknown; resetTokenExp?: unknown };
  void passwordHash; void resetTokenHash; void resetTokenExp;

  // Fetch records not declared as reverse-FK relations on Client (no include path). (BLD-315)
  const [signedConsents, beforePhotos, chatConversations, shopOrders, consentRequests, promoRedemptions] = await Promise.all([
    db.signedConsent.findMany({ where: { clientId: id } }),
    // Metadata only here; the decrypted image is added under the clinical gate below (BLD-367).
    db.beforePhoto.findMany({ where: { clientId: id }, select: { id: true, bookingId: true, area: true, capturedBy: true, attestation: true, createdAt: true } }),
    db.chatConversation.findMany({ where: { clientId: id }, include: { messages: true } }),
    db.order.findMany({ where: { clientId: id }, include: { items: true }, orderBy: { createdAt: 'desc' } }),
    db.consentRequest.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' } }),
    db.promoRedemption.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' } }),
  ]);

  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    exportedBy: session!.email,
    client,
    signedConsents,
    beforePhotos,
    chatConversations,
    shopOrders,
    consentRequests,
    promoRedemptions,
  };

  // BLD-315: use the revocable permission, not the role-based canViewClinical.
  if (sessionCan(session, 'clients.clinical.view')) {
    const assessments = await db.healthAssessment.findMany({ where: { clientId: id }, orderBy: { submittedAt: 'desc' } });
    const { formatAssessment } = await import('@/lib/health-assessments');
    const exportAudit = { actor: session?.email || 'unknown', actorRole: session?.role ?? undefined };
    out.healthAssessments = await Promise.all(assessments.map((a) => formatAssessment(a.id, exportAudit)));

    // BLD-701: include call transcripts for clinical-permissioned staff only.
    // Re-fetch with transcript selected and decrypt at-rest cipher.
    const callRecordsWithTranscript = await db.callRecord.findMany({
      where: { matchedClientId: id },
      select: { id: true, direction: true, durationSec: true, fromNumber: true, toNumber: true, answeredAt: true, endedAt: true, transcript: true, createdAt: true },
    });
    out.callRecords = callRecordsWithTranscript.map((cr) => ({ ...cr, transcript: decClinical(cr.transcript) }));

    // BLD-367 (Art. 15): attach the decrypted before-photo image to each record,
    // not just its metadata. Same decryption path as the authenticated serve
    // route, gated on the same clinical permission. One bad cipher must not fail
    // the whole export.
    const { decryptJson } = await import('@/lib/crypto');
    const ciphers = await db.beforePhoto.findMany({ where: { clientId: id }, select: { id: true, dataEnc: true } });
    const imageById = new Map(ciphers.map((p) => {
      let image: string | null = null;
      try { image = decryptJson<string>(p.dataEnc); } catch { /* skip corrupt cipher */ }
      return [p.id, image] as const;
    }));
    out.beforePhotos = beforePhotos.map((p) => ({ ...p, image: imageById.get(p.id) ?? null }));
  }

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
