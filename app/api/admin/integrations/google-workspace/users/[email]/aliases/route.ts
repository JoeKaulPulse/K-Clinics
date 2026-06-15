import { NextRequest, NextResponse } from 'next/server';
import { getSession, sessionCan } from '@/lib/auth';
import { addUserAlias, removeUserAlias } from '@/lib/google-workspace';

export async function POST(req: NextRequest, { params }: { params: Promise<{ email: string }> }) {
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const { email } = await params;
  const body = await req.json().catch(() => null);
  const { alias } = body ?? {};
  if (!alias) return NextResponse.json({ ok: false, error: 'alias is required.' }, { status: 400 });
  const ok = await addUserAlias(email, alias);
  if (!ok) return NextResponse.json({ ok: false, error: 'Could not add alias.' }, { status: 500 });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Workspace alias added to ${email}: ${alias}` });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ email: string }> }) {
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const { email } = await params;
  const body = await req.json().catch(() => null);
  const { alias } = body ?? {};
  if (!alias) return NextResponse.json({ ok: false, error: 'alias is required.' }, { status: 400 });
  const ok = await removeUserAlias(email, alias);
  if (!ok) return NextResponse.json({ ok: false, error: 'Could not remove alias.' }, { status: 500 });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Workspace alias removed from ${email}: ${alias}` });
  return NextResponse.json({ ok: true });
}
