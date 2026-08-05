import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
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

    // BLD-1187: runApiHealth() computes `overall` as the worst light across
    // EVERY probe (critical or not) — so a red non-critical integration (e.g.
    // TikTok, GitHub mirror) already turns `overall` red without this being an
    // outage anyone needs paging for. Alert specifically on `critical: true`
    // checks (Stripe, Anthropic, the database, the public site, cron) being
    // red — a dead/revoked key on one of those is the "customers are affected
    // right now" case this finding is about.
    //
    // Only alert on a NEW red spell, not on every red run: ApiHealthResult.since
    // is carried forward unchanged while a light stays the same between runs and
    // reset to that run's `generatedAt` the run a check's light changes (see
    // runApiHealth() in lib/api-health.ts). So `since` is the moment the check
    // went red, and alerting only when that moment is newer than the last alert
    // we sent catches the outage as it starts without re-paging every ~30
    // minutes for its duration. (ISO-8601 UTC strings from toISOString() are
    // fixed-width, so a lexicographic compare is a chronological one.)
    //
    // The last-alerted watermark is kept in its own Setting row rather than
    // inferred from `since === report.generatedAt` (BLD-1187 review): ANY run
    // rewrites the stored report, including the live probe that
    // components/admin/ApiHealthPanel.tsx fires on every /admin/api-health open
    // (and every 60s with auto-refresh on) and the one ConnectionCentre.tsx
    // fires after a key is saved. Those runs consume the "changed this run"
    // marker without alerting, so the following cron would see an unchanged
    // light and stay silent — losing the page entirely for the outage. That is
    // the likeliest moment for one, since saving a wrong key is what turns a
    // critical check red in the first place.
    //
    // Only alert when the caller is the actual scheduled cron (cronAuthed,
    // i.e. presented CRON_SECRET) — not an admin interactively opening
    // /admin/api-health with `requirePermission('platform.status')`, who can
    // already see the red light on the page. Mirrors the `authed` gate in
    // app/api/health/route.ts.
    if (cronAuthed) {
      const { db } = await import('@/lib/db');
      const ALERT_KEY = 'api_health_last_alert_at';
      let lastAlertAt = '';
      try {
        lastAlertAt = (await db.setting.findUnique({ where: { key: ALERT_KEY } }))?.value || '';
      } catch { /* no watermark — treat every current red spell as new */ }
      const newRedCritical = report.checks.filter(
        (c) => c.critical && c.light === 'red' && c.since > lastAlertAt,
      );
      if (newRedCritical.length > 0) {
        const summary = `[kclinics api-health] critical outage — ${newRedCritical
          .map((c) => `${c.label} (${c.id}): ${c.detail}`)
          .join(' · ')}`;
        try {
          Sentry.captureMessage(summary, 'error');
        } catch { /* Sentry not available — non-fatal */ }
        const webhookUrl = process.env.CRON_ALERT_WEBHOOK_URL;
        if (webhookUrl) {
          const body = JSON.stringify({ text: summary, ...report });
          // BLD-1137: await the alert — the serverless runtime can freeze once
          // the response is sent, so an un-awaited fetch may silently never send.
          try { await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }); } catch { /* non-fatal */ }
        }
        // Advance the watermark only after the alert has gone out, so a failed
        // run re-alerts on the next cron rather than swallowing the outage.
        try {
          await db.setting.upsert({
            where: { key: ALERT_KEY },
            update: { value: report.generatedAt, updatedBy: 'api-health' },
            create: { key: ALERT_KEY, value: report.generatedAt, updatedBy: 'api-health' },
          });
        } catch { /* watermark write failed — worst case is one duplicate alert */ }
      }
    }

    return NextResponse.json({ ok: true, cached: false, report });
  } catch (e) {
    console.error('[api-health] run failed', e);
    Sentry.captureException(e, { tags: { route: 'admin/api-health' } });
    return NextResponse.json({ ok: false, error: 'Health run failed — see logs.' }, { status: 500 });
  }
}
