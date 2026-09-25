import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const VALID_KINDS = ['HOLIDAY', 'SICK', 'TRAINING', 'PERSONAL', 'BLOCKED'];

// Staff self-service time-off + manager approvals.
//   GET  ?count=pending   → pending count (managers only) — for the nav badge
//   POST { op: 'request' } → request own time off (status depends on settings)
//   POST { op: 'cancel' }  → withdraw your own pending/future request
//   POST { op: 'approve' | 'decline' } → manager decision (schedule.manage)
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });

  const url = new URL(req.url);
  if (url.searchParams.get('count') === 'pending') {
    if (!sessionCan(session, 'schedule.manage')) return NextResponse.json({ ok: true, pending: 0 });
    const { db } = await import('@/lib/db');
    const pending = await db.staffTimeOff.count({ where: { status: 'PENDING' } });
    return NextResponse.json({ ok: true, pending });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  const canApprove = sessionCan(session, 'schedule.manage');

  // ── Request own time off ──
  if (body.op === 'request') {
    const { kind, startAt, endAt, reason, allDay } = body as {
      kind?: string; startAt?: string; endAt?: string; reason?: string; allDay?: boolean;
    };
    if (!startAt || !endAt) return NextResponse.json({ ok: false, error: 'Start and end are required.' }, { status: 400 });
    const s = new Date(startAt), e = new Date(endAt);
    if (isNaN(+s) || isNaN(+e) || e <= s) return NextResponse.json({ ok: false, error: 'Please choose a valid date range.' }, { status: 400 });
    if (e.getTime() < Date.now()) return NextResponse.json({ ok: false, error: 'Time off can’t be entirely in the past.' }, { status: 400 });
    const validKind = VALID_KINDS.includes(kind || '') ? (kind as string) : 'HOLIDAY';

    const { getSetting } = await import('@/lib/settings');
    const needsApproval = await getSetting('time_off_requires_approval');
    // Managers approving their own request, or approval turned off → APPROVED.
    const status = needsApproval && !canApprove ? 'PENDING' : 'APPROVED';

    const row = await db.staffTimeOff.create({
      data: {
        staffId: session.sub,
        kind: validKind as never,
        status: status as never,
        startAt: s,
        endAt: e,
        allDay: Boolean(allDay),
        reason: reason?.slice(0, 500) || null,
        requestedBy: session.email,
        ...(status === 'APPROVED' ? { reviewedBy: session.email, reviewedAt: new Date() } : {}),
      },
    });
    await logAudit({
      action: status === 'APPROVED' ? 'TIMEOFF_ADDED' : 'TIMEOFF_REQUESTED',
      actor: session.email, actorRole: session.role,
      summary: `${validKind.toLowerCase()} ${status === 'APPROVED' ? 'booked' : 'requested'} ${s.toLocaleDateString('en-GB')}–${e.toLocaleDateString('en-GB')}`,
      meta: { timeOffId: row.id },
    });
    // A request that needs approval pings the approvers (the requester's own
    // approved entries don't notify anyone).
    if (status === 'PENDING') {
      const { notifyStaffByPermission } = await import('@/lib/notifications');
      await notifyStaffByPermission('schedule.manage', {
        kind: 'status', category: 'team', priority: 'high',
        title: `Time-off request from ${session.email.split('@')[0]}`,
        body: `${validKind.toLowerCase()} · ${s.toLocaleDateString('en-GB')}–${e.toLocaleDateString('en-GB')}`,
        href: '/admin/time-off',
      }, session.email).catch(() => {});
    }
    return NextResponse.json({ ok: true, status });
  }

  // ── Cancel / withdraw your own request ──
  if (body.op === 'cancel') {
    const { id } = body as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    const row = await db.staffTimeOff.findUnique({ where: { id }, select: { id: true, staffId: true, status: true, startAt: true, endAt: true, kind: true } });
    if (!row) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
    // Only your own, and only if a manager isn't required to act — but managers can cancel any.
    if (row.staffId !== session.sub && !canApprove) return NextResponse.json({ ok: false, error: 'You can only cancel your own time off.' }, { status: 403 });
    if (['DECLINED', 'CANCELLED'].includes(row.status)) return NextResponse.json({ ok: true });
    await db.staffTimeOff.update({ where: { id }, data: { status: 'CANCELLED', reviewedBy: session.email, reviewedAt: new Date() } });
    await logAudit({ action: 'TIMEOFF_CANCELLED', actor: session.email, actorRole: session.role, summary: `${row.kind.toLowerCase()} cancelled ${row.startAt.toLocaleDateString('en-GB')}–${row.endAt.toLocaleDateString('en-GB')}`, meta: { timeOffId: id } });
    return NextResponse.json({ ok: true });
  }

  // ── Approve / decline (managers) ──
  if (body.op === 'approve' || body.op === 'decline') {
    if (!canApprove) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
    const { id, note, force } = body as { id?: string; note?: string; force?: boolean };
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    const row = await db.staffTimeOff.findUnique({ where: { id }, include: { staff: { select: { name: true, email: true } } } });
    if (!row) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

    // BLD-1886: approving leave over a window where the staff member already
    // has live appointments booked leaves reception and the client stranded —
    // warn before approving (unless already confirmed with force: true), the
    // same warn-and-confirm pattern as the reschedule/reassign conflicts.
    let conflicts: { id: string; startAt: Date; endAt: Date }[] = [];
    if (body.op === 'approve') {
      const { overlapsBookingWindow } = await import('@/lib/booking-actions');
      const candidates = await db.booking.findMany({
        where: {
          status: { in: ['PENDING', 'CONFIRMED'] }, practitionerId: row.staffId,
          startAt: { gte: new Date(row.startAt.getTime() - 24 * 60 * 60 * 1000), lt: row.endAt },
        },
        select: { id: true, startAt: true, endAt: true, bufferMin: true },
      });
      conflicts = candidates.filter((b) => overlapsBookingWindow(row.startAt, row.endAt, b));
      if (conflicts.length && !force) {
        const soonest = conflicts.reduce((a, b) => (a.startAt < b.startAt ? a : b));
        const when = soonest.startAt.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        return NextResponse.json({
          ok: false,
          code: 'BOOKING_CONFLICT',
          error: `${row.staff?.name || row.staff?.email} has ${conflicts.length} existing appointment${conflicts.length === 1 ? '' : 's'} in this window — the soonest is ${when}. Approve anyway if reception will reassign or contact ${conflicts.length === 1 ? 'that client' : 'those clients'}.`,
          conflicts: conflicts.map((c) => ({ id: c.id, startAt: c.startAt.toISOString(), endAt: c.endAt.toISOString() })),
        }, { status: 409 });
      }
    }

    const status = body.op === 'approve' ? 'APPROVED' : 'DECLINED';
    await db.staffTimeOff.update({ where: { id }, data: { status: status as never, reviewedBy: session.email, reviewedAt: new Date(), reviewNote: note?.slice(0, 500) || null } });
    await logAudit({
      action: body.op === 'approve' ? 'TIMEOFF_APPROVED' : 'TIMEOFF_DECLINED',
      actor: session.email, actorRole: session.role,
      summary: `${row.kind.toLowerCase()} ${status.toLowerCase()} for ${row.staff?.name || row.staff?.email}: ${row.startAt.toLocaleDateString('en-GB')}–${row.endAt.toLocaleDateString('en-GB')}`,
      meta: { timeOffId: id },
    });
    // PRJ-1118.8: tell the requester the outcome — same staff-notification
    // mechanism (in-app + email per their prefs) used above for the original
    // "request" ping to approvers, targeted at the requester by id since we
    // hold row.staffId, not necessarily their email lower-cased (mirrors the
    // notifyStaffById doc comment: "e.g. task assignment").
    const { notifyStaffById } = await import('@/lib/notifications');
    await notifyStaffById(row.staffId, {
      kind: 'status', category: 'team', priority: 'high',
      title: body.op === 'approve' ? 'Your time-off request was approved' : 'Your time-off request was declined',
      body: `${row.kind.toLowerCase()} · ${row.startAt.toLocaleDateString('en-GB')}–${row.endAt.toLocaleDateString('en-GB')}${note ? ` · ${note.slice(0, 200)}` : ''}`,
      href: '/admin/time-off',
    }, session.sub).catch(() => {});

    // BLD-1886: leave was approved over existing appointments (staff confirmed
    // the conflict warning above) — reception needs to know so those
    // appointments get reassigned or the clients contacted; nothing else
    // surfaces this otherwise.
    if (body.op === 'approve' && conflicts.length) {
      const { notifyStaffByPermission } = await import('@/lib/notifications');
      await notifyStaffByPermission('schedule.manage', {
        kind: 'status', category: 'bookings', priority: 'urgent',
        title: `Time off approved over ${conflicts.length} existing appointment${conflicts.length === 1 ? '' : 's'}`,
        body: `${row.staff?.name || row.staff?.email} · ${row.startAt.toLocaleDateString('en-GB')}–${row.endAt.toLocaleDateString('en-GB')} — please reassign or contact the affected client${conflicts.length === 1 ? '' : 's'}.`,
        href: '/admin/bookings',
      }, session.email).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
