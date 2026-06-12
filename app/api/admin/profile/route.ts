import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Self-service profile management for the signed-in staff member.
//   POST { op: 'updateProfile' }  → name, title
//   POST { op: 'changePassword' } → current + new password
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  if (body.op === 'updateProfile') {
    const { name, title } = body as { name?: string; title?: string };
    await db.adminUser.update({
      where: { id: session.sub },
      data: {
        ...(name !== undefined ? { name: String(name).trim().slice(0, 120) || null } : {}),
        ...(title !== undefined ? { title: String(title).trim().slice(0, 120) || null } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'changePassword') {
    const { current, next } = body as { current?: string; next?: string };
    if (!current || !next) return NextResponse.json({ ok: false, error: 'Both passwords are required.' }, { status: 400 });
    if (next.length < 8) return NextResponse.json({ ok: false, error: 'New password must be at least 8 characters.' }, { status: 422 });
    const { verifyPassword, hashPassword } = await import('@/lib/auth');
    const user = await db.adminUser.findUnique({ where: { id: session.sub }, select: { passwordHash: true } });
    if (!user || !(await verifyPassword(current, user.passwordHash))) {
      return NextResponse.json({ ok: false, error: 'Your current password is incorrect.' }, { status: 403 });
    }
    await db.adminUser.update({ where: { id: session.sub }, data: { passwordHash: await hashPassword(next), sessionEpoch: { increment: 1 } } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
