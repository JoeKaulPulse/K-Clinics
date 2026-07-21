import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // the daily run does a lot (automations, loyalty, membership, ad-spend, gcal, retention)

// Daily automations runner. Triggered by Vercel Cron (see vercel.json) with the
// CRON_SECRET as a bearer token. Idempotent — every send is logged so nothing
// double-fires within its window.
export async function GET(req: Request) {
  const cronStartedAt = Date.now();
  // Require a configured secret, and a matching bearer token (constant-time). If
  // no secret is set, refuse rather than running the automations unprotected.
  const { cronAuthorized } = await import('@/lib/cron-auth');
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  }
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });

  const { runDailyAutomations } = await import('@/lib/automations');
  // BLD-801: unlike every step below, this one had no try/catch — a throw here
  // used to skip every remaining cron job for the day and never reach the
  // failure-summary alert. Same fallback-and-continue pattern as the rest of the file.
  let result: Awaited<ReturnType<typeof runDailyAutomations>>;
  try {
    result = await runDailyAutomations();
  } catch (e) {
    console.error('[cron] daily automations failed (continuing):', (e as Error)?.message);
    result = { birthdays: 0, followUps: 0, winBacks: 0, reviews: 0, reminders: 0, formReminders: 0, treatmentFollowUps: 0, giftVouchers: 0, tierNudges: 0, anniversaries: 0, abandonedBookings: 0, bookingIntents: 0, membershipRenewals: 0, staffDigests: 0, staffNudges: 0, reencrypted: 0, aftercare: 0, satisfaction: 0, rebookNudges: 0, npsPromoters: 0, npsDetractors: 0, errors: 1 };
  }
  // BLD-153: count failures so the cron doesn't silently return 200 when work
  // failed. Vercel Cron / the status page key off the HTTP status + ok flag.
  let failures = result.errors;

  // Safety net for scheduled email campaigns in case the frequent dispatch cron
  // isn't configured (e.g. plan without sub-daily crons) — also runs here daily.
  let scheduledEmail = { processed: 0, sent: 0 };
  try {
    const { dispatchDueCampaigns } = await import('@/lib/email-campaigns');
    scheduledEmail = await dispatchDueCampaigns();
  } catch (e) {
    failures++; console.error('[cron] scheduled-email dispatch failed (continuing):', (e as Error)?.message);
  }

  // Client loyalty maintenance: birthday gifts + expire 12-month-old points.
  let loyalty = { birthdays: 0, expired: 0 };
  try {
    const { awardBirthdayPoints, expireOldPoints } = await import('@/lib/client-loyalty');
    loyalty = { birthdays: await awardBirthdayPoints(), expired: await expireOldPoints() };
  } catch (e) {
    failures++; console.error('[cron] loyalty maintenance failed (continuing):', (e as Error)?.message);
  }

  // Membership: recompute tiers from rolling 12-month spend so members move up
  // (and lapse down) as their spend changes.
  let membership = { recomputed: 0 };
  try {
    const { recomputeActiveTiers } = await import('@/lib/membership');
    membership = { recomputed: await recomputeActiveTiers() };
  } catch (e) {
    failures++; console.error('[cron] membership recompute failed (continuing):', (e as Error)?.message);
  }

  // Pull ad spend from any connected platforms into campaign ROI (no-op if
  // nothing is connected). Fully fault-tolerant.
  let adSpend = { updated: 0, totalPence: 0 };
  try {
    const { syncAdSpend } = await import('@/lib/ad-spend');
    const r = await syncAdSpend(30);
    adSpend = { updated: r.updated, totalPence: r.totalPence };
  } catch (e) {
    failures++; console.error('[cron] ad-spend sync failed (continuing):', (e as Error)?.message);
  }

  // Refresh Google Calendar busy-times for connected clinicians (no-op if Google
  // isn't configured / nobody connected).
  // PRJ-918.8: sync failures are counted (driving the existing Sentry/webhook/
  // 500 alerting) instead of silently reading as success — the cron still
  // continues either way.
  let gcal = { ok: false, staff: 0, imported: 0, failed: 0 };
  try {
    const { googleEnabled, syncAllCalendars, redactFutureClinicianEvents } = await import('@/lib/google-calendar');
    if (googleEnabled()) {
      gcal = await syncAllCalendars(); // parked while on Hostinger
      if (gcal.failed > 0) { failures++; console.error(`[cron] gcal sync: ${gcal.failed} clinician calendar(s) failed`); }
      // One-time: strip clinical titles/contact details from already-pushed
      // future events (PRJ-939.6). Self-disables via a Settings key.
      await redactFutureClinicianEvents();
    }
  } catch (e) {
    failures++; console.error('[cron] gcal sync failed (continuing):', (e as Error)?.message);
  }
  // Import the latest Google Business reviews (no-op until connected).
  let gbiz = { ok: false, imported: 0 };
  try {
    const { googleBusinessConnected, syncGoogleReviews } = await import('@/lib/google-business');
    if (await googleBusinessConnected()) {
      gbiz = await syncGoogleReviews();
      if (!gbiz.ok) { failures++; console.error('[cron] google reviews sync reported failure'); }
    }
  } catch (e) {
    failures++; console.error('[cron] google reviews sync failed (continuing):', (e as Error)?.message);
  }
  // Behaviour-analytics retention: prune old session replays (90d) and heatmap
  // points (180d) so storage stays bounded and we hold data no longer than needed.
  let retention = { replays: 0, heatmap: 0, calls: 0 };
  try {
    const { db } = await import('@/lib/db');
    const { Prisma } = await import('@prisma/client');
    const replayCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const heatCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    // Clinical records: purge signed consents (and stale requests) after 8 years
    // (UK adult clinical-records norm).
    const consentCutoff = new Date(Date.now() - 8 * 365 * 24 * 60 * 60 * 1000);
    // BLD-127: call recordings/transcripts/raw payloads are minimised after ~13
    // months — the call facts (who/when/duration) stay, the content is scrubbed.
    const callCutoff = new Date(Date.now() - 395 * 24 * 60 * 60 * 1000);
    const secEventCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [r, h, , , , calls] = await Promise.all([
      db.replaySession.deleteMany({ where: { startedAt: { lt: replayCutoff } } }), // cascades to chunks
      db.heatmapEvent.deleteMany({ where: { at: { lt: heatCutoff } } }),
      db.signedConsent.deleteMany({ where: { signedAt: { lt: consentCutoff } } }),
      db.consentRequest.deleteMany({ where: { status: 'PENDING', expiresAt: { lt: new Date() } } }),
      db.beforePhoto.deleteMany({ where: { createdAt: { lt: consentCutoff } } }),
      // PRJ-1033.1: past the retention window, also anonymise the counterparty
      // phone numbers (personal data, like the SecurityEvent IP/email purge
      // above) — not just the recording/transcript. Idempotent: once redacted a
      // row no longer matches, so the sweep converges.
      db.callRecord.updateMany({
        where: { startedAt: { lt: callCutoff }, OR: [{ transcript: { not: null } }, { recordingUrl: { not: null } }, { fromNumber: { not: 'REDACTED' } }] },
        data: { transcript: null, recordingUrl: null, raw: Prisma.DbNull, transcriptStatus: 'unavailable', fromNumber: 'REDACTED', toNumber: 'REDACTED' },
      }),
    ]);
    // GDPR: SecurityEvent rows hold IP + email + UA — no need beyond 90 days.
    await db.securityEvent.deleteMany({ where: { createdAt: { lt: secEventCutoff } } }).catch(() => {});
    // BLD-837: anonymous chat threads (no client account) hold visitor name,
    // email and free-text messages with no erasure path and were retained
    // forever. 12 months after the last activity they are deleted outright
    // (messages cascade) — account-linked threads are covered by erasure.
    const anonChatCutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    await db.chatConversation.deleteMany({ where: { clientId: null, updatedAt: { lt: anonChatCutoff } } }).catch((e: Error) => { console.error('[cron] anon chat retention failed (continuing):', e?.message); });
    retention = { replays: r.count, heatmap: h.count, calls: calls.count };
  } catch (e) {
    failures++; console.error('[cron] analytics retention failed (continuing):', (e as Error)?.message);
  }

  // BLD-718: minimise identifier metadata on records that are retained for
  // clinical/legal reasons. The submission IP on health assessments and the
  // plaintext IP on signed consents (the SAME IP is preserved inside the
  // encrypted consent evidence, so nothing evidential is lost) are no longer
  // needed after 13 months — null them while the record itself is kept for its
  // full retention period. Call `fromNumber` is deliberately retained as a call
  // fact under the BLD-127 policy (who/when/duration stay), so it is not touched
  // here; masking it would be a retention-policy change for the owner to make.
  let idMeta = { assessments: 0, consents: 0 };
  try {
    const { db } = await import('@/lib/db');
    const idMetaCutoff = new Date(Date.now() - 395 * 24 * 60 * 60 * 1000);
    const [a, c] = await Promise.all([
      db.healthAssessment.updateMany({ where: { submittedAt: { lt: idMetaCutoff }, submittedIp: { not: null } }, data: { submittedIp: null } }),
      db.signedConsent.updateMany({ where: { signedAt: { lt: idMetaCutoff }, ip: { not: null } }, data: { ip: null } }),
    ]);
    idMeta = { assessments: a.count, consents: c.count };
  } catch (e) {
    failures++; console.error('[cron] identifier-metadata minimisation failed (continuing):', (e as Error)?.message);
  }

  // PRJ-1032.17/18/19: storage-limitation purges (Art. 5(1)(e)) for records that
  // held personal data with no time-based sweep:
  //  • AiAnalysisImage — encrypted facial photos (opt-in) removed after 90 days;
  //    the non-image plan/findings stay for the client's own history.
  //  • BookingIntent — abandoned-funnel emails removed after 90 days.
  //  • EmailEvent — send metadata (recipient email + subject) removed after 18 months.
  let pii = { aiImages: 0, bookingIntents: 0, emailEvents: 0 };
  try {
    const { db } = await import('@/lib/db');
    const d90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const d18mo = new Date(Date.now() - 548 * 24 * 60 * 60 * 1000);
    const [ai, bi, ee] = await Promise.all([
      db.aiAnalysisImage.deleteMany({ where: { createdAt: { lt: d90 } } }),
      db.bookingIntent.deleteMany({ where: { createdAt: { lt: d90 } } }),
      db.emailEvent.deleteMany({ where: { createdAt: { lt: d18mo } } }),
    ]);
    pii = { aiImages: ai.count, bookingIntents: bi.count, emailEvents: ee.count };
  } catch (e) {
    failures++; console.error('[cron] PII storage-limitation purge failed (continuing):', (e as Error)?.message);
  }

  // BLD-314 Phase 3: GDPR retention sweep. Purge rejected/abandoned job
  // applications (no retention basis after the hiring decision) and reset tokens
  // that expired more than 7 days ago (pure housekeeping).
  let gdprSweep = { jobs: 0, academyTokens: 0 };
  try {
    const { db } = await import('@/lib/db');
    const jobRejectedCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000); // 6 months
    const jobAbandonedCutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 12 months
    const tokenExpiredCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);   // 7 days
    const [jobs, , academyTokens] = await Promise.all([
      db.jobApplication.deleteMany({
        where: {
          OR: [
            { status: 'REJECTED', createdAt: { lt: jobRejectedCutoff } },
            { status: { in: ['NEW', 'REVIEWING'] }, createdAt: { lt: jobAbandonedCutoff } },
          ],
        },
      }),
      // Client portal: clear expired reset tokens (no personal data beyond email FK).
      db.client.updateMany({
        where: { resetTokenExp: { lt: tokenExpiredCutoff }, resetTokenHash: { not: null } },
        data: { resetTokenHash: null, resetTokenExp: null },
      }),
      // Academy portal: clear expired reset tokens.
      db.academyStudent.updateMany({
        where: { resetTokenExp: { lt: tokenExpiredCutoff }, resetTokenHash: { not: null } },
        data: { resetTokenHash: null, resetTokenExp: null },
      }),
    ]);
    gdprSweep = { jobs: jobs.count, academyTokens: academyTokens.count };
  } catch (e) {
    failures++; console.error('[cron] gdpr-retention sweep failed (continuing):', (e as Error)?.message);
  }

  // BLD-248: self-healing clinical-encryption backfill. Encrypts any historic
  // plaintext health rows automatically (no manual trigger), then flags itself
  // complete after a clean pass so it stops scanning. Best-effort.
  let clinicalBackfill = { ran: false, total: 0, complete: false };
  try {
    const { backfillClinicalEncryptionIfNeeded } = await import('@/lib/clinical-crypto-backfill');
    clinicalBackfill = await backfillClinicalEncryptionIfNeeded();
  } catch (e) {
    failures++; console.error('[cron] clinical-encryption backfill failed (continuing):', (e as Error)?.message);
  }

  // BLD-740: one-time re-home of legacy PUBLIC portfolio photos into the
  // private blob store (bounded per run; self-disables via a Settings key once
  // a pass finds nothing left). Failures count so the alerting fires.
  let portfolioMigration = { ran: false, migrated: 0, failed: 0, complete: false };
  try {
    const { migratePortfolioPhotosIfNeeded } = await import('@/lib/portfolio-blob');
    portfolioMigration = await migratePortfolioPhotosIfNeeded();
    if (portfolioMigration.failed > 0) { failures++; console.error(`[cron] portfolio photo migration: ${portfolioMigration.failed} photo(s) failed`); }
  } catch (e) {
    failures++; console.error('[cron] portfolio photo migration failed (continuing):', (e as Error)?.message);
  }

  // (ClinicOS Ring 0 academy-tenant backfill retired in Ring 1c — tenantId is now
  // NOT NULL, so no row can be tenant-less and there is nothing to backfill.)

  // Exam practice: self-healing bootstrap of the question bank from course
  // quizzes + a specimen paper per course, once. Best-effort, idempotent.
  let examBank = { ran: false, created: 0 };
  try {
    const { bootstrapExamBankIfNeeded } = await import('@/lib/exam-bank');
    examBank = await bootstrapExamBankIfNeeded();
  } catch (e) {
    failures++; console.error('[cron] exam-bank bootstrap failed (continuing):', (e as Error)?.message);
  }

  // Academy gamification: compute XP + badges from history once, so the
  // leaderboards are populated from launch. Self-healing, idempotent.
  let gamification = { ran: false, students: 0 };
  try {
    const { backfillGamificationIfNeeded } = await import('@/lib/academy-gamification');
    gamification = await backfillGamificationIfNeeded();
  } catch (e) {
    failures++; console.error('[cron] academy-gamification backfill failed (continuing):', (e as Error)?.message);
  }

  // Apply hand-authored bite-size lesson flows to matching lessons (steps null only).
  let authored = { updated: 0 };
  try {
    const { enrichAuthoredStepsIfNeeded } = await import('@/lib/academy-authored');
    authored = await enrichAuthoredStepsIfNeeded();
  } catch (e) {
    failures++; console.error('[cron] authored-steps enrichment failed (continuing):', (e as Error)?.message);
  }

  // Grow the catalogue: create any newly-declared modules/lessons/quizzes/exam
  // questions that don't yet exist (create-only, idempotent).
  let courseContent = { modules: 0, lessons: 0, questions: 0 };
  try {
    const { enrichCourseContentIfNeeded } = await import('@/lib/academy-content');
    courseContent = await enrichCourseContentIfNeeded();
  } catch (e) {
    failures++; console.error('[cron] course-content enrichment failed (continuing):', (e as Error)?.message);
  }

  // Build board: keep it populated from Claude's backlog server-side, and assign
  // input-required tasks to the best-placed user — so the audit board is reliable
  // even if nobody opens it after a deploy (it used to seed only on first view).
  let board = { created: 0, skipped: 0 };
  try {
    const { seedBacklog, assignOwnerInputTasks, reconcileBacklog, backfillCloseShippedMirrors } = await import('@/lib/build-board');
    board = await seedBacklog();
    await assignOwnerInputTasks();
    await reconcileBacklog();
    await backfillCloseShippedMirrors().catch(() => {}); // close mirror issues for already-shipped items (board cleanup)
    // Reference IDs for anything just seeded (and the nightly self-heal for both boards).
    const { ensureBuildRefs, ensureTaskRefs } = await import('@/lib/task-refs');
    await ensureBuildRefs(board.created > 0);
    await ensureTaskRefs();
  } catch (e) {
    failures++; console.error('[cron] build-board seed failed (continuing):', (e as Error)?.message);
  }

  // Low-stock alert: one collapsing row per inventory manager until restocked/read.
  try {
    const { db } = await import('@/lib/db');
    const items = await db.stockItem.findMany({ where: { active: true, lowStockAt: { gt: 0 } }, select: { name: true, currentQty: true, lowStockAt: true } });
    const low = items.filter((i) => i.currentQty <= i.lowStockAt);
    if (low.length) {
      const { notifyStaffByPermission } = await import('@/lib/notifications');
      await notifyStaffByPermission('inventory.view', {
        kind: 'status', category: 'inventory', priority: 'high', groupKey: 'inventory:low-stock',
        title: `${low.length} item${low.length === 1 ? '' : 's'} low on stock`,
        body: low.slice(0, 4).map((i) => i.name).join(', ') + (low.length > 4 ? '…' : ''),
        href: '/admin/inventory',
      });
    }
  } catch { /* non-fatal */ }

  // BLD-587: compliance & renewals reminders — alert staff who can view compliance
  // when an item crosses a 90/60/30-day threshold (or expires).
  try {
    const { runRenewalReminders } = await import('@/lib/renewals');
    await runRenewalReminders();
  } catch (e) { failures++; console.error('[cron] renewal reminders failed (continuing):', (e as Error)?.message); } // BLD-907: counted so the existing Sentry/webhook/500 alerting fires

  // BLD-857: dunning for in-house academy instalment plans — a gentle, capped
  // reminder to learners whose scheduled instalment is due soon or overdue.
  let instalmentDunning = { sent: 0 };
  try {
    const { academyInstalmentReminders } = await import('@/lib/academy-payments');
    instalmentDunning = await academyInstalmentReminders();
  } catch (e) {
    failures++; console.error('[cron] academy instalment dunning failed (continuing):', (e as Error)?.message);
  }

  // BLD-537: daily community digest to staff (new threads, replies, unanswered).
  let communityDigest = { sent: false, threads: 0, posts: 0 };
  try {
    const { sendCommunityDigest } = await import('@/lib/forum');
    communityDigest = await sendCommunityDigest();
  } catch (e) {
    failures++; console.error('[cron] community digest failed (continuing):', (e as Error)?.message);
  }

  // Record the run so the status page can show job freshness.
  try {
    const { db } = await import('@/lib/db');
    await db.setting.upsert({ where: { key: 'cron_daily_last' }, update: { value: new Date().toISOString() }, create: { key: 'cron_daily_last', value: new Date().toISOString() } });
  } catch { /* non-fatal */ }

  const cronDurationMs = Date.now() - cronStartedAt;

  // BLD-349/400: never let a cron failure be silent. Always report to Sentry (the
  // error aggregator — no-op until SENTRY_DSN is set) so failures surface without
  // any extra config, and additionally push a summary to the ops webhook channel
  // when CRON_ALERT_WEBHOOK_URL (Slack/Discord/Make/Zapier) is configured in Vercel.
  if (failures > 0) {
    const summary = `[kclinics cron] ${failures} failure(s) in ${Math.round(cronDurationMs / 1000)}s — check Vercel logs`;
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureMessage(summary, 'error');
    } catch { /* Sentry not available — non-fatal */ }
    const webhookUrl = process.env.CRON_ALERT_WEBHOOK_URL;
    if (webhookUrl) {
      const body = JSON.stringify({ text: summary, failures, durationMs: cronDurationMs });
      fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
    }
  }

  // BLD-153: surface failure to the scheduler — non-200 when anything failed.
  return NextResponse.json(
    { ok: failures === 0, failures, durationMs: cronDurationMs, ...result, loyalty, membership, gcal, gbiz, retention, idMeta, pii, gdprSweep, scheduledEmail, adSpend, board, clinicalBackfill, portfolioMigration, examBank, gamification, authored, courseContent, communityDigest, instalmentDunning },
    { status: failures === 0 ? 200 : 500 },
  );
}
