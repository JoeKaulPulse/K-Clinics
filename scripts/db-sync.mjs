// Prebuild DB sync. On a server deploy (Vercel) where a Postgres connection is
// available and we are NOT doing the static GitHub Pages export, sync the Prisma
// schema so the database always matches the code. Skipped for the Pages build
// and any environment without a database.
//
// TWO MODES — select via environment variable:
//
//   USE_MIGRATIONS=true  (recommended for production once a baseline exists)
//     Uses `prisma migrate deploy` against the versioned migrations in
//     prisma/migrations/. Applies only pending migrations; never destructive;
//     safe for concurrent deploys. Requires the baseline migration to have been
//     created via `npx prisma migrate dev --name init` on a copy of the prod
//     schema. See prisma/migrations/README.md.
//
//   USE_MIGRATIONS unset (current default — migrate when ready)
//     Uses `prisma db push` — fast for prototyping but requires the database to
//     accept schema drift without migration history. The --accept-data-loss flag
//     is NEVER passed here; if Prisma reports a destructive change you must
//     handle it explicitly (add a migration, backfill data, then push the safe
//     version). The prior --accept-data-loss usage has been removed as it could
//     silently drop columns or tables in production.
//
// OWNER ACTION: when you are ready to switch to safe versioned migrations:
//   1. Run `npx prisma migrate dev --name init` against a copy of the live DB
//      (this creates prisma/migrations/TIMESTAMP_init/migration.sql)
//   2. Commit the new prisma/migrations/ directory
//   3. Set USE_MIGRATIONS=true in Vercel environment variables
//   That's it — all future schema changes go through `prisma migrate dev`
//   locally and `prisma migrate deploy` in CI/CD.
//
// `prisma db push` needs a DIRECT postgres:// connection (not a pooled PgBouncer
// URL, and NOT a Prisma Accelerate `prisma+postgres://` URL). Vercel's Postgres
// integration exposes several env vars — we pick a direct one, preferring the
// non-pooling variants.
import { execSync } from 'node:child_process';
import { Pool } from 'pg';

const isPages = process.env.GHPAGES === 'true';

// One-time migration-baseline detection. A database originally built by
// `prisma db push` has the full schema but the `0_init` baseline is NOT recorded
// as applied, so the first `migrate deploy` would try to run 0_init and fail on
// already-existing tables. We detect that (schema present, baseline not recorded)
// and `migrate resolve --applied 0_init` it — which records the baseline WITHOUT
// running its DDL. On a genuinely empty database (no schema) we skip, so
// `migrate deploy` runs 0_init normally and builds the schema.
//
// NB we key off "is 0_init recorded?", not "does _prisma_migrations exist?": a
// `migrate deploy` run with no migration files (e.g. enabling USE_MIGRATIONS
// before the migration files are merged) creates an EMPTY _prisma_migrations
// table, which must NOT be mistaken for an established history.
async function probeBaselineState(connectionString) {
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 5_000 });
  try {
    // "Tenant" is a sentinel app table (PascalCase, quoted); _prisma_migrations is
    // lower-case. to_regclass returns NULL when the table is absent.
    const meta = await pool.query(`SELECT to_regclass('public."Tenant"') AS sentinel, to_regclass('public._prisma_migrations') AS migtable`);
    const schemaPresent = Boolean(meta.rows[0]?.sentinel);
    const migTableExists = Boolean(meta.rows[0]?.migtable);
    let baselineApplied = false;
    if (migTableExists) {
      const r = await pool.query(
        `SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '0_init' AND finished_at IS NOT NULL AND rolled_back_at IS NULL LIMIT 1`,
      );
      baselineApplied = (r.rowCount ?? 0) > 0;
    }
    return { schemaPresent, baselineApplied };
  } finally {
    await pool.end().catch(() => {});
  }
}

