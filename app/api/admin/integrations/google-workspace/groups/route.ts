import { NextRequest, NextResponse } from 'next/server';
import { getSession, sessionCan } from '@/lib/auth';
import { listGroupsResult, createGroup } from '@/lib/google-workspace';

export async function GET() {
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const r = await listGroupsResult();
  if (!r.ok) return NextResponse.json({ ok: false, configured: r.configured, error: r.error ?? 'Failed to load groups.' });
  return NextResponse.json({ ok: true, groups: r.groups });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const { email, name, description } = body ?? {};
  if (!email || !name) {
    return NextResponse.json({ ok: false, error: 'email and name are required.' }, { status: 400 });
  }
  const group = await createGroup(email, name, description);
  if (!group) return NextResponse.json({ ok: false, error: 'Could not create group.' }, { status: 500 });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Workspace group created: ${email}` });
  return NextResponse.json({ ok: true, group }, { status: 201 });
}
