// ClinicOS Ring 1 precondition verifier (BLD-301) — READ ONLY.
//
// Run on a machine that can reach the production database (or a prod snapshot /
// Neon branch — never the read-write prod URL for casual checks; a read-only role
// is ideal):
//
//   DATABASE_URL='postgres://…' node scripts/verify-tenant-backfill.mjs
//
// It confirms it is SAFE to apply prisma/platform-migrations/ring1/*.sql:
//   1. every Academy table has ZERO rows with a NULL tenantId  → NOT NULL is safe
//   2. no rows would violate the new per-tenant unique indexes → @@unique is safe
//
// It performs only SELECTs. Exit code 0 = all green (safe to proceed); 1 = a
// blocker was found (do NOT apply the Ring 1 constraints yet); 2 = could not run.
//
// Note: this opens its OWN Prisma client (scripts/migrate-wp/lib-db.mjs), which
// does NOT carry the tenant-scope extension from lib/db.ts, and it uses raw SQL —
// so the counts below are the true, unscoped table totals.

import { openDb } from './migrate-wp/lib-db.mjs';

// Kept in lock-step with ACADEMY_TENANT_MODELS (lib/tenant-scope.ts) and the
// backfill in lib/tenant.ts. Table names are the Prisma model names verbatim
// (no @@map), so they are case-sensitive and must be double-quoted in SQL.
const TABLES = [
  'AcademyStudent', 'StudentPasskey', 'Course', 'CourseModule', 'Lesson',
  'HomeworkSubmission', 'Quiz', 'QuizQuestion', 'LessonProgress', 'QuizAttempt',
  'ExamQuestion', 'PastPaper', 'PracticeAttempt', 'PointEvent', 'StudentBadge',
  'DailyActivity', 'LiveClass', 'Cohort', 'Enrolment', 'FundingApplication',
  'Vacancy', 'JobApplication',
];

// Columns that move from a global unique to a per-tenant composite unique.
const COMPOSITE_UNIQUES = [
  { table: 'AcademyStudent', cols: ['tenantId', 'email'] },
  { table: 'Course', cols: ['tenantId', 'slug'] },
  { table: 'Vacancy', cols: ['tenantId', 'slug'] },
];

const num = (v) => (typeof v === 'bigint' ? Number(v) : Number(v ?? 0));

async function main() {
  const db = await openDb();
  let blockers = 0;

  console.log('ClinicOS Ring 1 backfill verifier (BLD-301) — read only\n');

  console.log('1. NULL tenantId (must be 0 in every table before SET NOT NULL):');
  for (const t of TABLES) {
    try {
      const rows = await db.$queryRawUnsafe(`SELECT count(*) AS n FROM "${t}" WHERE "tenantId" IS NULL`);
      const n = num(rows[0]?.n);
      if (n > 0) { blockers++; console.log(`   ✗ ${t}: ${n} NULL`); }
      else console.log(`   ✓ ${t}`);
    } catch (e) {
      blockers++;
      console.log(`   ✗ ${t}: query failed — ${e?.message || e}`);
    }
  }

  console.log('\n2. Duplicate (tenantId, …) groups (must be 0 before the composite unique):');
  for (const u of COMPOSITE_UNIQUES) {
    const colList = u.cols.map((c) => `"${c}"`).join(', ');
    try {
      const rows = await db.$queryRawUnsafe(
        `SELECT count(*) AS n FROM (SELECT ${colList} FROM "${u.table}" GROUP BY ${colList} HAVING count(*) > 1) d`,
      );
      const n = num(rows[0]?.n);
      if (n > 0) { blockers++; console.log(`   ✗ ${u.table} (${u.cols.join(', ')}): ${n} duplicate group(s)`); }
      else console.log(`   ✓ ${u.table} (${u.cols.join(', ')})`);
    } catch (e) {
      blockers++;
      console.log(`   ✗ ${u.table}: query failed — ${e?.message || e}`);
    }
  }

  await db.$disconnect().catch(() => {});

  if (blockers === 0) {
    console.log('\n✅ ALL GREEN — preconditions met. prisma/platform-migrations/ring1/0001 is safe to promote.');
    console.log('   (0002 RLS still needs the app-side GUC plumbing first — see that file.)');
    process.exit(0);
  }
  console.log(`\n❌ ${blockers} blocker(s). Do NOT apply the Ring 1 constraints yet.`);
  console.log('   Re-run the cron backfill (lib/tenant.ts backfillAcademyTenantIfNeeded) / de-duplicate, then re-check.');
  process.exit(1);
}

main().catch((e) => { console.error('verifier could not run:', e?.message || e); process.exit(2); });