function pickDirectUrl() {
  const candidates = [
    process.env.POSTGRES_URL_NON_POOLING, // Vercel/Neon direct connection
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_PRISMA_URL,      // includes ?pgbouncer — still postgres://
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
  ].filter(Boolean);
  // Only use real postgres connections (skip Prisma Accelerate prisma+postgres://).
  return candidates.find((u) => /^postgres(ql)?:\/\//.test(u)) || null;
}

const dbUrl = pickDirectUrl();
const useMigrations = process.env.USE_MIGRATIONS === 'true';

// Defined up here (not lower down) so the USE_MIGRATIONS retry/backoff below can
// call it — a `const` is in the temporal dead zone until its declaration, so the
// previous definition further down threw a ReferenceError on the first retry.
const sleep = (s) => { try { execSync(`sleep ${s}`); } catch { /* non-posix shell */ } };

// Opt-in: decouple deploy success from DB liveness. When set, a schema sync that
// can't reach the database warns and lets the build proceed (a code-only deploy
// isn't blocked by a briefly-unreachable DB) instead of failing. Default stays
// fail-fast so we never knowingly ship code ahead of the schema.
const nonfatal = process.env.DB_SYNC_NONFATAL === 'true';
function failBuild(msg) {
  console.error(msg);
  if (nonfatal) { console.warn('[db-sync] DB_SYNC_NONFATAL=true — proceeding without a confirmed schema sync.'); process.exit(0); }
  process.exit(1);
}

if (isPages || !dbUrl) {
  console.log(`[db-sync] skipped (${isPages ? 'GitHub Pages static export' : 'no direct postgres:// URL found'})`);
  process.exit(0);
}

// Only the PRODUCTION deploy syncs schema. Preview/development builds may point at
// the production database (shared DB), so they must NEVER mutate its schema — via
// either `prisma migrate deploy` OR `prisma db push`. They skip schema sync
// entirely; production is the single schema writer. (Local / non-Vercel runs, where
// VERCEL_ENV is unset, are allowed so the schema can be synced manually.)
const vercelEnv = process.env.VERCEL_ENV;
if (vercelEnv && vercelEnv !== 'production') {
  console.log(`[db-sync] '${vercelEnv}' deploy — skipping schema sync (production is the only schema writer).`);
  process.exit(0);
}

if (useMigrations) {
  // ── SAFE PATH: versioned migrations ────────────────────────────────────────
  // `prisma migrate deploy` applies only the pending .sql files in
  // prisma/migrations/. It never drops data and never requires --accept-data-loss.
  const env = { ...process.env, DATABASE_URL: dbUrl };

  // Adopt the existing schema as the baseline on the first migrations deploy (see
  // probeBaselineState). Best-effort: any failure here just falls through to
  // migrate deploy, which will surface a clear error if a baseline really was needed.
  try {
    const { schemaPresent, baselineApplied } = await probeBaselineState(dbUrl);
    if (schemaPresent && !baselineApplied) {
      console.log('[db-sync] existing schema, baseline 0_init not yet recorded — adopting it (resolve --applied 0_init, no DDL run)…');
      try {
        execSync('npx prisma migrate resolve --applied 0_init', { stdio: 'inherit', env });
      } catch (e) {
        console.warn('[db-sync] baseline resolve did not apply (may already be baselined):', e?.message || e);
      }
    } else if (baselineApplied) {
      console.log('[db-sync] baseline 0_init already recorded — skipping adoption.');
    } else {
      console.log('[db-sync] empty database — migrate deploy will create the schema from 0_init.');
    }
  } catch (e) {
    console.warn('[db-sync] baseline probe failed (continuing to migrate deploy):', e?.message || e);
  }

  const ATTEMPTS = 5;
  const BACKOFF = [15, 30, 45, 60];
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      console.log(`[db-sync] prisma migrate deploy — applying pending migrations (attempt ${attempt}/${ATTEMPTS})…`);
      execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
      console.log('[db-sync] migrations applied successfully.');
      process.exit(0);
    } catch (err) {
      console.error(`[db-sync] migrate deploy attempt ${attempt}/${ATTEMPTS} failed:`, err?.message || err);
      if (attempt < ATTEMPTS) { const wait = BACKOFF[attempt - 1] || 60; console.error(`[db-sync] retrying in ${wait}s…`); sleep(wait); }
    }
  }
  failBuild('[db-sync] FATAL: could not apply migrations after retries.');
}

const env = { ...process.env, DATABASE_URL: dbUrl };

