// Reference-data seeds (rooms, services, catalogue, academy, LMS). These are
// idempotent top-ups, and the live database already holds this data — so they no
// longer run on every deploy (each one opened its own DB connection during the
// fragile deploy window, adding to the connection pressure that was crashing
// deploys). Run them deliberately instead:
//   • one-off deploy:  set SEED_ON_BUILD=true
//   • locally / ad-hoc: npm run db:seed:rooms (etc.)
import { execSync } from 'node:child_process';

if (process.env.SEED_ON_BUILD !== 'true') {
  console.log('[seeds] skipped on build (reference data already present). Set SEED_ON_BUILD=true for a deploy that needs to (re)seed, or run npm run db:seed:* manually.');
  process.exit(0);
}

for (const s of ['seed-rooms', 'seed-services', 'seed-catalogue', 'seed-academy', 'seed-lms']) {
  try {
    console.log(`[seeds] ${s}…`);
    execSync(`node scripts/${s}.mjs`, { stdio: 'inherit' });
  } catch (e) {
    console.error(`[seeds] ${s} failed (non-fatal):`, e?.message || e);
  }
}
