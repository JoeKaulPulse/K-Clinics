import 'server-only';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword, createAcademySession, getAcademySession } from '@/lib/auth';

export type AcademySignup = { firstName: string; lastName?: string; email: string; phone?: string; password: string };

/** Create a trainee (academy) account — separate from the clinic client portal. */
export async function signupStudent(input: AcademySignup): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!input.firstName?.trim() || !email || input.password.length < 8) return { ok: false, error: 'Please complete all fields (password 8+ characters).' };
  const existing = await db.academyStudent.findUnique({ where: { email }, select: { passwordHash: true } });
  if (existing?.passwordHash) return { ok: false, error: 'An account already exists for this email. Try signing in.' };

  const passwordHash = await hashPassword(input.password);
  const student = await db.academyStudent.upsert({
    where: { email },
    update: { firstName: input.firstName, lastName: input.lastName || undefined, phone: input.phone || undefined, passwordHash, portalActive: true },
    create: { email, firstName: input.firstName, lastName: input.lastName || null, phone: input.phone || null, passwordHash, portalActive: true },
  });
  // Link any prior applications made with this email to the new account.
  await db.enrolment.updateMany({ where: { applicantEmail: email, studentId: null }, data: { studentId: student.id } }).catch(() => {});
  await createAcademySession({ sub: student.id, email: student.email, firstName: student.firstName });
  return { ok: true };
}

export async function loginStudent(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const student = await db.academyStudent.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, email: true, firstName: true, passwordHash: true } });
  if (!student?.passwordHash || !(await verifyPassword(password, student.passwordHash))) return { ok: false, error: 'Invalid email or password.' };
  await db.academyStudent.update({ where: { id: student.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
  await createAcademySession({ sub: student.id, email: student.email, firstName: student.firstName });
  return { ok: true };
}

export async function getCurrentStudent() {
  const session = await getAcademySession();
  if (!session) return null;
  return db.academyStudent.findUnique({ where: { id: session.sub } });
}
