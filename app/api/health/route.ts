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
    report.ok = true;
  } catch (err) {
    report.database = 'error';
    report.error = (err as Error)?.message?.slice(0, 200) || 'unknown';
  }

  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
