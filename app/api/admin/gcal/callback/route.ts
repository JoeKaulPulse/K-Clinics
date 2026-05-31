import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Google OAuth callback — stores the refresh token and runs a first sync.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.redirect(new URL('/admin/schedule', req.url));
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // staffId the token will attach to
  // The person completing the flow must have schedule.manage (or be connecting
  // their own calendar). The staffId travels in `state`.
  if (!code || !state || !(sessionCan(session, 'schedule.manage') || state === session?.sub)) {
    return NextResponse.redirect(new URL('/admin/schedule?gcal=error', req.url));
  }

  const { exchangeCodeForStaff, syncStaffCalendar } = await import('@/lib/google-calendar');
  const ok = await exchangeCodeForStaff(code, state);
  if (ok) await syncStaffCalendar(state);
  return NextResponse.redirect(new URL(`/admin/schedule?gcal=${ok ? 'connected' : 'error'}`, req.url));
}
