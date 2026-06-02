import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manually trigger a Google Calendar busy-time sync (one staff or all).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'schedule.manage')) return NextResponse.json({ ok: false, error: 'Not permitted' }, { status: 403 });

  const { staffId } = (await req.json().catch(() => ({}))) as { staffId?: string };
  const { syncStaffCalendar, syncAllCalendars, googleEnabled } = await import('@/lib/google-calendar');
  if (!googleEnabled()) return NextResponse.json({ ok: false, error: 'Google Calendar is parked (clinic is on Hostinger).' }, { status: 503 });
  const result = staffId ? await syncStaffCalendar(staffId) : await syncAllCalendars();
  return NextResponse.json(result);
}
