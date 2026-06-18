// ClinicOS Ring 1d — LIVE two-tenant isolation suite (BLD-301).
//
// The companion to scripts/test-tenant-isolation.ts (which is the pure, DB-free CI
// guard for the scoping logic) and scripts/rehearse-rls.mjs (which proves the raw
// SQL policy). This one proves the FULL data path: a real Prisma client + the
// Ring 0.2 tenant-scope extension + the Ring 1d `app.tenant_id` GUC plumbing,
// against a database with 0002_academy_rls.sql actually applied. It is the
// "cross-tenant isolation suite, live two-tenant DB pass" the rollout plan
// requires before prod (RLS_ROLLOUT.md step 3).
//
//   DATABASE_URL='postgres://…branch…' node scripts/test-tenant-isolation-live.ts
//
// NOT a CI step (it needs a database) and NOT for production: it commits two test
// tenants + a course/enrolment each, asserts isolation, then deletes them. Point
// it at a disposable Neon/Prisma branch that has RLS enabled. Connect as the
// branch's ordinary OWNER role (NOSUPERUSER, NOBYPASSRLS) — RLS is skipped for
// SUPERUSER/BYPASSRLS roles, so the suite refuses to run under one (it would pass
// vacuously / report nonsense). FORCE ROW LEVEL SECURITY binds even the owner.
//
// The extension below is a faithful copy of lib/db.ts's RLS branch, with the only
// difference that the tenant id is set explicitly (`asTenant`) instead of resolved
// from the request host — the resolver's host path has no request scope in a script
// and is exercised by the preview-app pass, not here.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { applyTenantScope, isAcademyModel } from '../lib/tenant-scope.ts';

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!URL || !/^postgres(ql)?:\/\//.test(URL)) {
  console.error('Set DATABASE_URL to a DIRECT postgres:// URL of an RLS-enabled disposable branch.');
  process.exit(2);
}

// Test fixtures — namespaced so the suite is robust against real Academy data on a
// branch cloned from prod, and so cleanup is exact.
const A = { slug: 'iso-test-a', name: 'Isolation Test A', course: 'iso-test-course-a' };
const B = { slug: 'iso-test-b', name: 'Isolation Test B', course: 'iso-test-course-b' };
const EMAIL = 'iso-test@example.invalid';

let current = ''; // the tenant id the extension scopes to, set via asTenant()

const pool = new Pool({ connectionString: URL, max: 1, connectionTimeoutMillis: 15_000 });
const adapter = new PrismaPg(pool);
const base = new PrismaClient({ adapter });
let db: any;
db = base.$extends({
  name: 'clinicos-tenant-scope',
  query: { $allModels: { async $allOperations({ model, operation, args, query }: any) {
    if (!isAcademyModel(model)) return query(args);
    const tenantId = current;
    const scoped = applyTenantScope(model, operation, args, tenantId);
    const [, result] = await db.$transaction([
      db.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId),
      query(scoped),
    ]);
    return result;
  } } },
});

async function asTenant(id: string, fn: () => Promise<any>): Promise<any> {
  const prev = current;
  current = id;
  try { return await fn(); } finally { current = prev; }
}

let fail = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  console.log(`   ${cond ? '✓' : '✗'} ${label}${detail ? `  (${detail})` : ''}`);
  if (!cond) fail++;
};

