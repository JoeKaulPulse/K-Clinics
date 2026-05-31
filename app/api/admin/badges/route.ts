import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Single round-trip for the sidebar badges (replaces separate time-off + tasks
// calls), so navigation only fires one lightweight request.
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false });

  const { db } = await import('@/lib/db');
  const canApprove = sessionCan(session, 'schedule.manage');
  const [pendingTimeOff, openTasks] = await Promise.all([
    canApprove ? db.staffTimeOff.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
    db.task.count({ where: { assigneeId: session.sub, status: 'OPEN' } }),
  ]);
  return NextResponse.json({ ok: true, pendingTimeOff, openTasks });
}
