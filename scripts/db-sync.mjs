// Prebuild DB sync. On a server deploy (Vercel) where DATABASE_URL is set and we
// are NOT doing the static GitHub Pages export, push the Prisma schema so the
// database always matches the code. Skipped (no-op) for the Pages build and any
// environment without a database, so it can never break those builds.
import { execSync } from 'node:child_process';

const isPages = process.env.GHPAGES === 'true';
const hasDb = !!process.env.DATABASE_URL;

if (isPages || !hasDb) {
  console.log(`[db-sync] skipped (${isPages ? 'GitHub Pages static export' : 'no DATABASE_URL'})`);
  process.exit(0);
}

try {
  console.log('[db-sync] prisma db push — syncing schema to the database…');
  execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
  console.log('[db-sync] done.');
} catch (err) {
  console.error('[db-sync] FAILED:', err?.message || err);
  // Fail the build so a broken/unmigrated DB never ships silently.
  process.exit(1);
}
