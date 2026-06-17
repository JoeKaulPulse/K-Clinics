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
  const student = await db.academyStudent.findFirst({ where: { email: email.trim().toLowerCase() }, select: { id: true, email: true, firstName: true, passwordHash: true } });
  if (student?.passwordHash) {
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
