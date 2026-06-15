import { NextRequest, NextResponse } from 'next/server';
import { getSession, sessionCan } from '@/lib/auth';
import { addGroupMember, removeGroupMember } from '@/lib/google-workspace';

export async function POST(req: NextRequest, { params }: { params: Promise<{ email: string }> }) {
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const { email } = await params;
  const body = await req.json().catch(() => null);
  const { memberEmail } = body ?? {};
  if (!memberEmail) return NextResponse.json({ ok: false, error: 'memberEmail is required.' }, { status: 400 });
  const ok = await addGroupMember(email, memberEmail);
  if (!ok) return NextResponse.json({ ok: false, error: 'Could not add member.' }, { status: 500 });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Added ${memberEmail} to Workspace group ${email}` });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ email: string }> }) {
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const { email } = await params;
  const body = await req.json().catch(() => null);
  const { memberEmail } = body ?? {};
  if (!memberEmail) return NextResponse.json({ ok: false, error: 'memberEmail is required.' }, { status: 400 });
  const ok = await removeGroupMember(email, memberEmail);
  if (!ok) return NextResponse.json({ ok: false, error: 'Could not remove member.' }, { status: 500 });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Removed ${memberEmail} from Workspace group ${email}` });
  return NextResponse.json({ ok: true });
}