// Fast path: confirm whether the live schema already matches the code. This is
// the common case for code-only deploys and lets us skip the migration push
// entirely — important on Prisma Postgres, where the `prisma_migration` role has
// a small connection cap that several near-simultaneous deploys can exhaust.
//
// The pre-check itself needs a migration connection, so under that exact
// pressure it can fail too — we RETRY it with backoff. As soon as one attempt
// gets through and reports "in sync", we're done without ever opening the
// heavier push. We only fall through to a push if we positively detect drift
// (exit code 2) or never get a definitive answer.
const DIFF_ATTEMPTS = 6;
const DIFF_BACKOFF = [5, 10, 20, 30, 45]; // seconds between pre-check attempts
// Prisma 7 removed `--from-url` and renamed `--to-schema-datamodel`. The live DB
// URL now comes from prisma.config.ts (which reads DATABASE_URL — injected below
// into `env`), selected with `--from-config-datasource`; the code datamodel is
// `--to-schema`. Same semantics as before: exit 0 = in sync, exit 2 = drift.
const diffCmd = `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`;

let drift = false;
for (let attempt = 1; attempt <= DIFF_ATTEMPTS; attempt++) {
  try {
    execSync(diffCmd, { stdio: 'pipe', env });
    // Exit 0 → no difference → already in sync; nothing to do.
    console.log('[db-sync] schema already in sync — skipping push.');
    process.exit(0);
  } catch (err) {
    if (err?.status === 2) {
      // Exit 2 → a real schema difference; push is needed.
      console.log('[db-sync] schema drift detected — will push.');
      drift = true;
      break;
    }
    // Any other failure (typically exit 1) → couldn't reach the database, most
    // likely the migration role is momentarily out of connections. Retry; the
    // pressure usually clears within a few seconds once other deploys finish.
    console.log(`[db-sync] pre-check could not reach the database (attempt ${attempt}/${DIFF_ATTEMPTS})${attempt < DIFF_ATTEMPTS ? ' — retrying…' : ''}`);
    if (attempt < DIFF_ATTEMPTS) sleep(DIFF_BACKOFF[attempt - 1] || 45);
  }
}

// We only reach here to push — either drift was detected, or the pre-check could
// never connect (in which case a push is the source of truth before we give up).
if (!drift) console.log('[db-sync] pre-check inconclusive after retries — attempting a push to confirm.');

// Sync the schema, retrying with generous backoff to ride out the migration
// role's connection limit. If it STILL can't sync, FAIL the build — better to
// keep the last good deploy than to ship code ahead of the database.
const ATTEMPTS = 5;
const BACKOFF = [15, 30, 45, 60]; // seconds between attempts

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  try {
    console.log(`[db-sync] prisma db push — syncing schema (attempt ${attempt}/${ATTEMPTS})…`);
    // --accept-data-loss is intentionally omitted. If Prisma reports a destructive
    // change (column drop, table drop, type change) the push fails and the build
    // fails — which is correct. Handle destructive changes explicitly with a
    // backfill migration and only push the safe final state, or switch to
    // USE_MIGRATIONS=true + versioned migrations (see top-of-file comments).
    //
    // Prisma 7 removed `--skip-generate` (db push no longer generates the client —
    // that is decoupled). The client is already generated by the `prisma generate`
    // postinstall before this runs, so no flag is needed. The datasource URL comes
    // from prisma.config.ts, which reads the DATABASE_URL injected into `env`.
    execSync('npx prisma db push', { stdio: 'inherit', env });
    console.log('[db-sync] done.');
    process.exit(0);
  } catch (err) {
    console.error(`[db-sync] attempt ${attempt}/${ATTEMPTS} failed:`, err?.message || err);
    if (attempt < ATTEMPTS) {
      const wait = BACKOFF[attempt - 1] || 60;
      console.error(`[db-sync] retrying in ${wait}s…`);
      sleep(wait);
    }
  }
}

failBuild(
  '[db-sync] FATAL: could not sync the schema after retries. Failing the build so we never deploy code ahead of the database. ' +
  'Check the database is reachable (e.g. not suspended) and redeploy.',
);
