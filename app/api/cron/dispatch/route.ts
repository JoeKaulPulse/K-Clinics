import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Frequent dispatcher (Vercel Cron, see vercel.json) — sends any email campaign
// whose scheduled time has arrived. Protected by CRON_SECRET. Idempotent: each
// campaign is claimed (status → SENDING) before sending so it can't double-fire.
export async function GET(req: Request) {
  const { cronAuthorized } = await import('@/lib/cron-auth');
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  }
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });

  const failures: string[] = [];

  const { dispatchDueCampaigns } = await import('@/lib/email-campaigns');
  let result = { processed: 0, sent: 0, abDecided: 0 };
  try { result = await dispatchDueCampaigns(); } catch (e) { failures.push(`campaigns: ${(e as Error)?.message}`); }

  // Email any unseen live-chat reply once the visitor has clearly left.
  let chat = { emailed: 0 };
  try { const { sweepChatEmailFollowups } = await import('@/lib/chat-email'); chat = await sweepChatEmailFollowups(); } catch (e) { failures.push(`chat-email: ${(e as Error)?.message}`); }
  // BLD-133: expire lapsed waitlist offers and pass the freed slot to the next person.
  let waitlist = { expired: 0, reoffered: 0 };
  try { const { rotateExpiredWaitlist } = await import('@/lib/waitlist'); waitlist = await rotateExpiredWaitlist(); } catch (e) { failures.push(`waitlist: ${(e as Error)?.message}`); }
  // PRJ-1043.3: release PENDING bookings abandoned before card setup finished,
  // so a closed tab (or a bot hitting /api/booking/create) can't hold a slot
  // forever.
  let abandoned = { released: 0 };
  try { const { releaseAbandonedPendingBookings } = await import('@/lib/booking-actions'); abandoned = await releaseAbandonedPendingBookings(); } catch (e) { failures.push(`abandoned-bookings: ${(e as Error)?.message}`); }
  // BLD-1253: cancel PENDING shop Orders abandoned past checkout (no Checkout
  // Session to auto-expire them) and release any reserved gift-card balance.
  let abandonedOrders = { released: 0 };
  try { const { releaseAbandonedPendingOrders } = await import('@/lib/automations'); abandonedOrders = await releaseAbandonedPendingOrders(); } catch (e) { failures.push(`abandoned-orders: ${(e as Error)?.message}`); }
  // Materialise any due recurring/scheduled task automations ("repeat events").
  // Idempotent per occurrence, so the 15-min cadence can't double-spawn.
  let taskAutomations = { fired: 0, tasksCreated: 0 };
  try { const { runDueTaskAutomations } = await import('@/lib/task-automations'); taskAutomations = await runDueTaskAutomations(); } catch (e) { failures.push(`task-automations: ${(e as Error)?.message}`); }
  // Mirror any board items not yet on GitHub, a small throttled batch at a time.
  // Only runs when GitHub mirroring is explicitly enabled (default OFF) and we're
  // not in a rate-limit backoff — so the board never burns GitHub's API budget on
  // its own. The board is the source of truth regardless.
  let ghSync = { synced: 0, remaining: 0 };
  try {
    const { syncAllToGithub, githubMirrorEnabled } = await import('@/lib/build-board');
    if (await githubMirrorEnabled()) ghSync = await syncAllToGithub('system', 6);
  } catch (e) { failures.push(`gh-sync: ${(e as Error)?.message}`); }
  try {
    const { db } = await import('@/lib/db');
    await db.setting.upsert({ where: { key: 'cron_dispatch_last' }, update: { value: new Date().toISOString() }, create: { key: 'cron_dispatch_last', value: new Date().toISOString() } });
  } catch { /* non-fatal: timestamp is advisory */ }

  if (failures.length > 0) {
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureMessage(`[cron/dispatch] ${failures.length} task(s) failed: ${failures.join('; ')}`, 'error');
    } catch { /* Sentry not initialised */ }
    const webhook = process.env.CRON_ALERT_WEBHOOK_URL;
    if (webhook) {
      try { await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `cron/dispatch failures: ${failures.join('; ')}` }) }); } catch { /* non-fatal */ }
    }
    console.error('[cron/dispatch] failures:', failures);
    return NextResponse.json({ ok: false, failures, ...result, chatFollowups: chat.emailed, waitlistExpired: waitlist.expired, waitlistReoffered: waitlist.reoffered, abandonedBookingsReleased: abandoned.released, abandonedOrdersReleased: abandonedOrders.released, githubSynced: ghSync.synced, githubRemaining: ghSync.remaining, taskAutomationsFired: taskAutomations.fired, taskAutomationTasks: taskAutomations.tasksCreated }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...result, chatFollowups: chat.emailed, waitlistExpired: waitlist.expired, waitlistReoffered: waitlist.reoffered, abandonedBookingsReleased: abandoned.released, abandonedOrdersReleased: abandonedOrders.released, githubSynced: ghSync.synced, githubRemaining: ghSync.remaining, taskAutomationsFired: taskAutomations.fired, taskAutomationTasks: taskAutomations.tasksCreated });
}
