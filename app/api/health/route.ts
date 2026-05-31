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

    report.ok = true;
  } catch (err) {
    report.database = 'error';
    report.error = (err as Error)?.message?.slice(0, 200) || 'unknown';
  }

  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
