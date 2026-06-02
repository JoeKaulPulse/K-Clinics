// One-command WordPress import. Finds your dump, reads your secrets from a file
// (so you don't paste them), and runs all three steps in order.
//
//   PREVIEW (safe, writes nothing):   node scripts/migrate-wp/import-all.mjs
//   GO LIVE (writes to the database):  node scripts/migrate-wp/import-all.mjs --commit
//
// Secrets: create scripts/migrate-wp/.env (git-ignored) with at least:
//     DATABASE_URL="postgresql://…"          ← your production database URL
//     HEALTH_ENCRYPTION_KEY="…"              ← same value as Vercel (for clinical)
//     HEALTH_HMAC_KEY="…"                    ← optional, if set in Vercel
// Tip: `vercel env pull scripts/migrate-wp/.env` fills these in automatically.
//
// Dump: drop full-dump.sql into scripts/migrate-wp/data/ (auto-detected), or pass
//       --file <path>.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const commit = args.includes('--commit');
const refresh = args.includes('--refresh'); // re-derive & overwrite messy names on the clients step
const fileArg = (() => { const i = args.indexOf('--file'); return i >= 0 ? args[i + 1] : null; })();

// ── load secrets from the first .env-style file we find (without overriding
//    anything already set in the real environment) ───────────────────────────
function loadEnv(file) {
  if (!fs.existsSync(file)) return false;
  for (let line of fs.readFileSync(file, 'utf8').split('\n')) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trim();
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (key && !(key in process.env)) process.env[key] = val;
  }
  return true;
}
const repoRoot = path.resolve(here, '../..');
let envFrom = null;
for (const f of [path.join(here, '.env'), path.join(repoRoot, '.env.production.local'), path.join(repoRoot, '.env.production'), path.join(repoRoot, '.env.local'), path.join(repoRoot, '.env')]) {
  if (loadEnv(f)) { envFrom = f; break; }
}

// ── find the dump ─────────────────────────────────────────────────────────────
let dump = fileArg;
if (!dump) {
  const dataDir = path.join(here, 'data');
  const sqls = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter((f) => f.endsWith('.sql')) : [];
  if (sqls.includes('full-dump.sql')) dump = path.join(dataDir, 'full-dump.sql');
  else if (sqls.length) dump = path.join(dataDir, sqls[0]);
}

const bar = '━'.repeat(60);
console.log(`\n${bar}\n  KClinics WordPress import — ${commit ? '🟢 COMMIT (writing to the database)' : '🔍 PREVIEW (writes nothing)'}\n${bar}`);
if (envFrom) console.log(`  secrets: loaded from ${path.relative(repoRoot, envFrom)}`);

if (!dump || !fs.existsSync(dump)) {
  console.error(`\n✖ Couldn't find your dump.\n  Drop full-dump.sql into scripts/migrate-wp/data/ (or pass --file <path>).`);
  process.exit(1);
}
console.log(`  dump:    ${path.relative(repoRoot, dump)}`);

// ── plan the steps ────────────────────────────────────────────────────────────
const steps = [
  { label: 'Clients', script: 'migrate.mjs' },
  { label: 'History — bookings, reviews, loyalty', script: 'migrate-history.mjs' },
  { label: 'Clinical — consents, skin-quiz, care plans (encrypted)', script: 'migrate-clinical.mjs' },
];

if (commit) {
  if (!process.env.DATABASE_URL) {
    console.error(`\n✖ DATABASE_URL is not set. Add it to scripts/migrate-wp/.env (or run \`vercel env pull scripts/migrate-wp/.env\`) and try again.`);
    process.exit(1);
  }
  if (!process.env.HEALTH_ENCRYPTION_KEY) {
    console.warn(`\n⚠ HEALTH_ENCRYPTION_KEY is not set — the clinical step will be SKIPPED (otherwise records couldn't be decrypted in the app).`);
    console.warn(`  Set it (same value as Vercel) and re-run to import clinical data.`);
    steps.pop(); // drop clinical
  }
}

// ── run ─────────────────────────────────────────────────────────────────────
for (const { label, script } of steps) {
  console.log(`\n${bar}\n  ▶ ${label}\n${bar}`);
  const stepArgs = [path.join(here, script), '--file', dump, commit ? '--commit' : '--dry-run'];
  if (refresh && script === 'migrate.mjs') stepArgs.push('--refresh');
  const r = spawnSync(process.execPath, stepArgs, { stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    console.error(`\n✖ "${label}" failed (exit ${r.status}). Stopping — nothing further was run.`);
    process.exit(r.status || 1);
  }
}

console.log(`\n${bar}`);
if (commit) {
  console.log(`  ✅ Import complete. Refresh the admin client list.`);
} else {
  console.log(`  ✅ Preview done — nothing was written.`);
  console.log(`  To import for real:  node scripts/migrate-wp/import-all.mjs --commit`);
}
console.log(`${bar}\n`);
