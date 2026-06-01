import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage a staff member's weekly schedule and time-off. Requires schedule.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('schedule.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');

  // ── Replace a staff member's weekly schedule ──
  if (body.op === 'setSchedule') {
    const { staffId, blocks } = body as { staffId: string; blocks: { dayOfWeek: number; startMin: number; endMin: number; breakStartMin?: number | null; breakEndMin?: number | null; locationId?: string | null }[] };
    if (!staffId || !Array.isArray(blocks)) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    const clean = blocks.filter((b) => b.dayOfWeek >= 0 && b.dayOfWeek <= 6 && b.endMin > b.startMin);
    // Keep a break only when it's a valid window inside the working day.
    const validBreak = (b: { startMin: number; endMin: number; breakStartMin?: number | null; breakEndMin?: number | null }) =>
      b.breakStartMin != null && b.breakEndMin != null && b.breakEndMin > b.breakStartMin && b.breakStartMin >= b.startMin && b.breakEndMin <= b.endMin;
    // One block per weekday → one location per day (a clinician can't be in two
    // places at once). locationId is kept per block.
    await db.$transaction([
      db.staffSchedule.deleteMany({ where: { staffId } }),
      db.staffSchedule.createMany({ data: clean.map((b) => ({
        staffId, dayOfWeek: b.dayOfWeek, startMin: b.startMin, endMin: b.endMin,
        breakStartMin: validBreak(b) ? b.breakStartMin : null, breakEndMin: validBreak(b) ? b.breakEndMin : null,
        locationId: b.locationId || null,
      })) }),
    ]);
    return NextResponse.json({ ok: true });
  }

  // ── Set which locations a clinician is allowed to work at (many-to-many) ──
  if (body.op === 'setLocations') {
    const { staffId, locationIds } = body as { staffId: string; locationIds: string[] };
    if (!staffId || !Array.isArray(locationIds)) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.adminUser.update({ where: { id: staffId }, data: { locations: { set: locationIds.map((id) => ({ id })) } } });
    return NextResponse.json({ ok: true });
  }

  // ── Add time-off / block ──
  if (body.op === 'addTimeOff') {
    const { staffId, kind, startAt, endAt, reason } = body as { staffId: string; kind?: string; startAt: string; endAt: string; reason?: string };
    if (!staffId || !startAt || !endAt) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    const s = new Date(startAt), e = new Date(endAt);
    if (isNaN(+s) || isNaN(+e) || e <= s) return NextResponse.json({ ok: false, error: 'Invalid dates' }, { status: 400 });
    const validKind = ['HOLIDAY', 'SICK', 'TRAINING', 'PERSONAL', 'BLOCKED'].includes(kind || '') ? kind : 'BLOCKED';
    // Added by a manager (schedule.manage) → auto-approved.
    await db.staffTimeOff.create({ data: { staffId, kind: validKind as never, status: 'APPROVED', startAt: s, endAt: e, reason: reason || null, requestedBy: session.email, reviewedBy: session.email, reviewedAt: new Date() } });
    await logAudit({ action: 'TIMEOFF_ADDED', actor: session.email, actorRole: session.role, summary: `Time-off added for staff ${staffId}: ${s.toLocaleDateString('en-GB')}–${e.toLocaleDateString('en-GB')}` });
    return NextResponse.json({ ok: true });
  }

  // ── Remove time-off ──
  if (body.op === 'removeTimeOff') {
    const { id } = body as { id: string };
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.staffTimeOff.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  // ── Update a clinician's profile bits (clinician flag, competencies) ──
  if (body.op === 'setClinician') {
    const { staffId, isClinician, competencies, color, title } = body as { staffId: string; isClinician?: boolean; competencies?: string[]; color?: string; title?: string };
    if (!staffId) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.adminUser.update({
      where: { id: staffId },
      data: {
        ...(typeof isClinician === 'boolean' ? { isClinician } : {}),
        ...(Array.isArray(competencies) ? { competencies } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(title !== undefined ? { title } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
