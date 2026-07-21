import 'server-only';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword, createAcademySession, getAcademySession } from '@/lib/auth';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const hashesEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

// BLD-528: best-effort bridge to the clinic CRM. A trainee is often also a
// clinic client; link them by email so staff see both sides of the same person.
// Only fills an empty clientId (never overwrites an existing link).
async function linkClientByEmail(studentId: string, email: string): Promise<void> {
  try {
    const client = await db.client.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (client) await db.academyStudent.updateMany({ where: { id: studentId, clientId: null }, data: { clientId: client.id } });
  } catch { /* best-effort — never block account creation */ }
}

/** Staff/explicit re-link of a trainee to their clinic client record (by email). */
export async function linkStudentToClient(studentId: string): Promise<{ ok: boolean; linked: boolean }> {
  const s = await db.academyStudent.findUnique({ where: { id: studentId }, select: { email: true, clientId: true } });
  if (!s) return { ok: false, linked: false };
  if (s.clientId) return { ok: true, linked: true };
  await linkClientByEmail(studentId, s.email);
  const after = await db.academyStudent.findUnique({ where: { id: studentId }, select: { clientId: true } });
  return { ok: true, linked: !!after?.clientId };
}

export type AcademySignup = { firstName: string; lastName?: string; email: string; phone?: string; password: string; dob?: string };

/** Create a trainee (academy) account — separate from the clinic client portal. */
export async function signupStudent(input: AcademySignup): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!input.firstName?.trim() || !email || input.password.length < 8) return { ok: false, error: 'Please complete all fields (password 8+ characters).' };
  // Age gate: the academy accepts students aged 16 or over.
  const { meetsMinAge, MIN_STUDENT_AGE } = await import('@/lib/age');
  if (!input.dob || !meetsMinAge(input.dob, MIN_STUDENT_AGE)) return { ok: false, error: 'You must be 16 or over to join the academy.' };
  // findFirst (not findUnique) so the tenant scope is injected: email is globally
  // unique today but becomes per-tenant in Ring 1, and a unique `where` cannot be
  // tenant-scoped. (BLD-300)
  const existing = await db.academyStudent.findFirst({ where: { email }, select: { passwordHash: true } });
  if (existing?.passwordHash) return { ok: false, error: 'An account already exists for this email. Try signing in.' };

  const passwordHash = await hashPassword(input.password);
  const dob = new Date(input.dob);
  const { currentTenantId } = await import('@/lib/tenant');
  const tenantId = await currentTenantId();
  const student = await db.academyStudent.upsert({
    where: { tenantId_email: { tenantId, email } }, // per-tenant unique (Ring 1) — replaces the global email unique
    update: { firstName: input.firstName, lastName: input.lastName || undefined, phone: input.phone || undefined, dob, ageDeclaredAt: new Date(), passwordHash, portalActive: true },
    create: { tenantId, email, firstName: input.firstName, lastName: input.lastName || null, phone: input.phone || null, dob, ageDeclaredAt: new Date(), passwordHash, portalActive: true },
  });
  // Link any prior applications made with this email to the new account.
  await db.enrolment.updateMany({ where: { applicantEmail: email, studentId: null }, data: { studentId: student.id } }).catch(() => {});
  await linkClientByEmail(student.id, email);
  await createAcademySession({ sub: student.id, email: student.email, firstName: student.firstName, epoch: student.sessionEpoch });
  return { ok: true };
}

