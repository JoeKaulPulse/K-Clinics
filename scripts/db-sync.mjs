// Prebuild DB sync. On a server deploy (Vercel) where a Postgres connection is
// available and we are NOT doing the static GitHub Pages export, push the Prisma
// schema so the database always matches the code. Skipped for the Pages build
// and any environment without a database.
//
// `prisma db push` needs a DIRECT postgres:// connection (not a pooled PgBouncer
// URL, and NOT a Prisma Accelerate `prisma+postgres://` URL). Vercel's Postgres
// integration exposes several env vars — we pick a direct one, preferring the
// non-pooling variants.
import { execSync } from 'node:child_process';

const isPages = process.env.GHPAGES === 'true';

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

if (isPages || !dbUrl) {
  console.log(`[db-sync] skipped (${isPages ? 'GitHub Pages static export' : 'no direct postgres:// URL found'})`);
  process.exit(0);
}

const env = { ...process.env, DATABASE_URL: dbUrl };
const sleep = (s) => { try { execSync(`sleep ${s}`); } catch { /* non-posix shell */ } };

// Fast path: if the database schema already matches the code, do NOTHING. This
// is the common case for code-only deploys, and it avoids opening a migration
// connection at all — which matters on Prisma Postgres, where the limited
// `prisma_migration` role can run out of connections when several deploys fire
// close together (a no-op push would otherwise fail the build for nothing).
try {
  execSync(`npx prisma migrate diff --from-url "${dbUrl}" --to-schema-datamodel prisma/schema.prisma --exit-code`, {
    stdio: 'pipe', env,
  });
  // Exit 0 → no difference → already in sync.
  console.log('[db-sync] schema already in sync — skipping push.');
  process.exit(0);
} catch (err) {
  if (err?.status === 2) {
    console.log('[db-sync] schema drift detected — pushing.');
  } else {
    // Couldn't determine (e.g. transient connection issue) — fall through and
    // let the push (with retries) be the source of truth.
    console.log('[db-sync] could not pre-check schema; will attempt push.');
  }
}

// Sync the schema, retrying with generous backoff to ride out the migration
// role's connection limit. If it STILL can't sync, FAIL the build — better to
// keep the last good deploy than to ship code ahead of the database.
const ATTEMPTS = 5;
const BACKOFF = [15, 30, 45, 60]; // seconds between attempts

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  try {
    console.log(`[db-sync] prisma db push — syncing schema (attempt ${attempt}/${ATTEMPTS})…`);
    execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit', env });
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

console.error(
  '[db-sync] FATAL: could not sync the schema after retries. Failing the build so we never deploy code ahead of the database. ' +
  'Check the database is reachable (e.g. not suspended) and redeploy.',
);
process.exit(1);
