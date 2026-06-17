import { NextRequest, NextResponse } from 'next/server';
import { getSession, sessionCan } from '@/lib/auth';
import { listWorkspaceUsersResult, createWorkspaceUser } from '@/lib/google-workspace';

export async function GET() {
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const r = await listWorkspaceUsersResult();
  if (!r.ok) return NextResponse.json({ ok: false, configured: r.configured, error: r.error ?? 'Failed to load users.' });
  return NextResponse.json({ ok: true, users: r.users });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const { email, firstName, lastName, password } = body ?? {};
  if (!email || !firstName || !lastName || !password) {
    return NextResponse.json({ ok: false, error: 'email, firstName, lastName and password are required.' }, { status: 400 });
  }
  const user = await createWorkspaceUser({ email, firstName, lastName, password });
  if (!user) return NextResponse.json({ ok: false, error: 'Could not create user — check the service account has write scopes.' }, { status: 500 });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Workspace user created: ${email}` });
  return NextResponse.json({ ok: true, user }, { status: 201 });
}