export async function loginStudent(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const student = await db.academyStudent.findFirst({ where: { email: email.trim().toLowerCase() }, select: { id: true, email: true, firstName: true, passwordHash: true, sessionEpoch: true } });
  if (!student?.passwordHash || !(await verifyPassword(password, student.passwordHash))) return { ok: false, error: 'Invalid email or password.' };
  await db.academyStudent.update({ where: { id: student.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
  await createAcademySession({ sub: student.id, email: student.email, firstName: student.firstName, epoch: student.sessionEpoch });
  return { ok: true };
}

export async function getCurrentStudent() {
  const session = await getAcademySession();
  if (!session) return null;
  const student = await db.academyStudent.findUnique({ where: { id: session.sub } });
  if (!student) return null;
  // A deactivated trainee loses access immediately (don't wait for token expiry).
  if (student.portalActive === false) return null;
  // Revoke superseded sessions: a password reset / suspend / sign-out-everywhere
  // bumps sessionEpoch, so a token minted before that no longer authenticates.
  // (Legacy tokens issued before this field default to epoch 0 = current, so no
  // flag-day logout.)
  if ((session.epoch ?? 0) !== student.sessionEpoch) return null;
  return student;
}

/** Revoke all outstanding academy sessions for a student (bump the epoch). Called
 *  on suspend, password reset, or an explicit "sign out everywhere". */
export async function bumpAcademyEpoch(studentId: string): Promise<void> {
  await db.academyStudent.update({ where: { id: studentId }, data: { sessionEpoch: { increment: 1 } } }).catch(() => {});
}

// BLD-314 Phase 2 — academy password reset (mirrors lib/client-auth.ts pattern).

/** Begin a password reset for an academy trainee. Always resolves ok:true
 *  (no account enumeration); sends a one-hour link only if the account exists. */
export async function requestAcademyPasswordReset(email: string): Promise<{ ok: true }> {
  const student = await db.academyStudent.findFirst({ where: { email: email.trim().toLowerCase() }, select: { id: true, email: true, firstName: true, passwordHash: true, portalActive: true } });
  if (student?.passwordHash) {
    // Normal case: the account has a password — email a reset link.
    const token = crypto.randomBytes(32).toString('hex');
    await db.academyStudent.update({
      where: { id: student.id },
      data: { resetTokenHash: sha256(token), resetTokenExp: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const base = process.env.NEXT_PUBLIC_SITE_URL || '';
    const url = `${base}/academy/reset?token=${token}&id=${student.id}`;
    try {
      const { sendEmail, tmplPasswordReset } = await import('@/lib/email');
      await sendEmail({ to: student.email, subject: 'Reset your K Academy password', html: tmplPasswordReset(student.firstName, url) });
    } catch {
      /* swallow — never reveal whether the email exists */
    }
  } else if (student?.portalActive) {
    // Passwordless account (activation-link only — e.g. a trainee onboarded via an
    // offer/"accept & pay" magic link who never set a password): a reset link is
    // useless (there's no password to reset), so the old code sent NOTHING and the
    // trainee saw "no email received" — the reported bug. Mirror the client portal
    // (BLD-527): send an activation magic link so they can get in and set a
    // password from Academy Settings.
    await sendAccessLink(student.id).catch(() => {});
  }
  return { ok: true };
}

/** Complete a password reset with a valid, unexpired token. Signs the student in. */
export async function performAcademyPasswordReset(studentId: string, token: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (!studentId || !token || newPassword.length < 8) return { ok: false, error: 'Invalid request.' };
  const student = await db.academyStudent.findUnique({ where: { id: studentId }, select: { id: true, email: true, firstName: true, resetTokenHash: true, resetTokenExp: true } });
  if (!student?.resetTokenHash || !student.resetTokenExp || student.resetTokenExp < new Date()) {
    return { ok: false, error: 'This reset link has expired. Please request a new one.' };
  }
  if (!hashesEqual(sha256(token), student.resetTokenHash)) return { ok: false, error: 'Invalid reset link.' };
  const { isBreachedPassword } = await import('@/lib/security/breached-password');
  if (await isBreachedPassword(newPassword)) return { ok: false, error: 'That password has appeared in a known data breach. Please choose a different one.' };
  const updated = await db.academyStudent.update({
    where: { id: student.id },
    data: { passwordHash: await hashPassword(newPassword), resetTokenHash: null, resetTokenExp: null, portalActive: true, sessionEpoch: { increment: 1 } },
    select: { sessionEpoch: true },
  });
  try {
    const { sendEmail, tmplPasswordChanged } = await import('@/lib/email');
    await sendEmail({ to: student.email, subject: 'Your K Academy password was changed', html: tmplPasswordChanged(student.firstName || 'there') });
  } catch { /* best-effort */ }
  await createAcademySession({ sub: student.id, email: student.email, firstName: student.firstName, epoch: updated.sessionEpoch });
  return { ok: true };
}

/** Self-service password change from Academy Settings (BLD-547). The student is
 *  already authenticated; we verify their current password (unless the account
 *  is passwordless — activation-link only — in which case this sets the first
 *  one), reject weak/breached choices, then bump the session epoch to sign out
 *  every OTHER device and re-issue the current session so this one stays live. */
export async function changeAcademyPassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const student = await getCurrentStudent();
  if (!student) return { ok: false, error: 'Please sign in again.' };
  if (typeof newPassword !== 'string' || newPassword.length < 8) return { ok: false, error: 'Your new password must be at least 8 characters.' };

  if (student.passwordHash) {
    if (!currentPassword || !(await verifyPassword(currentPassword, student.passwordHash))) {
      return { ok: false, error: 'Your current password is not correct.' };
    }
    if (currentPassword === newPassword) return { ok: false, error: 'Your new password must be different from your current one.' };
  }

  const { isBreachedPassword } = await import('@/lib/security/breached-password');
  if (await isBreachedPassword(newPassword)) return { ok: false, error: 'That password has appeared in a known data breach. Please choose a different one.' };

  const updated = await db.academyStudent.update({
    where: { id: student.id },
    data: { passwordHash: await hashPassword(newPassword), sessionEpoch: { increment: 1 } },
    select: { sessionEpoch: true },
  });
  try {
    const { sendEmail, tmplPasswordChanged } = await import('@/lib/email');
    await sendEmail({ to: student.email, subject: 'Your K Academy password was changed', html: tmplPasswordChanged(student.firstName || 'there') });
  } catch { /* best-effort */ }
  // Keep this device signed in; the epoch bump above already revoked the rest.
  await createAcademySession({ sub: student.id, email: student.email, firstName: student.firstName, epoch: updated.sessionEpoch });
  return { ok: true };
}

// ── Offer onboarding (BLD-528) ──────────────────────────────────────────────
// When staff make an offer, the applicant needs a way into the portal to accept
// and pay — even if they never created an account. These helpers ensure a trainee
// record exists and issue a one-time activation magic link (reusing the reset-token
// columns, exactly like the client portal — no schema change). The link signs them
// in and drops them on the pay page. Mirrors lib/client-auth.ts activate flow.
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — covers a typical offer window

/** Find-or-create the trainee account for an offered applicant and return its id.
 *  A brand-new record is created with no password and `portalActive:false`; the
 *  activation link (or a later self-signup with the same email) brings it live. */
export async function ensureStudentForOffer(input: { tenantId: string; email: string; firstName: string; lastName?: string | null; phone?: string | null }): Promise<{ id: string; email: string; firstName: string; isNew: boolean }> {
  const email = input.email.trim().toLowerCase();
  const existing = await db.academyStudent.findFirst({ where: { email }, select: { id: true, email: true, firstName: true } });
  if (existing) return { ...existing, isNew: false };
  const created = await db.academyStudent.create({
    data: { tenantId: input.tenantId, email, firstName: input.firstName || 'there', lastName: input.lastName || null, phone: input.phone || null, portalActive: false },
    select: { id: true, email: true, firstName: true },
  });
  await linkClientByEmail(created.id, email);
  return { ...created, isNew: true };
}

/** Issue a passwordless activation token for a trainee. Returns the plaintext
 *  token; the caller builds the /academy/activate link. */
export async function createAcademyInvite(studentId: string): Promise<string | null> {
  const exists = await db.academyStudent.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!exists) return null;
  const token = crypto.randomBytes(32).toString('hex');
  await db.academyStudent.update({ where: { id: studentId }, data: { resetTokenHash: sha256(token), resetTokenExp: new Date(Date.now() + INVITE_TTL_MS) } });
  return token;
}

/** Consume an activation magic link: validate the token, mark the portal active,
 *  and return the identity so the caller can open a session. Does not set/require a
 *  password (the trainee can add one later in settings). */
export async function activateStudent(studentId: string, token: string): Promise<{ ok: true; student: { id: string; email: string; firstName: string; sessionEpoch: number } } | { ok: false }> {
  if (!studentId || !token) return { ok: false };
  const student = await db.academyStudent.findUnique({
    where: { id: studentId },
    select: { id: true, email: true, firstName: true, sessionEpoch: true, resetTokenHash: true, resetTokenExp: true },
  });
  if (!student?.resetTokenHash || !student.resetTokenExp || student.resetTokenExp < new Date()) return { ok: false };
  if (!hashesEqual(sha256(token), student.resetTokenHash)) return { ok: false };
  // BLD-909: this magic-link flow is the primary entry point for trainees
  // onboarded via an offer (no password set), so it must record lastLoginAt
  // like every other sign-in path (loginStudent, passkey auth) — otherwise
  // the admin "Last Login" column shows "—" for most students despite them
  // actively using the portal.
  await db.academyStudent.update({ where: { id: student.id }, data: { portalActive: true, lastLoginAt: new Date() } });
  return { ok: true, student: { id: student.id, email: student.email, firstName: student.firstName, sessionEpoch: student.sessionEpoch } };
}

/** Staff action: email a trainee a passwordless link into their portal (e.g. a
 *  learner created during an offer who never set a password). Best-effort. */
export async function sendAccessLink(studentId: string): Promise<{ ok: boolean }> {
  const student = await db.academyStudent.findUnique({ where: { id: studentId }, select: { id: true, email: true, firstName: true } });
  if (!student) return { ok: false };
  const token = await createAcademyInvite(studentId);
  if (!token) return { ok: false };
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://kclinics.co.uk';
  const url = `${base}/academy/activate?token=${token}&id=${studentId}&next=/academy/portal`;
  try {
    const { sendEmail, emailShell } = await import('@/lib/email');
    await sendEmail({
      to: student.email,
      subject: 'Your K Academy portal access',
      html: emailShell({
        preheader: 'Access your K Academy trainee portal',
        body: `<h1 style="font-size:24px;margin:0 0 16px;">Hello ${student.firstName || 'there'},</h1><p>Here's your secure link to access your K Academy trainee portal — no password needed. You can set a password once you're in if you'd like one.</p><p style="margin:28px 0;"><a href="${url}" style="display:inline-block;background:#a98a6d;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;">Open my portal</a></p><p style="font-size:14px;color:#91766e;">This is a private link just for you — please don't share it.</p>`,
      }),
    });
  } catch { /* best-effort */ }
  return { ok: true };
}
