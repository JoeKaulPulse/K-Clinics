import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lightweight health probe for diagnosing the live deployment. Visit
// /api/health to confirm the server can reach the database and the schema is
// present. Never exposes secrets — only booleans/counts.
export async function GET(req: Request) {
  // Detailed diagnostics (schema probes, secret presence, error messages) are
  // reconnaissance — only expose them to a caller holding the CRON_SECRET.
  // BLD-160: accept the secret ONLY via headers, never a ?secret= query param
  // (query strings leak into Vercel function logs, CDN access logs and history).
  const { cronAuthorized } = await import('@/lib/cron-auth');
  const authed = cronAuthorized(req); // constant-time; header-only (BLD-160)

  const report: Record<string, unknown> = {
    ok: false,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
  };
  if (authed) {
    report.crmEnabled = process.env.NEXT_PUBLIC_CRM_ENABLED === 'true' || process.env.CRM_ENABLED === 'true' || Boolean(process.env.DATABASE_URL);
    report.hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
    report.hasPostgresUrl = Boolean(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
    report.deployedAt = process.env.VERCEL_DEPLOYMENT_ID ? new Date().toISOString() : 'local';
  }

  try {
    const { db } = await import('@/lib/db');
    // Cheap query that proves connectivity + that the Client table exists.
    const clients = await db.client.count();
    report.database = 'connected';
    // Everything below is sensitive detail — authed callers only.
    if (!authed) { report.ok = true; return NextResponse.json(report, { status: 200 }); }
    report.clientTable = 'present';
    report.clientCount = clients;

    // Probe the newer tables/columns signup + the ops suite depend on, so a
    // missing migration is diagnosable rather than a bare 500.
    const checks: Record<string, string> = {};
    const probe = async (name: string, fn: () => Promise<unknown>) => {
      try { await fn(); checks[name] = 'ok'; } catch (e) { checks[name] = `MISSING: ${(e as Error)?.message?.slice(0, 120)}`; }
    };
    await probe('discountClaim', () => db.discountClaim.count());
    await probe('setting', () => db.setting.count());
    await probe('staffSchedule', () => db.staffSchedule.count());
    await probe('auditEvent', () => db.auditEvent.count());
    await probe('client.signupIp+resetToken', () => db.client.findFirst({ select: { signupIp: true, resetTokenHash: true, medicalFlag: true } }));
    // Full-row reads mirror exactly what signup/login do (default findUnique
    // pulls every column) — so any single missing column shows up here.
    await probe('client.allColumns', () => db.client.findFirst());
    await probe('adminUser.isClinician', () => db.adminUser.findFirst({ select: { isClinician: true, competencies: true, googleRefreshToken: true } }));
    await probe('adminUser.allColumns', () => db.adminUser.findFirst());
    await probe('booking.practitioner+timing', () => db.booking.findFirst({ select: { practitionerId: true, startedAt: true, sopAcknowledgedAt: true } }));
    report.schema = checks;
    report.schemaInSync = Object.values(checks).every((v) => v === 'ok');

    // Secrets self-test: sign+login depend on a JWT secret and (for health
    // forms) the encryption keys. Report presence + a live round-trip so a
    // missing/invalid secret is diagnosable. Never reveals the secret values.
    const secrets: Record<string, unknown> = {
      hasAdminJwtSecret: Boolean(process.env.ADMIN_JWT_SECRET),
      hasClientJwtSecret: Boolean(process.env.CLIENT_JWT_SECRET),
      hasHealthEncryptionKey: Boolean(process.env.HEALTH_ENCRYPTION_KEY),
      hasHealthHmacKey: Boolean(process.env.HEALTH_HMAC_KEY),
    };
    try {
      const { SignJWT, jwtVerify } = await import('jose');
      const raw = process.env.CLIENT_JWT_SECRET || process.env.ADMIN_JWT_SECRET;
      if (!raw) throw new Error('no JWT secret set (ADMIN_JWT_SECRET / CLIENT_JWT_SECRET)');
      // Mirror lib/auth's key normalisation (>=32 bytes for HS256).
      const bytes = new TextEncoder().encode(raw);
      let key = bytes;
      if (bytes.length < 32) { const o = new Uint8Array(32); for (let i = 0; i < 32; i++) o[i] = bytes[i % bytes.length]; key = o; }
      secrets.jwtSecretBytes = bytes.length;
      const token = await new SignJWT({ t: 1 }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1m').sign(key);
      await jwtVerify(token, key);
      secrets.jwtSelfTest = 'ok';
    } catch (e) {
      secrets.jwtSelfTest = `FAIL: ${(e as Error)?.message?.slice(0, 120)}`;
    }
    try {
      const { encryptJson, decryptJson } = await import('@/lib/crypto');
      const blob = encryptJson({ t: 1 });
      decryptJson(blob);
      secrets.encryptionSelfTest = 'ok';
    } catch (e) {
      secrets.encryptionSelfTest = `FAIL: ${(e as Error)?.message?.slice(0, 120)}`;
    }
    report.secrets = secrets;

    // Integration report (config booleans only — never secrets).
    try {
      const { getIntegrations } = await import('@/lib/integrations');
      report.integrations = (await getIntegrations()).map((i) => ({
        id: i.id, name: i.name, status: i.status,
        missing: i.envVars.filter((v) => !v.set && !v.optional).map((v) => v.name),
      }));
    } catch (e) {
      report.integrations = `error: ${(e as Error)?.message?.slice(0, 120)}`;
    }

    report.ok = true;
  } catch (err) {
    report.database = 'error';
    // Only reveal the underlying error to an authed caller.
    if (authed) report.error = (err as Error)?.message?.slice(0, 200) || 'unknown';
  }

  // PRJ-1034.2: cron heartbeats (cron_daily_last/cron_dispatch_last, written by
  // app/api/cron/daily + app/api/cron/dispatch) were only staleness-checked on
  // human-viewed admin pages (/admin/status, /admin/api-health) — never here,
  // so a silently-disabled or misconfigured cron went undetected indefinitely.
  // Reuse the same thresholds checkCron() already uses (lib/api-health.ts) so a
  // stale heartbeat fails this probe and rides the alert path below.
  let cronStale = false;
  if (report.ok && authed) {
    try {
      const { getCronStaleness } = await import('@/lib/api-health');
      const cron = await getCronStaleness();
      report.cron = {
        dailyLastRun: cron.daily?.toISOString() ?? null,
        dispatchLastRun: cron.dispatch?.toISOString() ?? null,
        dailyOk: cron.dailyOk,
        dispatchOk: cron.dispatchOk,
      };
      cronStale = cron.stale;
      if (cronStale) report.ok = false;
    } catch (e) {
      // Non-fatal — don't fail the whole health check if the heartbeat read itself errors oddly.
      report.cron = `error: ${(e as Error)?.message?.slice(0, 120)}`;
    }
  }

  // BLD-841: nothing scheduled this check before — a production outage was
  // only caught by a manual audit. The Vercel Cron entry in vercel.json now
  // hits this route every 5 minutes with CRON_SECRET; on failure, alert the
  // same way every other cron does (mirrors app/api/cron/daily/route.ts).
  if (!report.ok && authed) {
    const summary = `[kclinics health] check failed — database:${report.database} env:${report.env}${cronStale ? ' — cron heartbeat stale' : ''}`;
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureMessage(summary, 'error');
    } catch { /* Sentry not available — non-fatal */ }
    const webhookUrl = process.env.CRON_ALERT_WEBHOOK_URL;
    if (webhookUrl) {
      const body = JSON.stringify({ text: summary, ...report });
      fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
    }
  }

  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
