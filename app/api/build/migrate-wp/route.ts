import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { crmEnabled } from '@/lib/crm';
import { extractSqlFromZip } from '@/lib/unzip-sql';

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
// outputFileTracingIncludes) into /tmp and spawns the import scripts unchanged.
//
// Auth: BOARD_QUEUE_TOKEN — the same shared secret as /api/build/queue (the
// established channel for unattended routine operations). The importers print
// counts only (no PII) and are idempotent/repair-safe by design; every commit
// run is written to the audit log.

const STEPS: Record<string, string> = {
  clients: 'migrate.mjs',
  history: 'migrate-history.mjs',
  staff: 'migrate-staff.mjs',
  clinical: 'migrate-clinical.mjs',
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
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });
  if (!tokenOk(req)) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  const zip = path.join(process.cwd(), 'scripts/migrate-wp', DUMP_ZIP);
  return NextResponse.json({
    ok: true,
    steps: Object.keys(STEPS),
    dumpZipBundled: fs.existsSync(zip),
    dumpExtracted: fs.existsSync(TMP_SQL),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
    hasHealthKey: Boolean(process.env.HEALTH_ENCRYPTION_KEY),
  });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });
  if (!process.env.BOARD_QUEUE_TOKEN) return NextResponse.json({ ok: false, error: 'Queue token not configured.' }, { status: 503 });
  if (!tokenOk(req)) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const step = String(b.step || '');
  const commit = b.commit === true;
  const repair = b.repair === true;
  const script = STEPS[step];
  if (!script) return NextResponse.json({ ok: false, error: `step must be one of: ${Object.keys(STEPS).join(', ')}` }, { status: 400 });

  const env = { ...process.env } as NodeJS.ProcessEnv;
  if (!env.DATABASE_URL && env.POSTGRES_URL) env.DATABASE_URL = env.POSTGRES_URL;
  if (commit && !env.DATABASE_URL) return NextResponse.json({ ok: false, error: 'DATABASE_URL is not available in this runtime.' }, { status: 500 });
  if (commit && step === 'clinical' && !env.HEALTH_ENCRYPTION_KEY) {
    return NextResponse.json({ ok: false, error: 'HEALTH_ENCRYPTION_KEY is not available — refusing to import clinical data with a fallback key.' }, { status: 500 });
  }

  let dump;
  try { dump = await ensureDump(); } catch (e) {
    return NextResponse.json({ ok: false, error: `Could not extract the dump: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }

  const args = [path.join(process.cwd(), 'scripts/migrate-wp', script), '--file', TMP_SQL, commit ? '--commit' : '--dry-run'];
  if (repair && (step === 'history' || step === 'clinical')) args.push('--repair');
  const r = spawnSync(process.execPath, args, { cwd: process.cwd(), env, timeout: 270_000, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' });
  const output = `${r.stdout || ''}${r.stderr ? `\n--- stderr ---\n${r.stderr}` : ''}`.slice(-60_000);

  if (commit) {
    try {
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'DATA_IMPORTED', actor: 'routine', summary: `WordPress migration (BLD-187): step "${step}" commit${repair ? ' + repair' : ''} → exit ${r.status}` });
    } catch { /* audit is best-effort */ }
  }

  return NextResponse.json({ ok: r.status === 0, step, commit, repair, exitCode: r.status, dumpBytes: dump.bytes, dumpCached: dump.cached, output });
}
