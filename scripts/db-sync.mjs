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
const diffCmd = `npx prisma migrate diff --from-url "${dbUrl}" --to-schema-datamodel prisma/schema.prisma --exit-code`;

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