async function main() {
  console.log('ClinicOS Ring 1d — live two-tenant isolation suite\n');

  // Preflight: RLS is bypassed for SUPERUSER / BYPASSRLS roles, so the suite can
  // only assert isolation when run as an ordinary role (same gotcha as the rehearsal).
  const role: any = ((await base.$queryRawUnsafe(
    `SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
  )) as any[])[0];
  if (role?.rolsuper || role?.rolbypassrls) {
    console.error(`Connected as "${role.name}", which ${role.rolsuper ? 'is a SUPERUSER' : 'has BYPASSRLS'} — RLS is bypassed, so this suite cannot validate isolation. Connect as the branch's ordinary owner role.`);
    await cleanupClients();
    process.exit(2);
  }

  let aTenant = '', bTenant = '', bCourseId = '';
  try {
    // Setup. Tenant rows have no RLS; Academy rows are created under each tenant's
    // GUC (the extension stamps tenantId and the WITH CHECK admits it).
    aTenant = (await base.tenant.upsert({ where: { slug: A.slug }, update: { name: A.name }, create: { slug: A.slug, name: A.name } })).id;
    bTenant = (await base.tenant.upsert({ where: { slug: B.slug }, update: { name: B.name }, create: { slug: B.slug, name: B.name } })).id;
    console.log(`Tenants: A=${aTenant.slice(-6)} B=${bTenant.slice(-6)} (temporary)\n`);

    await asTenant(aTenant, async () => {
      const c = await db.course.create({ data: { slug: A.course, title: 'A' } });
      await db.enrolment.create({ data: { courseId: c.id, applicantName: 'A', applicantEmail: EMAIL } });
    });
    bCourseId = await asTenant(bTenant, async () => {
      const c = await db.course.create({ data: { slug: B.course, title: 'B' } });
      await db.enrolment.create({ data: { courseId: c.id, applicantName: 'B', applicantEmail: EMAIL } });
      return c.id;
    });

    const courseWhere = { slug: { in: [A.course, B.course] } };
    console.log('Catalogue (Course):');
    const aCourses = await asTenant(aTenant, () => db.course.findMany({ where: courseWhere }));
    ok('tenant A sees exactly its own course', aCourses.length === 1 && aCourses[0].slug === A.course, `slugs=${aCourses.map((c: any) => c.slug)}`);
    const bCourses = await asTenant(bTenant, () => db.course.findMany({ where: courseWhere }));
    ok('tenant B sees exactly its own course', bCourses.length === 1 && bCourses[0].slug === B.course, `slugs=${bCourses.map((c: any) => c.slug)}`);

    console.log('By-id backstop (the ops the app filter leaves open):');
    const cross = await asTenant(aTenant, () => db.course.findUnique({ where: { id: bCourseId } }));
    ok('tenant A findUnique(B course id) → null (RLS denies)', cross === null);

    console.log('Student-owned (Enrolment):');
    const aEnr = await asTenant(aTenant, () => db.enrolment.findMany({ where: { applicantEmail: EMAIL } }));
    ok('tenant A sees exactly its own enrolment', aEnr.length === 1 && aEnr[0].tenantId === aTenant, `count=${aEnr.length}`);

    console.log('Cross-tenant write:');
    let blocked = false;
    await asTenant(aTenant, async () => {
      try { await db.course.create({ data: { slug: 'iso-test-cross', title: 'X', tenantId: bTenant } as any }); }
      catch { blocked = true; }
    });
    ok('tenant A cannot create a row stamped for B (WITH CHECK)', blocked);
  } finally {
    // Cleanup — delete Academy rows under each tenant's GUC, then the Tenant rows.
    try {
      for (const t of [aTenant, bTenant].filter(Boolean)) {
        await asTenant(t, async () => {
          await db.enrolment.deleteMany({ where: { applicantEmail: EMAIL } });
          await db.course.deleteMany({ where: { slug: { in: [A.course, B.course] } } });
        });
      }
      await base.tenant.deleteMany({ where: { slug: { in: [A.slug, B.slug] } } });
      console.log('\n🧹 cleanup: test tenants + rows removed');
    } catch (e: any) {
      console.log(`\n⚠ cleanup incomplete (${e?.message?.split('\n')[0]}) — disposable branch, safe to drop`);
    }
    await cleanupClients();
  }

  if (fail === 0) { console.log('\n✅ Live two-tenant isolation validated through the real Prisma + RLS path.'); process.exit(0); }
  console.log(`\n❌ ${fail} assertion(s) failed.`); process.exit(1);
}

async function cleanupClients() {
  await base.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
}

main().catch((e) => { console.error('suite could not run:', e?.message || e); process.exit(2); });
