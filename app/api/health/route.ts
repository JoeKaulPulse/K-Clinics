import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lightweight health probe for diagnosing the live deployment. Visit
// /api/health to confirm the server can reach the database and the schema is
// present. Never exposes secrets — only booleans/counts.
export async function GET() {
  const report: Record<string, unknown> = {
    ok: false,
    crmEnabled:
      process.env.NEXT_PUBLIC_CRM_ENABLED === 'true' ||
      process.env.CRM_ENABLED === 'true' ||
      Boolean(process.env.DATABASE_URL),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasPostgresUrl: Boolean(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL),
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
  };

  try {
    const { db } = await import('@/lib/db');
    // Cheap query that proves connectivity + that the Client table exists.
    const clients = await db.client.count();
    report.database = 'connected';
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

    report.ok = true;
  } catch (err) {
    report.database = 'error';
    report.error = (err as Error)?.message?.slice(0, 200) || 'unknown';
  }

  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
