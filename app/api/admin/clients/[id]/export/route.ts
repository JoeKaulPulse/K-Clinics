import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Subject Access Request export — a full JSON of a client's record (Art. 15
// UK GDPR). Clinical (encrypted health) data is only included for staff who
// hold the revocable clients.clinical.view permission (BLD-315).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { id } = await params;
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'clients.export')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  // BLD-1134: match the sibling export endpoints (account 5/hr, admin bulk 6/hr) —
  // without a limit a compromised staff session could script-loop client IDs and
  // bulk-exfiltrate health records. 30/hr leaves room for a busy front desk.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'admin-sar-export', 30, 3600, 'admin'))) {
    return NextResponse.json({ ok: false, error: 'Too many exports. Please try again later.' }, { status: 429 });
  }

  const { db } = await import('@/lib/db');
  const c = await db.client.findUnique({
    where: { id },
    include: {
      // BLD-866: staff notes on a consultation are part of the subject's record
      // (Art. 15) — they were silently missing from every export.
      consultations: { include: { notes: true } }, interactions: true, appointments: true, bookings: true,
      emails: true, discountClaims: true, tasks: true,
      // BLD-315: previously omitted data-subject records now included.
      aiAnalyses: { include: { images: true } },
      followUps: true,
      reviews: true,
      npsResponses: true,
      waitlist: true,
      referralsMade: true,
      points: true, // loyalty ledger — the subject's own points history (BLD-315)
      callRecords: { select: { id: true, direction: true, durationSec: true, fromNumber: true, toNumber: true, answeredAt: true, endedAt: true, transcript: true, createdAt: true } },
    },
  });
  if (!c) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

  // BLD-866: clinical (health) free-text is only DECRYPTED for staff who hold
  // the revocable clients.clinical.view permission — clients.export alone gets
  // the record with the clinical fields withheld (null), matching the gating
  // the client profile and SAR photo/assessment sections already apply. This
  // also covers call transcripts (BLD-701: health free-text) — previously all
  // of it was decrypted for any exporter.
  const clinical = sessionCan(session, 'clients.clinical.view');
  const { decClinical } = await import('@/lib/clinical-crypto');
  const { decryptJson } = await import('@/lib/crypto');
  for (const con of c.consultations) { con.message = decClinical(con.message); }
  if (clinical) {
    c.medicalFlag = decClinical(c.medicalFlag);
    c.allergies = decClinical(c.allergies);
    // BLD-913: team-note bodies are encrypted at rest; staff notes can hold
    // clinical detail, so they follow the clinical gate like medicalNotes.
    for (const con of c.consultations) { con.concerns = decClinical(con.concerns); con.medicalNotes = decClinical(con.medicalNotes); for (const n of con.notes) n.body = decClinical(n.body) ?? ''; }
    for (const bk of c.bookings) { bk.allergyNote = decClinical(bk.allergyNote); }
    for (const it of c.interactions) { it.detail = decClinical(it.detail); }
    for (const cr of c.callRecords) { cr.transcript = decClinical(cr.transcript); } // BLD-602: encrypted at rest
    // PRJ-1060.10: the follow-up concern text is now encrypted at rest in BOTH
    // places it lands — Task.detail (clinical: true) and the client's own
    // FollowUp.comment. Decrypt for the readable record; never ship ciphertext.
    for (const tk of c.tasks) { tk.detail = tk.clinical ? decClinical(tk.detail) : tk.detail; }
    for (const fu of c.followUps) { fu.comment = decClinical(fu.comment); }
  } else {
    c.medicalFlag = null;
    c.allergies = null;
    for (const con of c.consultations) { con.concerns = null; con.medicalNotes = null; for (const n of con.notes) n.body = ''; }
    for (const bk of c.bookings) { bk.allergyNote = null; }
    // Non-clinical interaction notes stay readable; CLINICAL entries are withheld.
    for (const it of c.interactions) { it.detail = it.type === 'CLINICAL' ? null : decClinical(it.detail); }
    for (const cr of c.callRecords) { cr.transcript = null; }
    // PRJ-1060.10: same gate the Tasks board applies — a follow-up-concern task
    // (clinical: true) and a follow-up response that flagged a concern hold
    // health free-text, so they are withheld; ordinary ones stay readable.
    for (const tk of c.tasks) { if (tk.clinical) tk.detail = null; }
    for (const fu of c.followUps) { fu.comment = fu.concern ? null : decClinical(fu.comment); }
  }
  // BLD-866: the in-appointment clinical note (Booking.clinicalNoteEnc) was
  // exported as raw ciphertext — useless to the subject and omitted from the
  // readable record. Decrypt it under the clinical gate; never ship the cipher.
  for (const bk of c.bookings) {
    const rec = bk as Record<string, unknown>;
    let note: string | null = null;
    if (clinical && bk.clinicalNoteEnc) { try { note = decryptJson<{ note: string }>(bk.clinicalNoteEnc).note; } catch { /* skip corrupt cipher */ } }
    rec.clinicalNote = note;
    delete rec.clinicalNoteEnc;
  }

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

  // PRJ-1032.16: the subject's own incident/accident records are their personal +
  // special-category data (Art. 15) — include them, decrypting the health
  // free-text only under the clinical gate (metadata always; content when clinical).
  const incidents = await db.incident.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' } });
  out.incidents = incidents.map((inc) => {
    const base = { id: inc.id, bookingId: inc.bookingId, category: inc.category, severity: inc.severity, location: inc.location, riddorReportable: inc.riddorReportable, loggedBy: inc.loggedBy, createdAt: inc.createdAt };
    if (!clinical) return base;
    let detail: unknown = null;
    try { detail = JSON.parse(decClinical(inc.descriptionEnc) || '{}'); } catch { /* corrupt/redacted cipher → no detail */ }
    return { ...base, detail };
  });

  // BLD-315: use the revocable permission, not the role-based canViewClinical.
  if (clinical) {
    const assessments = await db.healthAssessment.findMany({ where: { clientId: id }, orderBy: { submittedAt: 'desc' } });
    const { formatAssessment } = await import('@/lib/health-assessments');
    const exportAudit = { actor: session?.email || 'unknown', actorRole: session?.role ?? undefined };
    out.healthAssessments = await Promise.all(assessments.map((a) => formatAssessment(a.id, exportAudit)));

    // BLD-367 (Art. 15): attach the decrypted before-photo image to each record,
    // not just its metadata. Same decryption path as the authenticated serve
    // route, gated on the same clinical permission. One bad cipher must not fail
    // the whole export.
    const ciphers = await db.beforePhoto.findMany({ where: { clientId: id }, select: { id: true, dataEnc: true } });
    const imageById = new Map(ciphers.map((p) => {
      let image: string | null = null;
      try { image = decryptJson<string>(p.dataEnc); } catch { /* skip corrupt cipher */ }
      return [p.id, image] as const;
    }));
    out.beforePhotos = beforePhotos.map((p) => ({ ...p, image: imageById.get(p.id) ?? null }));
  } else {
    // BLD-866: make the withholding explicit in the file, so nobody treats a
    // non-clinical export as the complete Art. 15 record.
    out.clinicalDataWithheld = 'Clinical fields (medical flag, allergies, consultation concerns/medical notes, clinical notes, call transcripts, health assessments, before photos, follow-up concern text and the tasks raised from it) are withheld — the exporting account lacks clinical access. Ask a clinical-access holder to run the export for the complete record.';
  }

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'DATA_EXPORTED', actor: session!.email, actorRole: session!.role, clientId: id, summary: `Client data exported (SAR — Art. 15 UK GDPR)${clinical ? '' : ' — clinical fields withheld (no clinical access)'}` });

  const name = [c.firstName, c.lastName].filter(Boolean).join('-').toLowerCase() || 'client';
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="kclinics-${name}-${id}.json"`,
    },
  });
}
