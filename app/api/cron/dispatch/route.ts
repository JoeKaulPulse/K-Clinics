import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Frequent dispatcher (Vercel Cron, see vercel.json) — sends any email campaign
// whose scheduled time has arrived. Protected by CRON_SECRET. Idempotent: each
// campaign is claimed (status → SENDING) before sending so it can't double-fire.
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  }
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });

  const { dispatchDueCampaigns } = await import('@/lib/email-campaigns');
  const result = await dispatchDueCampaigns();
  return NextResponse.json({ ok: true, ...result });
}
