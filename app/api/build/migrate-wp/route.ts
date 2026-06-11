import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { crmEnabled } from '@/lib/crm';
import { extractSqlFromZip } from '@/lib/unzip-sql';
import { run as runClients } from '@/scripts/migrate-wp/migrate.mjs';
import { run as runHistory } from '@/scripts/migrate-wp/migrate-history.mjs';
import { run as runStaff } from '@/scripts/migrate-wp/migrate-staff.mjs';
import { run as runClinical } from '@/scripts/migrate-wp/migrate-clinical.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Token-authed runner for the WordPress data migration (BLD-187).
//
// The migration was designed to run from a laptop with `vercel env pull`, but
// the production secrets (DATABASE_URL, HEALTH_ENCRYPTION_KEY…) are marked
// "sensitive" in Vercel, which pulls as EMPTY values — nobody can export them.
// They do exist here at runtime, so this route runs the importers server-side:
// it inflates the committed dump (scripts/migrate-wp/*.zip, bundled via
// outputFileTracingIncludes) into /tmp and calls the importers IN-PROCESS
// (static imports, so the bundler resolves @prisma/client and friends exactly
// like the rest of the app — a spawned child has no node_modules to resolve
// against in a bundled function).
//
// Auth: BOARD_QUEUE_TOKEN — the same shared secret as /api/build/queue (the
// established channel for unattended routine operations). The importers print
// counts only (no PII) and are idempotent/repair-safe by design; every commit
// run is written to the audit log.

const STEPS: Record<string, (o: { file: string; commit?: boolean; repair?: boolean; log?: (...a: unknown[]) => void }) => Promise<unknown>> = {
  clients: runClients,
  history: runHistory,
  staff: runStaff,
  clinical: runClinical,
};

const DUMP_ZIP = '127_0_0_1.sql.zip';
const TMP_SQL = '/tmp/migrate-wp/dump.sql';

function tokenOk(req: Request): boolean {
  const secret = process.env.BOARD_QUEUE_TOKEN;
  if (!secret) return false;
  const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!provided || provided.length !== secret.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret)); } catch { return false; }
}

async function ensureDump(): Promise<{ bytes: number; cached: boolean }> {
  if (fs.existsSync(TMP_SQL)) return { bytes: fs.statSync(TMP_SQL).size, cached: true };
  const zip = path.join(process.cwd(), 'scripts/migrate-wp', DUMP_ZIP);
  const partial = `${TMP_SQL}.partial-${process.pid}`;
  const r = await extractSqlFromZip(zip, partial);
  if (!fs.existsSync(TMP_SQL)) fs.renameSync(partial, TMP_SQL); // atomic vs concurrent extraction
  else fs.rmSync(partial, { force: true });
  return { bytes: r.bytes, cached: false };
}

export async function GET(req: Request) {
  if (process.env.VERCEL_ENV === 'production') return NextResponse.json({ ok: false, error: 'Migration endpoint disabled in production.' }, { status: 403 });
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });
  if (!tokenOk(req)) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  const zip = path.join(process.cwd(), 'scripts/migrate-wp', DUMP_ZIP);
  return NextResponse.json({
    ok: true,
    steps: Object.keys(STEPS),
    dumpZipBundled: fs.existsSync(zip),
    dumpExtracted: fs.existsSync(TMP_SQL),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL || process.env.POSTGRES_URL),
    hasHealthKey: Boolean(process.env.HEALTH_ENCRYPTION_KEY),
  });
}

export async function POST(req: Request) {
  if (process.env.VERCEL_ENV === 'production') return NextResponse.json({ ok: false, error: 'Migration endpoint disabled in production.' }, { status: 403 });
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });
  if (!process.env.BOARD_QUEUE_TOKEN) return NextResponse.json({ ok: false, error: 'Queue token not configured.' }, { status: 503 });
  if (!tokenOk(req)) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const step = String(b.step || '');
  const commit = b.commit === true;
  const repair = b.repair === true;
  const runStep = STEPS[step];
  if (!runStep) return NextResponse.json({ ok: false, error: `step must be one of: ${Object.keys(STEPS).join(', ')}` }, { status: 400 });

  if (commit && !(process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL || process.env.POSTGRES_URL)) {
    return NextResponse.json({ ok: false, error: 'No database URL is available in this runtime.' }, { status: 500 });
  }
  if (commit && step === 'clinical' && !process.env.HEALTH_ENCRYPTION_KEY) {
    return NextResponse.json({ ok: false, error: 'HEALTH_ENCRYPTION_KEY is not available — refusing to import clinical data with a fallback key.' }, { status: 500 });
  }

  let dump;
  try { dump = await ensureDump(); } catch (e) {
    return NextResponse.json({ ok: false, error: `Could not extract the dump: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }

  const lines: string[] = [];
  const log = (...a: unknown[]) => { lines.push(a.map((x) => String(x)).join(' ')); };
  let ok = true;
  let error: string | undefined;
  let result: unknown;
  try {
    result = await runStep({ file: TMP_SQL, commit, repair, log });
  } catch (e) {
    ok = false;
    error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}`.slice(0, 4000) : String(e);
  }

  if (commit) {
    try {
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'DATA_IMPORTED', actor: 'routine', summary: `WordPress migration (BLD-187): step "${step}" commit${repair ? ' + repair' : ''} → ${ok ? 'ok' : 'FAILED'}` });
    } catch { /* audit is best-effort */ }
  }

  return NextResponse.json({ ok, step, commit, repair, dumpBytes: dump.bytes, dumpCached: dump.cached, result: result ?? null, ...(error ? { error } : {}), output: lines.join('\n').slice(-60_000) });
}
