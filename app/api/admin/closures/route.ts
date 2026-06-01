import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage clinic-wide closures & holidays (block all staff for a date/range).
// Requires schedule.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('schedule.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');

  if (body.op === 'remove') {
    if (!body.id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.clinicClosure.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  }

  // Add: a date or range, optionally for one location (else all sites).
  const { startDate, endDate, reason, locationId } = body as { startDate: string; endDate?: string; reason?: string; locationId?: string | null };
  if (!startDate) return NextResponse.json({ ok: false, error: 'A date is required.' }, { status: 400 });
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date((endDate || startDate) + 'T23:59:59.999');
  if (isNaN(+start) || isNaN(+end) || end < start) return NextResponse.json({ ok: false, error: 'Invalid dates.' }, { status: 400 });

  await db.clinicClosure.create({
    data: { startAt: start, endAt: end, allDay: true, reason: reason?.trim() || null, locationId: locationId || null, createdBy: session.email },
  });
  await logAudit({ action: 'TIMEOFF_ADDED', actor: session.email, actorRole: session.role, summary: `Clinic closure ${start.toLocaleDateString('en-GB')}–${end.toLocaleDateString('en-GB')}${reason ? ` (${reason})` : ''}` });
  return NextResponse.json({ ok: true });
}
