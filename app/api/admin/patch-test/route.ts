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

  const { clientId, result, testDate } = (await req.json().catch(() => ({}))) as {
    clientId?: string;
    result?: string;
    testDate?: string;
  };
  if (!clientId) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });

  const value = result === 'PASSED' || result === 'FAILED' ? result : null;
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');

  const now = new Date();
  let chosenDate = now;
  if (value && testDate) {
    // BLD-1846: staff may backdate to the actual (possibly historical) date
    // the patch test was performed. Reject anything unparseable or in the
    // future rather than silently guessing — fall back to today instead.
    const parsed = new Date(testDate);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() <= now.getTime()) {
      chosenDate = parsed;
    } else if (!Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ ok: false, error: 'Test date cannot be in the future.' }, { status: 400 });
    }
  }

  await db.client.update({
    where: { id: clientId },
    data: {
      patchTestResult: value,
      patchTestDate: value ? chosenDate : null,
      // Audit trail: who entered this record and when — always "now", never
      // staff-editable, kept separate from the (possibly backdated) test date.
      patchTestRecordedAt: value ? now : null,
      patchTestSetBy: value ? session!.email : null,
    },
  });
  await logAudit({
    action: 'PATCH_TEST_RECORDED',
    actor: session!.email,
    actorRole: session!.role,
    clientId,
    summary: value
      ? `Patch test recorded: ${value} (test date ${chosenDate.toLocaleDateString('en-GB')})`
      : 'Patch test cleared',
  });
  return NextResponse.json({ ok: true });
}
