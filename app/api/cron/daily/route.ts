import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // the daily run does a lot (automations, loyalty, membership, ad-spend, gcal, retention)

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

  // Safety net for scheduled email campaigns in case the frequent dispatch cron
  // isn't configured (e.g. plan without sub-daily crons) — also runs here daily.
  let scheduledEmail = { processed: 0, sent: 0 };
  try {
    const { dispatchDueCampaigns } = await import('@/lib/email-campaigns');
    scheduledEmail = await dispatchDueCampaigns();
  } catch (e) {
    console.error('[cron] scheduled-email dispatch failed (continuing):', (e as Error)?.message);
  }

  // Client loyalty maintenance: birthday gifts + expire 12-month-old points.
  let loyalty = { birthdays: 0, expired: 0 };
  try {
    const { awardBirthdayPoints, expireOldPoints } = await import('@/lib/client-loyalty');
    loyalty = { birthdays: await awardBirthdayPoints(), expired: await expireOldPoints() };
  } catch (e) {
    console.error('[cron] loyalty maintenance failed (continuing):', (e as Error)?.message);
  }

  // Membership: recompute tiers from rolling 12-month spend so members move up
  // (and lapse down) as their spend changes.
  let membership = { recomputed: 0 };
  try {
    const { recomputeActiveTiers } = await import('@/lib/membership');
    membership = { recomputed: await recomputeActiveTiers() };
  } catch (e) {
    console.error('[cron] membership recompute failed (continuing):', (e as Error)?.message);
  }

  // Pull ad spend from any connected platforms into campaign ROI (no-op if
  // nothing is connected). Fully fault-tolerant.
  let adSpend = { updated: 0, totalPence: 0 };
  try {
    const { syncAdSpend } = await import('@/lib/ad-spend');
    const r = await syncAdSpend(30);
    adSpend = { updated: r.updated, totalPence: r.totalPence };
  } catch (e) {
    console.error('[cron] ad-spend sync failed (continuing):', (e as Error)?.message);
  }

  // Refresh Google Calendar busy-times for connected clinicians (no-op if Google
  // isn't configured / nobody connected).
  let gcal = { ok: false, staff: 0, imported: 0 };
  try {
    const { googleEnabled, syncAllCalendars } = await import('@/lib/google-calendar');
    if (googleEnabled()) gcal = await syncAllCalendars(); // parked while on Hostinger
  } catch {
    /* never fail the cron on a calendar sync issue */
  }
  // Import the latest Google Business reviews (no-op until connected).
  let gbiz = { ok: false, imported: 0 };
  try {
    const { googleBusinessConnected, syncGoogleReviews } = await import('@/lib/google-business');
    if (await googleBusinessConnected()) gbiz = await syncGoogleReviews();
  } catch {
    /* never fail the cron on a review sync issue */
  }
  // Behaviour-analytics retention: prune old session replays (90d) and heatmap
  // points (180d) so storage stays bounded and we hold data no longer than needed.
  let retention = { replays: 0, heatmap: 0 };
  try {
    const { db } = await import('@/lib/db');
    const replayCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const heatCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    // Clinical records: purge signed consents (and stale requests) after 8 years
    // (UK adult clinical-records norm).
    const consentCutoff = new Date(Date.now() - 8 * 365 * 24 * 60 * 60 * 1000);
    const [r, h] = await Promise.all([
      db.replaySession.deleteMany({ where: { startedAt: { lt: replayCutoff } } }), // cascades to chunks
      db.heatmapEvent.deleteMany({ where: { at: { lt: heatCutoff } } }),
      db.signedConsent.deleteMany({ where: { signedAt: { lt: consentCutoff } } }),
      db.consentRequest.deleteMany({ where: { status: 'PENDING', expiresAt: { lt: new Date() } } }),
      db.beforePhoto.deleteMany({ where: { createdAt: { lt: consentCutoff } } }),
    ]);
    retention = { replays: r.count, heatmap: h.count };
  } catch (e) {
    console.error('[cron] analytics retention failed (continuing):', (e as Error)?.message);
  }

  // Build board: keep it populated from Claude's backlog server-side, and assign
  // input-required tasks to the best-placed user — so the audit board is reliable
  // even if nobody opens it after a deploy (it used to seed only on first view).
  let board = { created: 0, skipped: 0 };
  try {
    const { seedBacklog, assignOwnerInputTasks, reconcileBacklog } = await import('@/lib/build-board');
    board = await seedBacklog();
    await assignOwnerInputTasks();
    await reconcileBacklog();
    // Reference IDs for anything just seeded (and the nightly self-heal for both boards).
    const { ensureBuildRefs, ensureTaskRefs } = await import('@/lib/task-refs');
    await ensureBuildRefs(board.created > 0);
    await ensureTaskRefs();
  } catch (e) {
    console.error('[cron] build-board seed failed (continuing):', (e as Error)?.message);
  }

  // Record the run so the status page can show job freshness.
  try {
    const { db } = await import('@/lib/db');
    await db.setting.upsert({ where: { key: 'cron_daily_last' }, update: { value: new Date().toISOString() }, create: { key: 'cron_daily_last', value: new Date().toISOString() } });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, ...result, loyalty, membership, gcal, gbiz, retention, scheduledEmail, adSpend, board });
}
