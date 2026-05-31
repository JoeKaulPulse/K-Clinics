import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Begin Google Calendar OAuth for a staff member. Anyone with schedule.manage
// may initiate the connection (e.g. during onboarding, with the clinician
// present to authorise their own Google account); the chosen staffId is carried
// through OAuth `state` so the callback knows which record to attach the token
// to. Defaults to the signed-in user when no staffId is supplied.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'schedule.manage')) return NextResponse.json({ ok: false, error: 'Not permitted' }, { status: 403 });

  const staffId = new URL(req.url).searchParams.get('staffId') || session!.sub;

  const { googleAuthUrl } = await import('@/lib/google-calendar');
  const url = googleAuthUrl(staffId);
  if (!url) return NextResponse.json({ ok: false, error: 'Google Calendar is not configured.' }, { status: 503 });
  return NextResponse.redirect(url);
}
