import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PRJ-724.5: live GA4 realtime feed for the dashboard widget's client-side poll.
// Session + campaigns.view gated (same audience as the traffic snapshot).
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const { ga4Realtime } = await import('@/lib/ga4-data');
  const data = await ga4Realtime();
  return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}
