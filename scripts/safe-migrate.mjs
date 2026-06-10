#!/usr/bin/env node
// Safe migration helper for local development. Wraps `prisma migrate dev` with
// guards: confirms you want to proceed, shows the diff first, and creates a
// named Neon branch snapshot before applying (if NEON_API_KEY + NEON_PROJECT_ID
// are set). Use for any schema change that might affect production data.
//
// Usage:
//   node scripts/safe-migrate.mjs --name add_consultation_notes
//   node scripts/safe-migrate.mjs --name add_consultation_notes --dry-run

import { execSync } from 'node:child_process';
import readline from 'node:readline';

const args = process.argv.slice(2);
const nameIdx = args.indexOf('--name');
const dryRun = args.includes('--dry-run');
const name = nameIdx >= 0 ? args[nameIdx + 1] : null;

if (!name) {
  console.error('Usage: node scripts/safe-migrate.mjs --name <migration_name> [--dry-run]');
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !/^postgres(ql)?:\/\//.test(dbUrl)) {
  console.error('[safe-migrate] DATABASE_URL must be a direct postgres:// connection.');
  process.exit(1);
}

console.log('\n[safe-migrate] Checking schema diff…\n');

// Show what would change. Prisma 7: `--from-url` was removed and
// `--to-schema-datamodel` renamed to `--to-schema`; the live DB URL is read from
// prisma.config.ts (which reads DATABASE_URL, already set in this env) via
// `--from-config-datasource`.
try {
  execSync(
    `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`,
    { stdio: 'inherit' },
  );
} catch {
  // migrate diff exits non-zero when there are differences — that's expected.
}

if (dryRun) {
  console.log('\n[safe-migrate] Dry run — no migration created.\n');
  process.exit(0);
}

// Confirm.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await new Promise((resolve) => {
  rl.question(`\n[safe-migrate] Create migration "${name}" and apply to DATABASE_URL? [y/N] `, (ans) => {
    rl.close();
    if (ans.toLowerCase() !== 'y') { console.log('Aborted.'); process.exit(0); }
    resolve();
  });
});

// Optional: create a Neon branch snapshot for easy rollback.
const neonApiKey = process.env.NEON_API_KEY;
const neonProject = process.env.NEON_PROJECT_ID;
if (neonApiKey && neonProject) {
  const branchName = `pre-migration-${name}-${Date.now()}`;
  console.log(`\n[safe-migrate] Creating Neon snapshot branch "${branchName}"…`);
  try {
    execSync(
      `curl -s -X POST "https://console.neon.tech/api/v2/projects/${neonProject}/branches" ` +
      `-H "Authorization: Bearer ${neonApiKey}" -H "Content-Type: application/json" ` +
      `-d '{"branch":{"name":"${branchName}"}}'`,
      { stdio: 'pipe' },
    );
    console.log(`[safe-migrate] Snapshot branch created — restore with: neon branches restore ${branchName}`);
  } catch (e) {
    console.warn('[safe-migrate] Could not create Neon snapshot (continuing):', e?.message);
  }
}

// Apply the migration.
console.log(`\n[safe-migrate] Running: prisma migrate dev --name ${name}\n`);
execSync(`npx prisma migrate dev --name ${name}`, { stdio: 'inherit' });
console.log('\n[safe-migrate] Done. Commit the new migration file in prisma/migrations/\n');
