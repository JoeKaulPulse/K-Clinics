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

// Sync the schema, retrying a few times to ride out a transient DB blip. If it
// STILL can't reach the database, FAIL the build — better to keep the last good
// deploy than to ship code whose Prisma client expects schema the database
// doesn't have (which silently breaks the app once the DB is back).
const ATTEMPTS = 3;
const sleep = (s) => { try { execSync(`sleep ${s}`); } catch { /* non-posix shell */ } };

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  try {
    console.log(`[db-sync] prisma db push — syncing schema (attempt ${attempt}/${ATTEMPTS})…`);
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    console.log('[db-sync] done.');
    process.exit(0);
  } catch (err) {
    console.error(`[db-sync] attempt ${attempt}/${ATTEMPTS} failed:`, err?.message || err);
    if (attempt < ATTEMPTS) {
      const wait = attempt * 5; // 5s, then 10s
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
