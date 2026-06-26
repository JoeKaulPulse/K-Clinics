'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, canViewClinical } from '@/lib/auth';
import { marketingConsentFields } from '@/lib/consent';
import { encClinical } from '@/lib/clinical-crypto';
import { Prisma } from '@prisma/client';

const NOTE_TYPES = ['NOTE', 'CLINICAL', 'COMPLAINT', 'FOLLOW_UP', 'CALL'] as const;

export async function addNote(clientId: string, summary: string, type: string = 'NOTE', detail?: string, pinned?: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled || !summary.trim()) return { ok: false, error: 'Nothing to save.' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.edit')) return { ok: false, error: 'You don’t have permission to add notes.' };
  const t = (NOTE_TYPES as readonly string[]).includes(type) ? type : 'NOTE';
  // Clinical notes are restricted to clinical staff.
  if (t === 'CLINICAL' && !canViewClinical(session.role)) return { ok: false, error: 'Clinical notes are restricted to clinical staff.' };
  const { db } = await import('@/lib/db');
  const note = await db.interaction.create({
    data: { clientId, type: t as never, summary: summary.trim(), detail: detail?.trim() ? encClinical(detail.trim()) : null, author: session.email, pinned: Boolean(pinned) },
  });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'NOTE_ADDED', actor: session.email, actorRole: session.role, clientId, summary: `${t.toLowerCase()} note added`, meta: { noteId: note.id } });
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

