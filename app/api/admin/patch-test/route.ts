import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Set or clear a client's patch-test result. Requires clinical access
// (clients.clinical.view) AND edit rights, matching the medical-flag route.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'clients.clinical.view') || !sessionCan(session, 'clients.edit')) {
    return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  }

  const { clientId, result } = (await req.json().catch(() => ({}))) as { clientId?: string; result?: string };
  if (!clientId) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });

  const value = result === 'PASSED' || result === 'FAILED' ? result : null;
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');

  await db.client.update({
    where: { id: clientId },
    data: {
      patchTestResult: value,
      patchTestDate: value ? new Date() : null,
      patchTestSetBy: value ? session!.email : null,
    },
  });
  await logAudit({
    action: 'PATCH_TEST_RECORDED',
    actor: session!.email,
    actorRole: session!.role,
    clientId,
    summary: value ? `Patch test recorded: ${value}` : 'Patch test cleared',
  });
  return NextResponse.json({ ok: true });
}
