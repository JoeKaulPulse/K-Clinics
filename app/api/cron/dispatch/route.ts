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
  // Email any unseen live-chat reply once the visitor has clearly left.
  let chat = { emailed: 0 };
  try { const { sweepChatEmailFollowups } = await import('@/lib/chat-email'); chat = await sweepChatEmailFollowups(); } catch { /* non-fatal */ }
  // Mirror any board items not yet on GitHub, a small throttled batch at a time,
  // so the audit log in GitHub stays current automatically (no manual "Sync all"
  // click) while staying well under GitHub's secondary rate limits. No-op unless
  // GitHub is connected.
  let ghSync = { synced: 0, remaining: 0 };
  try { const { syncAllToGithub } = await import('@/lib/build-board'); ghSync = await syncAllToGithub('system', 6); } catch { /* non-fatal */ }
  try {
    const { db } = await import('@/lib/db');
    await db.setting.upsert({ where: { key: 'cron_dispatch_last' }, update: { value: new Date().toISOString() }, create: { key: 'cron_dispatch_last', value: new Date().toISOString() } });
  } catch { /* non-fatal */ }
  return NextResponse.json({ ok: true, ...result, chatFollowups: chat.emailed, githubSynced: ghSync.synced, githubRemaining: ghSync.remaining });
}
