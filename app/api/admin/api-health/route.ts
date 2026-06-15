import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Live API health report for /admin/api-health. Runs REAL read-only calls
// against every external provider (Stripe balance, Resend domains, Anthropic
// models, OAuth refreshes, …) — see lib/api-health.ts for the probe registry.
//
// GET            → run all probes now (a few seconds) and return the report.
// GET ?cached=1  → return the last stored report instantly (no probing).
//
// Access: admins holding the platform.status permission, or automation
// presenting the CRON_SECRET as a Bearer/x-cron-secret header (never a query
// param — those leak into access logs).
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });

  const { cronAuthorized } = await import('@/lib/cron-auth');
  const cronAuthed = cronAuthorized(req); // constant-time
  if (!cronAuthed) {
    const { requirePermission } = await import('@/lib/auth');
    const session = await requirePermission('platform.status');
    if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  }

  try {
    const { runApiHealth, getLastApiHealthReport } = await import('@/lib/api-health');
    const cached = new URL(req.url).searchParams.get('cached') === '1';
    if (cached) {
      const last = await getLastApiHealthReport();
      if (last) return NextResponse.json({ ok: true, cached: true, report: last });
      // Nothing stored yet — fall through to a live run.
    }
    const report = await runApiHealth();
    return NextResponse.json({ ok: true, cached: false, report });
  } catch (e) {
    console.error('[api-health] run failed', e);
    return NextResponse.json({ ok: false, error: 'Health run failed — see logs.' }, { status: 500 });
  }
}
