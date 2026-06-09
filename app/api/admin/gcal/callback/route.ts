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
  const state = url.searchParams.get('state');

  // Validate the cookie-bound, one-time CSRF state first (timing-safe), so an
  // attacker can't make an admin complete a flow they didn't start (binding the
  // attacker's Google account to a staff record).
  const { consumeOAuthState } = await import('@/lib/oauth-state');
  if (!code || !state || !(await consumeOAuthState('gcal', state))) {
    return NextResponse.redirect(new URL('/admin/schedule?gcal=error', req.url));
  }
  // The validated state carries the target staffId after the nonce. Authorise:
  // the person completing the flow must have schedule.manage (or be connecting
  // their own calendar).
  const staffId = state.split('.').slice(2).join('.');
  if (!staffId || !(sessionCan(session, 'schedule.manage') || staffId === session?.sub)) {
    return NextResponse.redirect(new URL('/admin/schedule?gcal=error', req.url));
  }

  const { exchangeCodeForStaff, syncStaffCalendar } = await import('@/lib/google-calendar');
  const ok = await exchangeCodeForStaff(code, staffId);
  if (ok) await syncStaffCalendar(staffId);
  return NextResponse.redirect(new URL(`/admin/schedule?gcal=${ok ? 'connected' : 'error'}`, req.url));
}
