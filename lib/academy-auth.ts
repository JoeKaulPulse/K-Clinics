import 'server-only';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword, createAcademySession, getAcademySession } from '@/lib/auth';

export type AcademySignup = { firstName: string; lastName?: string; email: string; phone?: string; password: string; dob?: string };

/** Create a trainee (academy) account — separate from the clinic client portal. */
export async function signupStudent(input: AcademySignup): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!input.firstName?.trim() || !email || input.password.length < 8) return { ok: false, error: 'Please complete all fields (password 8+ characters).' };
  // Age gate: the academy accepts students aged 16 or over.
  const { meetsMinAge, MIN_STUDENT_AGE } = await import('@/lib/age');
  if (!input.dob || !meetsMinAge(input.dob, MIN_STUDENT_AGE)) return { ok: false, error: 'You must be 16 or over to join the academy.' };
  const existing = await db.academyStudent.findUnique({ where: { email }, select: { passwordHash: true } });
  if (existing?.passwordHash) return { ok: false, error: 'An account already exists for this email. Try signing in.' };

  const passwordHash = await hashPassword(input.password);
  const dob = new Date(input.dob);
  const { currentTenantId } = await import('@/lib/tenant');
  const tenantId = await currentTenantId();
  const student = await db.academyStudent.upsert({
    where: { email },
    update: { firstName: input.firstName, lastName: input.lastName || undefined, phone: input.phone || undefined, dob, ageDeclaredAt: new Date(), passwordHash, portalActive: true },
    create: { tenantId, email, firstName: input.firstName, lastName: input.lastName || null, phone: input.phone || null, dob, ageDeclaredAt: new Date(), passwordHash, portalActive: true },
  });
  // Link any prior applications made with this email to the new account.
  await db.enrolment.updateMany({ where: { applicantEmail: email, studentId: null }, data: { studentId: student.id } }).catch(() => {});
  await createAcademySession({ sub: student.id, email: student.email, firstName: student.firstName, epoch: student.sessionEpoch });
  return { ok: true };
}

export async function loginStudent(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const student = await db.academyStudent.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, email: true, firstName: true, passwordHash: true, sessionEpoch: true } });
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
