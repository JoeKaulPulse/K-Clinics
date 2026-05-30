import { NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM is not enabled in this environment.' }, { status: 503 });

  const parsed = loginSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Enter a valid email and password.' }, { status: 422 });

  const { db } = await import('@/lib/db');
  const { verifyPassword, createSession } = await import('@/lib/auth');

  const email = parsed.data.email.toLowerCase();
  const user = await db.adminUser.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials.' }, { status: 401 });
  }
  if (user.active === false) {
    return NextResponse.json({ ok: false, error: 'This account has been deactivated.' }, { status: 403 });
  }

  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name || undefined,
    role: user.role,
    grant: user.permGrant ?? [],
    revoke: user.permRevoke ?? [],
  });
  return NextResponse.json({ ok: true });
}
