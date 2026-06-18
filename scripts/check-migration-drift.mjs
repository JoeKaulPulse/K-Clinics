// CI guard — a change to prisma/schema.prisma that alters the DATAMODEL must ship
// with a new migration file. No database needed (pure datamodel diff + git).
//
// Why: with USE_MIGRATIONS=true the deploy runs `prisma migrate deploy`, which
// only applies migration FILES. If schema.prisma gains a column/table but no
// migration is committed, the live DB silently falls behind the code and every
// query touching the new field 500s at runtime. That is exactly what took
// /admin/bookings down (Booking.prepaid* added with no migration — BLD-399).
//
// This check compares the schema on the PR's merge-base against the schema here:
//  - identical datamodel (comments/formatting only) → pass
//  - datamodel changed AND a new prisma/migrations/<...>/migration.sql was added → pass
//  - datamodel changed AND no new migration → FAIL with the fix command
import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCHEMA = 'prisma/schema.prisma';
const MIGRATIONS = 'prisma/migrations';

const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const tryRun = (cmd) => {
  try { return { ok: true, status: 0, out: run(cmd) }; }
  catch (e) { return { ok: false, status: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}`.trim() }; }
};
const ok = (msg) => { console.log(`[check-migrations] ${msg}`); process.exit(0); };

// Make sure we have origin/main to diff against (CI checks out a shallow head).
tryRun('git fetch --no-tags --quiet origin main');
const base =
  tryRun('git merge-base origin/main HEAD').out ||
  tryRun('git rev-parse HEAD~1').out;
if (!base) ok('no base ref to compare against — skipping.');

// Did schema.prisma change in this range at all?
if (!tryRun(`git diff --name-only ${base} HEAD -- ${SCHEMA}`).out) ok('schema.prisma unchanged — ok.');

// Materialise the base schema to diff against (datamodel-only, no DB).
const baseSchema = tryRun(`git show ${base}:${SCHEMA}`);
if (!baseSchema.ok) ok('schema.prisma is new (baseline) — ok.');
const dir = mkdtempSync(join(tmpdir(), 'migguard-'));
const baseFile = join(dir, 'base.prisma');
writeFileSync(baseFile, `${baseSchema.out}\n`);

// `--exit-code`: 0 = datamodels identical, 2 = they differ, 1 = tool error.
const diff = tryRun(`npx prisma migrate diff --from-schema ${baseFile} --to-schema ${SCHEMA} --exit-code`);
if (diff.status === 0) ok('schema.prisma edit is non-structural (no datamodel change) — ok.');
if (diff.status !== 2) ok(`could not compute a datamodel diff (not blocking): ${diff.out.split('\n').pop()}`);

// Structural change → require a newly ADDED migration in this range.
const added = tryRun(`git diff --name-only --diff-filter=A ${base} HEAD -- ${MIGRATIONS}`).out
  .split('\n').filter((f) => f.endsWith('/migration.sql'));
if (added.length) ok(`structural schema change + ${added.length} new migration — ok:\n  ${added.join('\n  ')}`);

console.error(
  '\n[check-migrations] ✗ prisma/schema.prisma changed the datamodel but NO new migration was added.\n' +
  '\nThis is the class of change that took /admin/bookings down: the schema gained columns\n' +
  'the live database never received, because `prisma migrate deploy` only applies migration files.\n' +
  '\nFix: run\n    npx prisma migrate dev --name <describe_change>\n' +
  'then commit the new prisma/migrations/<timestamp>_<name>/ directory with this PR.\n' +
  '(If the edit really is non-structural, e.g. a comment, this guard will pass once rebased.)\n',
);
process.exit(1);
