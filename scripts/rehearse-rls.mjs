// ClinicOS Ring 1d — RLS rehearsal (BLD-301). Proves the tenant-isolation
// Row-Level Security policy + the per-transaction `app.tenant_id` GUC mechanism
// BEFORE any of it touches the live app.
//
//   DATABASE_URL='postgres://…' node scripts/rehearse-rls.mjs
//
// SAFE BY CONSTRUCTION: everything runs inside ONE transaction that is ALWAYS
// ROLLED BACK at the end — the RLS enable, the test tenants, the test rows, all
// undone. Nothing is committed, so even if pointed at prod it leaves no persistent
// change (it does briefly hold an ALTER-TABLE lock on the rehearsed tables, so a
// Neon branch is still strongly preferred). Use a branch.
//
// What it asserts (the isolation contract):
//   • GUC set to tenant A  → only A's rows are visible
//   • GUC set to tenant B  → only B's rows are visible
//   • GUC unset            → ZERO rows (deny-by-default)
// If any assertion fails, the RLS policy or the GUC mechanism is wrong — do not
// proceed to the app rollout.

import { Pool } from 'pg';

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!URL || !/^postgres(ql)?:\/\//.test(URL)) {
  console.error('Set DATABASE_URL to a DIRECT postgres:// URL of a NEON BRANCH (not the pooled/Accelerate URL).');
  process.exit(2);
}

// Tables to rehearse — a representative slice (catalogue + student-owned). The real
// rollout (0002_academy_rls.sql) covers all 22; proving the pattern on these is
// enough to validate the policy + GUC mechanism.
const TABLES = ['Course', 'Enrolment'];

const num = (r) => Number(r?.rows?.[0]?.n ?? r?.rows?.[0]?.count ?? 0);
let failures = 0;
const check = (label, ok) => { console.log(`   ${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };

async function main() {
  const pool = new Pool({ connectionString: URL, max: 1, connectionTimeoutMillis: 15_000 });
  const c = await pool.connect();
  console.log('ClinicOS Ring 1d — RLS rehearsal (transaction is rolled back at the end)\n');
  try {
    await c.query('BEGIN');

    // Resolve / create two tenants inside the tx (rolled back after).
    const a = (await c.query(`INSERT INTO "Tenant"(id, slug, name, active, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, 'rehearse-a', 'Rehearse A', true, now(), now())
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`)).rows[0].id;
    const b = (await c.query(`INSERT INTO "Tenant"(id, slug, name, active, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, 'rehearse-b', 'Rehearse B', true, now(), now())
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`)).rows[0].id;
    console.log(`Tenants: A=${a.slice(-6)} B=${b.slice(-6)} (temporary)\n`);

    // One Course + one Enrolment per tenant, tagged so we can assert visibility.
    await c.query(`INSERT INTO "Course"(id, "tenantId", slug, title, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, 'rehearse-course-a', 'Rehearse A', now(), now()),
             (gen_random_uuid()::text, $2, 'rehearse-course-b', 'Rehearse B', now(), now())`, [a, b]);
    // Enrolment needs a courseId; reuse the per-tenant course.
    await c.query(`INSERT INTO "Enrolment"(id, "tenantId", "courseId", "applicantName", "applicantEmail", status, "createdAt", "updatedAt")
      SELECT gen_random_uuid()::text, "tenantId", id, 'Rehearse', 'rehearse@example.invalid', 'APPLIED', now(), now()
      FROM "Course" WHERE slug IN ('rehearse-course-a','rehearse-course-b')`);

    // Enable + force RLS and install the tenant-isolation policy on each table.
    for (const t of TABLES) {
      await c.query(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
      await c.query(`ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY`);
      await c.query(`CREATE POLICY rehearse_isolation ON "${t}"
        USING ("tenantId" = current_setting('app.tenant_id', true))
        WITH CHECK ("tenantId" = current_setting('app.tenant_id', true))`);
    }

    // Helper: set the per-transaction GUC, then count this rehearsal's rows.
    const countFor = async (tenantId, table, slugCol, slugs) => {
      if (tenantId === null) await c.query(`SELECT set_config('app.tenant_id', '', true)`);
      else await c.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
      const q = slugCol
        ? `SELECT count(*)::int AS n FROM "${table}" WHERE "${slugCol}" = ANY($1)`
        : `SELECT count(*)::int AS n FROM "${table}" WHERE "applicantEmail" = 'rehearse@example.invalid'`;
      return num(await c.query(q, slugCol ? [slugs] : []));
    };

    console.log('Course (catalogue):');
    check('GUC=A sees exactly its own course', (await countFor(a, 'Course', 'slug', ['rehearse-course-a', 'rehearse-course-b'])) === 1);
    check('GUC=B sees exactly its own course', (await countFor(b, 'Course', 'slug', ['rehearse-course-a', 'rehearse-course-b'])) === 1);
    check('GUC unset sees ZERO (deny-by-default)', (await countFor(null, 'Course', 'slug', ['rehearse-course-a', 'rehearse-course-b'])) === 0);

    console.log('Enrolment (student-owned):');
    check('GUC=A sees exactly its own enrolment', (await countFor(a, 'Enrolment', null)) === 1);
    check('GUC=B sees exactly its own enrolment', (await countFor(b, 'Enrolment', null)) === 1);
    check('GUC unset sees ZERO (deny-by-default)', (await countFor(null, 'Enrolment', null)) === 0);

    // Cross-tenant write must be rejected by WITH CHECK: as tenant A, inserting a
    // row stamped for B should fail.
    await c.query(`SELECT set_config('app.tenant_id', $1, true)`, [a]);
    let writeBlocked = false;
    try {
      await c.query(`INSERT INTO "Course"(id, "tenantId", slug, title, "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, 'rehearse-cross', 'X', now(), now())`, [b]);
    } catch { writeBlocked = true; }
    console.log('Cross-tenant write:');
    check('GUC=A cannot INSERT a row stamped for B (WITH CHECK)', writeBlocked);
  } finally {
    await c.query('ROLLBACK').catch(() => {});
    c.release();
    await pool.end().catch(() => {});
  }

  if (failures === 0) {
    console.log('\n✅ RLS policy + GUC mechanism validated. Safe to proceed to the app-side GUC plumbing (see ring1/RLS_ROLLOUT.md).');
    process.exit(0);
  }
  console.log(`\n❌ ${failures} assertion(s) failed — the policy/mechanism is not correct. Do NOT roll out RLS.`);
  process.exit(1);
}

main().catch((e) => { console.error('rehearsal could not run:', e?.message || e); process.exit(2); });
