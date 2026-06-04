import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin-only password (re)set for a client portal account, so a client who can't
// sign in can be helped without email infrastructure. Requires either a staff
// session with clients.edit, or the CRON_SECRET bearer token (ops use).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not enabled.' }, { status: 503 });

  const auth = req.headers.get('authorization');
  const viaSecret = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;

  if (!viaSecret) {
    const { getSession, sessionCan } = await import('@/lib/auth');
    const session = await getSession();
    if (!sessionCan(session, 'clients.edit')) {
      return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
    }
  }

  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!email || !password || password.length < 8) {
    return NextResponse.json({ ok: false, error: 'Email and a password (8+ chars) are required.' }, { status: 422 });
  }

  const { db } = await import('@/lib/db');
  const { hashPassword } = await import('@/lib/auth');
  const client = await db.client.findUnique({ where: { email: email.toLowerCase() } });
  if (!client) return NextResponse.json({ ok: false, error: 'No client with that email.' }, { status: 404 });

  await db.client.update({
    where: { id: client.id },
    data: { passwordHash: await hashPassword(password), portalActive: true },
  });
  const { notifyPasswordChanged } = await import('@/lib/client-auth');
  await notifyPasswordChanged(client.email, client.firstName);
  return NextResponse.json({ ok: true });
}
