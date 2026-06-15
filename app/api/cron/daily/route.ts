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
  const result = await runDailyAutomations();
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
      db.callRecord.updateMany({
        where: { startedAt: { lt: callCutoff }, OR: [{ transcript: { not: null } }, { recordingUrl: { not: null } }] },
        data: { transcript: null, recordingUrl: null, raw: Prisma.DbNull, transcriptStatus: 'unavailable' },
      }),
    ]);
    // GDPR: SecurityEvent rows hold IP + email + UA — no need beyond 90 days.
    await db.securityEvent.deleteMany({ where: { createdAt: { lt: secEventCutoff } } }).catch(() => {});
    retention = { replays: r.count, heatmap: h.count, calls: calls.count };
  } catch (e) {
    failures++; console.error('[cron] analytics retention failed (continuing):', (e as Error)?.message);
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

  // ClinicOS Ring 0: stamp the K Clinics tenant onto any Academy rows still NULL,
  // then flag complete so it stops scanning. Self-healing, idempotent, best-effort.
  let academyTenant = { ran: false, stamped: 0, complete: false };
  try {
    const { backfillAcademyTenantIfNeeded } = await import('@/lib/tenant');
    academyTenant = await backfillAcademyTenantIfNeeded();
  } catch (e) {
    failures++; console.error('[cron] academy-tenant backfill failed (continuing):', (e as Error)?.message);
  }

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
    const { seedBacklog, assignOwnerInputTasks, reconcileBacklog } = await import('@/lib/build-board');
    board = await seedBacklog();
    await assignOwnerInputTasks();
    await reconcileBacklog();
    // Reference IDs for anything just seeded (and the nightly self-heal for both boards).
    const { ensureBuildRefs, ensureTaskRefs } = await import('@/lib/task-refs');
    await ensureBuildRefs(board.created > 0);
    await ensureTaskRefs();
  } catch (e) {
    failures++; console.error('[cron] build-board seed failed (continuing):', (e as Error)?.message);
  }

  // Record the run so the status page can show job freshness.
  try {
    const { db } = await import('@/lib/db');
    await db.setting.upsert({ where: { key: 'cron_daily_last' }, update: { value: new Date().toISOString() }, create: { key: 'cron_daily_last', value: new Date().toISOString() } });
  } catch { /* non-fatal */ }

  const cronDurationMs = Date.now() - cronStartedAt;

  // BLD-349: push failure summary to a webhook channel when configured.
  // Set CRON_ALERT_WEBHOOK_URL (Slack/Discord/Make/Zapier) in Vercel env.
  if (failures > 0) {
    const webhookUrl = process.env.CRON_ALERT_WEBHOOK_URL;
    if (webhookUrl) {
      const body = JSON.stringify({
        text: `[kclinics cron] ${failures} failure(s) in ${Math.round(cronDurationMs / 1000)}s — check Vercel logs`,
        failures,
        durationMs: cronDurationMs,
      });
      fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
    }
  }

  // BLD-153: surface failure to the scheduler — non-200 when anything failed.
  return NextResponse.json(
    { ok: failures === 0, failures, durationMs: cronDurationMs, ...result, loyalty, membership, gcal, gbiz, retention, gdprSweep, scheduledEmail, adSpend, board, clinicalBackfill, academyTenant, examBank, gamification, authored, courseContent },
    { status: failures === 0 ? 200 : 500 },
  );
}
