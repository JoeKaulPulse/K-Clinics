import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin-only password (re)set for a client portal account, so a client who can't
// sign in can be helped without email infrastructure. Requires a staff session
// with clients.edit. (The shared CRON_SECRET is NOT accepted here — it is reused
// by the daily cron, health probe and ops tooling, so honouring it would let any
// holder of that one secret reset any client's password — BLD-465.)
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not enabled.' }, { status: 503 });

  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'clients.edit')) {
    return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  }
  const actor = session?.email || 'staff';

  // Bound abuse of this privileged endpoint (it can set any client's password).
  const { enforceRateLimit, recordSecurity } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'admin-pw-reset', 20, 600, 'admin'))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait and try again.' }, { status: 429 });
  }

  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!email || !password || password.length < 8) {
    return NextResponse.json({ ok: false, error: 'Email and a password (8+ chars) are required.' }, { status: 422 });
  }

  const { db } = await import('@/lib/db');
  const { hashPassword } = await import('@/lib/auth');
  const client = await db.client.findUnique({ where: { email: email.toLowerCase() } });
  if (!client) return NextResponse.json({ ok: false, error: 'No client with that email.' }, { status: 404 });

  // Reset the password AND bump sessionEpoch to revoke any outstanding portal
  // sessions (mirrors the self-service reset) — a stolen session must not survive
  // an admin reset. Log the action for accountability.
  await db.client.update({
    where: { id: client.id },
    data: { passwordHash: await hashPassword(password), portalActive: true, sessionEpoch: { increment: 1 } },
  });
  await recordSecurity('PASSWORD_RESET_ADMIN', 'admin', client.email, req, { by: actor }).catch(() => {});
  const { notifyPasswordChanged } = await import('@/lib/client-auth');
  await notifyPasswordChanged(client.email, client.firstName);
  return NextResponse.json({ ok: true });
}
