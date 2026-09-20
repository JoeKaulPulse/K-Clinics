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
  if (value && testDate !== undefined && testDate !== null && testDate !== '') {
    // BLD-1846: staff may backdate to the actual (possibly historical) date
    // the patch test was performed. Only the YYYY-MM-DD the date input emits
    // is accepted — anything else is rejected outright rather than silently
    // recorded as today, which is the wrong-date bug this change exists to fix.
    if (typeof testDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(testDate)) {
      return NextResponse.json({ ok: false, error: 'Enter the test date as a valid date.' }, { status: 400 });
    }
    // Compare as London calendar dates, not instants: the clinic is in the UK
    // and during BST the current UTC instant can still be on yesterday's date,
    // which would reject a same-day entry made just after midnight.
    const todayLondon = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now);
    if (testDate > todayLondon) {
      return NextResponse.json({ ok: false, error: 'Test date cannot be in the future.' }, { status: 400 });
    }
    if (testDate < '2000-01-01') {
      return NextResponse.json({ ok: false, error: 'Test date looks wrong — check the year.' }, { status: 400 });
    }
    // Store midday UTC so the stored instant lands on the same calendar date
    // in any timezone the record is later read in (midnight UTC would render
    // as the previous day for anyone behind Greenwich).
    chosenDate = new Date(`${testDate}T12:00:00.000Z`);
    if (Number.isNaN(chosenDate.getTime())) {
      return NextResponse.json({ ok: false, error: 'Enter the test date as a valid date.' }, { status: 400 });
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
      ? `Patch test recorded: ${value} (test date ${chosenDate.toLocaleDateString('en-GB', { timeZone: 'Europe/London' })})`
      : 'Patch test cleared',
  });
  return NextResponse.json({ ok: true });
}
