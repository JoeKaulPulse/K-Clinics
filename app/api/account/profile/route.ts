import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().max(80).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  dob: z.string().refine((s) => !s || (!isNaN(Date.parse(s)) && new Date(s) < new Date() && new Date(s) > new Date('1900-01-01')), 'Enter a valid date of birth').optional().or(z.literal('')),
  gender: z.enum(['FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY', '']).optional(),
  genderSelfDescribe: z.string().max(60).optional().or(z.literal('')),
  marketingOptIn: z.boolean().optional(),
  smsReminders: z.boolean().optional(),
  // Optional password change
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(200).optional(),
});

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { getClientSession, hashPassword, verifyPassword } = await import('@/lib/auth');
  const session = await getClientSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Check your details.' }, { status: 422 });
  const d = parsed.data;

  // Password change requires current-password verification and is rate-limited.
  if (d.newPassword) {
    const { enforceRateLimit } = await import('@/lib/security/guard');
    if (!await enforceRateLimit(req, 'profile-password-change', 5, 600)) {
      return NextResponse.json({ ok: false, error: 'Too many attempts — please wait 10 minutes.' }, { status: 429 });
    }
    if (!d.currentPassword) {
      return NextResponse.json({ ok: false, error: 'Enter your current password to set a new one.' }, { status: 400 });
    }
    const { db } = await import('@/lib/db');
    const row = await db.client.findUnique({ where: { id: session.sub }, select: { passwordHash: true } });
    if (!row?.passwordHash || !await verifyPassword(d.currentPassword, row.passwordHash)) {
      return NextResponse.json({ ok: false, error: 'Current password is incorrect.' }, { status: 400 });
    }
  }

  const { db } = await import('@/lib/db');
  const data: Record<string, unknown> = {};
  if (d.firstName !== undefined) data.firstName = d.firstName;
  if (d.lastName !== undefined) data.lastName = d.lastName || null;
  if (d.phone !== undefined) data.phone = d.phone || null;
  if (d.dob) data.dob = new Date(d.dob);
  if (d.gender !== undefined) {
    data.gender = d.gender === '' ? null : d.gender;
    // Self-description only applies to OTHER; clear it otherwise.
    data.genderSelfDescribe = d.gender === 'OTHER' ? (d.genderSelfDescribe?.trim() || null) : null;
  }
  if (typeof d.marketingOptIn === 'boolean') {
    data.marketingOptIn = d.marketingOptIn;
    // BLD-128: evidence consent when the client explicitly opts in via their profile.
    if (d.marketingOptIn) {
      const { marketingConsentFields } = await import('@/lib/consent');
      Object.assign(data, marketingConsentFields('portal-profile'));
    }
  }
  if (typeof d.smsReminders === 'boolean') data.smsReminders = d.smsReminders;
  // BLD-736: bump sessionEpoch so any other (e.g. stolen) sessions are revoked.
  // Re-issue THIS session below with the new epoch so the client who just
  // changed their own password isn't immediately logged out (mirrors the
  // admin profile route's changePassword op).
  if (d.newPassword) {
    data.passwordHash = await hashPassword(d.newPassword);
    data.sessionEpoch = { increment: 1 };
  }

  const updated = await db.client.update({ where: { id: session.sub }, data });
  // Alert the account holder whenever the password changes (security notice).
  if (d.newPassword) {
    const { notifyPasswordChanged } = await import('@/lib/client-auth');
    await notifyPasswordChanged(updated.email, updated.firstName);
    const { createClientSession } = await import('@/lib/auth');
    await createClientSession({ sub: session.sub, email: session.email, firstName: session.firstName, epoch: updated.sessionEpoch ?? 0 });
  }
  return NextResponse.json({ ok: true });
}