// GDPR right-to-erasure — pseudonymise a client's personal data while keeping
// financial/audit records intact for legal retention. Requires clients.delete.
export async function eraseClientData(clientId: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.delete')) return { ok: false, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  // Fetch before erasing — purchaserEmail is a plain string (no FK), so we
  // need the current email to match GiftVouchers the client purchased.
  const client = await db.client.findUnique({ where: { id: clientId }, select: { email: true } });
  if (!client) return { ok: false, error: 'Not found.' };
  const erasedEmail = `erased-${clientId}@redacted.invalid`;
  // Art. 17 erasure across ALL personal/special-category data, atomically. We
  // pseudonymise the Client row + strip clinical free-text from RETAINED
  // financial records (bookings/consultations kept for HMRC/lawful retention,
  // but with no identifying or health content), and hard-delete the child records
  // that have no retention basis (health assessments, before-photos, AI analyses,
  // signed consents, reviews, NPS/follow-up comments, email metadata, free-text
  // interactions). Previously only the Client row + interactions were touched, so
  // the person stayed fully re-identifiable with their medical history on file.
  await db.$transaction([
    db.client.update({
      where: { id: clientId },
      data: {
        firstName: 'Erased', lastName: null, email: erasedEmail,
        phone: null, dob: null, notes: null, allergies: null, medicalFlag: null, medicalFlagSetBy: null, medicalFlagAt: null,
        marketingOptIn: false, unsubscribed: true, portalActive: false, passwordHash: null,
        resetTokenHash: null, resetTokenExp: null,
      },
    }),
    // Retain bookings/consultations (financial/clinical-audit basis) but strip the
    // identifying + special-category free-text from them.
    db.booking.updateMany({ where: { clientId }, data: { notes: null, allergyNote: null, cancelReason: null, clinicalNoteEnc: null, clinicalNoteBy: null, clinicalNoteAt: null } }),
    db.consultation.updateMany({ where: { clientId }, data: { concerns: null, message: null, medicalNotes: null } }),
    // Consultation rows are retained (clinical-audit basis) but their staff team-notes
    // (ConsultationNote.body — free-text, can hold personal/clinical detail) have no
    // retention basis and are keyed via the consultation, so the Client-cascade never
    // reaches them. Delete them explicitly for a complete Art. 17 erasure.
    db.consultationNote.deleteMany({ where: { consultation: { clientId } } }),
    // Hard-delete the records that exist only to serve the data subject.
    db.interaction.deleteMany({ where: { clientId } }),
    db.healthAssessment.deleteMany({ where: { clientId } }),
    db.beforePhoto.deleteMany({ where: { clientId } }),
    db.aiAnalysis.deleteMany({ where: { clientId } }),
    db.signedConsent.deleteMany({ where: { clientId } }),
    db.review.deleteMany({ where: { clientId } }),
    db.npsResponse.deleteMany({ where: { clientId } }),
    db.followUp.deleteMany({ where: { clientId } }),
    db.emailEvent.deleteMany({ where: { clientId } }),
    // BLD-152: AppointmentSession stores session answers (aftercare_confirmed_by
    // contains the client's typed name; startedBy stores staff email). Must be
    // erased under Art. 17 — no financial retention basis for the session data.
    db.appointmentSession.deleteMany({ where: { booking: { clientId } } }),
    // BLD-127: scrub call recordings/transcripts/raw payload for this client.
    db.callRecord.updateMany({ where: { matchedClientId: clientId }, data: { transcript: null, recordingUrl: null, raw: Prisma.DbNull, transcriptStatus: 'unavailable' } }),
    // BLD-286: broaden Art. 17 to non-special-category personal-data tables.
    // Referrals made by this client (referrer PII) — hard-delete; the reward
    // history has no stand-alone retention basis once the referrer is erased.
    db.referral.deleteMany({ where: { referrerId: clientId } }),
    // Referral rows where THIS client is the referred person — null the FK and
    // the captured email so the referrer's record becomes non-identifying.
    db.referral.updateMany({ where: { referredId: clientId }, data: { referredId: null, referredEmail: null } }),
    // Chat conversations initiated by this client (free text, contact details).
    // ChatMessage rows cascade on ChatConversation delete.
    db.chatConversation.deleteMany({ where: { clientId } }),
    // Waitlist entries (treatment window, contact details) — no retention basis.
    db.waitlistEntry.deleteMany({ where: { clientId } }),
    // Legacy Appointment model (pre-Booking era) — status/schedule data only,
    // no financial retention basis, safe to hard-delete.
    db.appointment.deleteMany({ where: { clientId } }),
    // Null fingerprint fields in DiscountClaim — re-identifiable without retention basis.
    db.discountClaim.updateMany({ where: { clientId }, data: { emailNorm: 'erased', phoneNorm: null, nameDobKey: null } }),
    // Strip PII from retail Orders (email/name/phone/address) — keep order number
    // and amounts for Xero/HMRC basis. Order.clientId is a nullable String set at
    // checkout (no formal FK relation), so we match on it directly.
    db.order.updateMany({ where: { clientId }, data: { name: 'Erased', email: erasedEmail, phone: null, shipName: null, shipLine1: null, shipLine2: null, shipCity: null, shipPostcode: null } }),
    // GiftVouchers claimed by this client — strip purchaser + recipient PII.
    db.giftVoucher.updateMany({ where: { claimedByClientId: clientId }, data: { purchaserName: 'Erased', purchaserEmail: erasedEmail, recipientName: null, recipientEmail: null, message: null, shipName: null, shipLine1: null, shipLine2: null, shipCity: null, shipPostcode: null } }),
    // GiftVouchers purchased by this client (email-matched; no purchaserClientId FK).
    db.giftVoucher.updateMany({ where: { purchaserEmail: client.email }, data: { purchaserName: 'Erased', purchaserEmail: erasedEmail } }),
    // PromoRedemption — null the captured email (BLD-315 residual: SAR exports it
    // but erasure previously did not remove it). Also match the guest-redemption
    // case (clientId null, email captured at checkout — see lib/promo.ts
    // redeemPromo), mirroring the email-matched GiftVoucher erasure above so an
    // unauthenticated redemption by this person is erased too (BLD-366).
    db.promoRedemption.updateMany({ where: { clientId }, data: { email: null } }),
    db.promoRedemption.updateMany({ where: { email: client.email.toLowerCase() }, data: { email: null } }),
    // BLD-671: remove NewsletterSubscriber rows by email — no retention basis post-erasure.
    db.newsletterSubscriber.deleteMany({ where: { email: client.email.toLowerCase() } }),
  ]);
  await logAudit({ action: 'CLIENT_ERASED', actor: session.email, actorRole: session.role, clientId, summary: 'Client personal + special-category data erased across all records (GDPR right-to-erasure)' });
  try {
    const { notifyStaffByPermission } = await import('@/lib/notifications');
    await notifyStaffByPermission('settings.manage', { kind: 'status', category: 'system', priority: 'high', title: 'Client data erased (GDPR)', body: `Right-to-erasure completed by ${session.email.split('@')[0]}`, href: '/admin/clients' }, session.email);
  } catch { /* non-fatal */ }
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

/** Permanently delete a client and ALL related records (irreversible).
 *  Guard-railed: requires the `clients.delete` permission AND a typed "DELETE"
 *  confirmation. The audit entry survives (AuditEvent.clientId is not an FK). */
export async function deleteClient(clientId: string, confirm: string) {
  if (!crmEnabled) return { ok: false, error: 'Unavailable.' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.delete')) return { ok: false, error: 'Not permitted.' };
  if (confirm !== 'DELETE') return { ok: false, error: 'Type DELETE to confirm.' };

  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');

  const c = await db.client.findUnique({ where: { id: clientId }, select: { firstName: true, lastName: true, email: true } });
  if (!c) return { ok: false, error: 'Client not found.' };

  try {
    // Cascades to the client's bookings, assessments, points, reviews, etc.
    await db.client.delete({ where: { id: clientId } });
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || 'Could not delete this client.' };
  }

  // Log AFTER deletion so the record persists; no personal data in the summary.
  await logAudit({
    action: 'CLIENT_DELETED',
    actor: session.email,
    actorRole: session.role,
    clientId,
    summary: 'Client permanently deleted (right to erasure)',
    meta: { email: c.email },
  });
  revalidatePath('/admin/clients');
  return { ok: true };
}

// BLD-314 Phase 3: GDPR Art.17 erasure for academy trainees. Requires
// settings.manage (admin-level). Pseudonymises the student row and hard-deletes
// the records that have no retention basis (passkeys, progress tokens).
// Enrolment rows are retained pseudonymously (certification verification basis).
export async function eraseStudentData(studentId: string) {
  if (!crmEnabled) return { ok: false };
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) return { ok: false, error: 'Not permitted.' };
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  const student = await db.academyStudent.findUnique({ where: { id: studentId }, select: { email: true } });
  if (!student) return { ok: false, error: 'Student not found.' };
  await db.$transaction([
    db.academyStudent.update({
      where: { id: studentId },
      data: {
        firstName: 'Erased', lastName: null, email: `erased-${studentId}@redacted.invalid`,
        phone: null, dob: null, portalActive: false, passwordHash: null,
        resetTokenHash: null, resetTokenExp: null,
      },
    }),
    // Remove authentication credentials — no retention basis.
    db.studentPasskey.deleteMany({ where: { studentId } }),
  ]);
  await logAudit({ action: 'NOTE_ADDED', actor: session.email, actorRole: session.role, summary: `Academy student ${student.email} data erased (GDPR Art.17)` });
  revalidatePath('/admin/academy');
  return { ok: true };
}

