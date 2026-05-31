// Prebuild DB sync. On a server deploy (Vercel) where DATABASE_URL is set and we
// are NOT doing the static GitHub Pages export, push the Prisma schema so the
// database always matches the code. Skipped (no-op) for the Pages build and any
// environment without a database.
//
// IMPORTANT: a push failure must NOT fail the build — we still want the app to
// deploy (and a transient DB issue shouldn't take the whole site down). We log
// loudly instead. Prisma `db push` is idempotent, so the next deploy retries.
import { execSync } from 'node:child_process';

const isPages = process.env.GHPAGES === 'true';
// Prefer a direct (non-pooled) URL for schema changes if provided.
const dbUrl =
  process.env.PRISMA_DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (isPages || !dbUrl) {
  console.log(`[db-sync] skipped (${isPages ? 'GitHub Pages static export' : 'no database URL'})`);
  process.exit(0);
}

try {
  console.log('[db-sync] prisma db push — syncing schema to the database…');
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
  console.log('[db-sync] done.');
} catch (err) {
  console.error('[db-sync] WARNING: schema sync failed — deploy continues. Error:', err?.message || err);
  // Do not fail the build.
  process.exit(0);
}
