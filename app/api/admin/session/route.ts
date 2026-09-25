import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Self-service session controls. "Sign out everywhere" bumps the account's
// revocation epoch, immediately invalidating every existing session (including
// other devices), then clears the current cookie.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, destroySession } = await import('@/lib/auth');
  // BLD-1306: "sign out everywhere" is a session-termination control (it only
  // ever revokes access, never grants it), so — like /api/admin/logout — it
  // stays reachable for a needsSetup:true (2FA-pending) session even though
  // getSession() now rejects such sessions by default everywhere else.
  const session = await getSession(true);
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.op === 'signOutEverywhere') {
    const { db } = await import('@/lib/db');
    await db.adminUser.update({ where: { id: session.sub }, data: { sessionEpoch: { increment: 1 } } });
    const { recordSecurity } = await import('@/lib/security/guard');
    await recordSecurity('UNLOCK', 'admin', session.email, req, { action: 'signOutEverywhere' });
    await destroySession();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