export async function togglePinNote(noteId: string, clientId: string, pinned: boolean) {
  if (!crmEnabled) return;
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.edit')) return;
  const { db } = await import('@/lib/db');
  await db.interaction.update({ where: { id: noteId }, data: { pinned } });
  revalidatePath(`/admin/clients/${clientId}`);
}

const CONSULT_STATUSES = ['NEW', 'CONTACTED', 'BOOKED', 'COMPLETED', 'CLOSED'];

export async function setConsultStatus(consultId: string, clientId: string, status: string): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled) return { ok: false, error: 'Unavailable.' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'consultations.manage')) return { ok: false, error: 'You don’t have permission to change consultation status.' };
  if (!CONSULT_STATUSES.includes(status)) return { ok: false, error: 'Invalid status.' };
  const { db } = await import('@/lib/db');
  try {
    await db.consultation.update({ where: { id: consultId }, data: { status: status as never } });
  } catch {
    return { ok: false, error: 'Could not update the consultation.' };
  }
  await db.interaction.create({
    data: { clientId, type: 'SYSTEM', summary: `Status changed to ${status}`, author: session.email },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath('/admin/consultations');
  return { ok: true };
}

export async function sendManualEmail(clientId: string, to: string, subject: string, body: string) {
  if (!crmEnabled || !subject.trim() || !body.trim()) return { ok: false, error: 'Subject and body required' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.edit')) return { ok: false, error: 'You don’t have permission to email clients.' };
  const { db } = await import('@/lib/db');
  const { sendEmail, tmplManual } = await import('@/lib/email');

  const client = await db.client.findUnique({ where: { id: clientId } });
  const unsubUrl = client ? `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/unsubscribe?t=${client.unsubToken}` : undefined;

  const res = await sendEmail({ to, subject, html: tmplManual(body.replace(/\n/g, '<br>'), unsubUrl) });
  await db.emailEvent.create({
    data: { clientId, kind: 'MANUAL', to, subject, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error },
  });
  if (res.ok) {
    await db.interaction.create({ data: { clientId, type: 'EMAIL', summary: `Email sent: ${subject}`, author: session.email } });
  }
  revalidatePath(`/admin/clients/${clientId}`);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

// BLD-527: email a client a passwordless login link. Manually-created clients
// have no password, so they can neither sign in nor use "forgot password" (which
// only emails accounts that already have one). This issues an activation token and
// emails the /account/activate link, which signs them in and lets them set a
// password later. Works for password-holders too (a magic sign-in link).
export async function sendPortalInvite(clientId: string) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.edit')) return { ok: false, error: 'You don’t have permission to manage client accounts.' };
  const { db } = await import('@/lib/db');
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, email: true, firstName: true } });
  if (!client) return { ok: false, error: 'Client not found.' };
  if (!client.email) return { ok: false, error: 'This client has no email address on file.' };

  const { createAccountInvite } = await import('@/lib/client-auth');
  const token = await createAccountInvite(clientId);
  if (!token) return { ok: false, error: 'Could not create the login link. Please try again.' };
  const base = process.env.NEXT_PUBLIC_SITE_URL || '';
  const url = `${base}/account/activate?token=${token}&id=${clientId}`;

  const { sendEmail, tmplPortalInvite } = await import('@/lib/email');
  const subject = 'Open your KClinics account';
  const res = await sendEmail({ to: client.email, subject, html: tmplPortalInvite(client.firstName, url) });
  await db.emailEvent.create({
    data: { clientId, kind: 'MANUAL', to: client.email, subject, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error },
  });
  if (res.ok) {
    await db.interaction.create({ data: { clientId, type: 'EMAIL', summary: 'Portal login link sent', author: session.email } });
  }
  revalidatePath(`/admin/clients/${clientId}`);
  return res.ok ? { ok: true } : { ok: false, error: res.error || 'The email could not be sent (check the email provider is configured).' };
}

export async function toggleMarketing(clientId: string, optIn: boolean) {
  if (!crmEnabled) return;
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.edit')) return;
  const { db } = await import('@/lib/db');
  // Evidence the affirmative opt-in (who/when/version); clear the timestamp on opt-out.
  await db.client.update({ where: { id: clientId }, data: { marketingOptIn: optIn, unsubscribed: optIn ? false : undefined, ...(optIn ? marketingConsentFields('admin') : { marketingConsentAt: null }) } });
  revalidatePath(`/admin/clients/${clientId}`);
}
