import { NextRequest, NextResponse } from 'next/server';
import { getSession, sessionCan } from '@/lib/auth';
import { suspendWorkspaceUser, restoreWorkspaceUser } from '@/lib/google-workspace';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ email: string }> }) {
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const { email } = await params;
  const body = await req.json().catch(() => null);
  const { suspended } = body ?? {};
  if (typeof suspended !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'suspended (boolean) is required.' }, { status: 400 });
  }
  const ok = suspended ? await suspendWorkspaceUser(email) : await restoreWorkspaceUser(email);
  if (!ok) return NextResponse.json({ ok: false, error: 'Could not update user.' }, { status: 500 });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Workspace user ${suspended ? 'suspended' : 'restored'}: ${email}` });
  return NextResponse.json({ ok: true });
}
