import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Daily automations runner. Triggered by Vercel Cron (see vercel.json) with the
// CRON_SECRET as a bearer token. Idempotent — every send is logged so nothing
// double-fires within its window.
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  }
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });

  const { runDailyAutomations } = await import('@/lib/automations');
  const result = await runDailyAutomations();
  return NextResponse.json({ ok: true, ...result });
}
