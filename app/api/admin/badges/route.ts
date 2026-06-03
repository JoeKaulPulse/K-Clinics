import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Single round-trip for the sidebar badges (replaces separate time-off + tasks
// calls), so navigation only fires one lightweight request. This polls every
// few seconds from every admin page, so it must NEVER 500 — any failure
// (transient DB blip, etc.) degrades gracefully to zero badges.
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false });
  try {
    const { getSession, sessionCan } = await import('@/lib/auth');
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false });

    const { db } = await import('@/lib/db');
    const canApprove = sessionCan(session, 'schedule.manage');
    const canChat = sessionCan(session, 'clients.view');
    const [pendingTimeOff, openTasks, chatUnread] = await Promise.all([
      canApprove ? db.staffTimeOff.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
      db.task.count({ where: { assigneeId: session.sub, status: 'OPEN' } }),
      canChat ? db.chatConversation.count({ where: { status: 'OPEN', staffUnread: { gt: 0 } } }) : Promise.resolve(0),
    ]);
    return NextResponse.json({ ok: true, pendingTimeOff, openTasks, chatUnread });
  } catch (e) {
    // Non-critical: log for diagnosis but return a benign empty payload so the
    // sidebar poll doesn't spam 500s in the Vercel logs or the browser console.
    console.error('[badges] failed', e);
    return NextResponse.json({ ok: false, pendingTimeOff: 0, openTasks: 0, chatUnread: 0 });
  }
}
