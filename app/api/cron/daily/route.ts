import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Daily automations runner. Triggered by Vercel Cron (see vercel.json) with the
// CRON_SECRET as a bearer token. Idempotent — every send is logged so nothing
// double-fires within its window.
export async function GET(req: Request) {
  // Require a configured secret, and a matching bearer token. If no secret is
  // set, refuse rather than running the automations unprotected.
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  }
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });

  const { runDailyAutomations } = await import('@/lib/automations');
  const result = await runDailyAutomations();
  // Refresh Google Calendar busy-times for connected clinicians (no-op if Google
  // isn't configured / nobody connected).
  let gcal = { ok: false, staff: 0, imported: 0 };
  try {
    const { syncAllCalendars } = await import('@/lib/google-calendar');
    gcal = await syncAllCalendars();
  } catch {
    /* never fail the cron on a calendar sync issue */
  }
  return NextResponse.json({ ok: true, ...result, gcal });
}
