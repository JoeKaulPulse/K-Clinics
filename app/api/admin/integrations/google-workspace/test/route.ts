import { NextResponse } from 'next/server';
import { getSession, sessionCan } from '@/lib/auth';
import { workspaceConfigured, listWorkspaceUsers } from '@/lib/google-workspace';

export async function GET() {
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const configured = await workspaceConfigured();
  if (!configured) {
    return NextResponse.json({ ok: false, configured: false, error: 'GOOGLE_WORKSPACE_SA_KEY and GOOGLE_WORKSPACE_ADMIN_EMAIL are not set.' });
  }
  const users = await listWorkspaceUsers().catch(() => null);
  if (users === null) {
    return NextResponse.json({ ok: false, configured: true, error: 'Connection failed — check the service account key and domain-wide delegation.' });
  }
  return NextResponse.json({ ok: true, configured: true, userCount: users.length });
}
