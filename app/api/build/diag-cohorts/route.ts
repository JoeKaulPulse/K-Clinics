import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { crmEnabled } from '@/lib/crm';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// TEMPORARY read-only diagnostic for BLD-642 (Cohorts page shows "0 students"
// for a cohort that has assigned students). Uses raw SQL so it bypasses the
// per-tenant query scope and shows the TRUE cross-tenant picture — the symptom
// points at the enrolment's cohortId resolving to a different cohort row than
// the Cohorts page renders. Token-authed (BOARD_QUEUE_TOKEN), same as the queue.
// Remove once BLD-642 is diagnosed and fixed.
function tokenOk(req: Request): boolean {
  const secret = process.env.BOARD_QUEUE_TOKEN;
  if (!secret) return false;
  const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!provided || provided.length !== secret.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret)); } catch { return false; }
}

const n = (v: unknown) => (typeof v === 'bigint' ? Number(v) : v);

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });
  if (!process.env.BOARD_QUEUE_TOKEN) return NextResponse.json({ ok: false, error: 'Queue token not configured.' }, { status: 503 });
  if (!tokenOk(req)) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  try {
    // Tenant distribution across the three models — a split here is the smoking gun.
    const tenants = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT 'cohort' AS model, "tenantId", count(*)::int AS rows FROM "Cohort" GROUP BY "tenantId"
      UNION ALL SELECT 'enrolment', "tenantId", count(*)::int FROM "Enrolment" GROUP BY "tenantId"
      UNION ALL SELECT 'course', "tenantId", count(*)::int FROM "Course" GROUP BY "tenantId"
      ORDER BY 1, 2`);

    // Every cohort with the true enrolment count (cross-tenant) vs the
    // same-tenant count (what the scoped Cohorts page effectively sees).
    const cohorts = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT c.id, c.name, c."startAt", c."tenantId" AS cohort_tenant,
             co.title AS course_title, co."tenantId" AS course_tenant,
             (SELECT count(*)::int FROM "Enrolment" e WHERE e."cohortId" = c.id) AS enrolments_total,
             (SELECT count(*)::int FROM "Enrolment" e WHERE e."cohortId" = c.id AND e."tenantId" = c."tenantId") AS enrolments_same_tenant
      FROM "Cohort" c LEFT JOIN "Course" co ON co.id = c."courseId"
      ORDER BY c."startAt"`);

    // Enrolments that carry a cohortId, with tenant alignment flags.
    const links = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT e.id AS enrolment_id, e.status, e."tenantId" AS enrolment_tenant,
             e."courseId" AS enrolment_course, c.id AS cohort_id, c.name AS cohort_name,
             c."startAt", c."tenantId" AS cohort_tenant, c."courseId" AS cohort_course,
             (e."tenantId" = c."tenantId") AS tenant_match,
             (e."courseId" = c."courseId") AS course_match
      FROM "Enrolment" e JOIN "Cohort" c ON c.id = e."cohortId"
      ORDER BY c."startAt"`);

    // What the admin pages scope to. The cohorts page enrolment query is
    // tenant-scoped; compare what currentTenantId() resolves to vs the data tenant.
    const { currentTenantId, ensureDefaultTenant } = await import('@/lib/tenant');
    const cur = await currentTenantId().catch((e) => `ERR:${(e as Error).message}`);
    const def = await ensureDefaultTenant().catch((e) => `ERR:${(e as Error).message}`);
    const allTenants = await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT id, name, slug, host FROM "Tenant" ORDER BY "createdAt"`).catch((e) => [{ note: (e as Error).message }]);
    // The EXACT scoped query the cohorts page runs (through the tenant scope):
    const scopedEnrol = await db.enrolment.findMany({ where: { cohortId: { not: null } }, select: { id: true, cohortId: true, tenantId: true } }).catch((e) => `ERR:${(e as Error).message}`);

    // EXACT replica of the Cohorts page computation: the same course query (with
    // cohorts include) and enrolment query, then the same per-cohort filter the
    // CohortsBoard runs. If studentCount here is non-zero, the page works on
    // current data and the "0 students" view is stale/cached.
    const rawCourseCount = await db.$queryRawUnsafe<{ c: number }[]>(`SELECT count(*)::int AS c FROM "Course"`).then((r) => n(r[0]?.c)).catch(() => null);
    let pageReplica: unknown;
    try {
      const courses = await db.course.findMany({ include: { cohorts: { orderBy: { startAt: 'asc' } } } });
      const enrolments = await db.enrolment.findMany({ where: { cohortId: { not: null } }, select: { id: true, cohortId: true } });
      pageReplica = {
        scopedCourseCount: courses.length,
        scopedEnrolCount: enrolments.length,
        perCohort: courses.flatMap((c) => c.cohorts.map((h) => ({ cohortId: h.id, name: h.name, course: c.title, studentCount: enrolments.filter((e) => e.cohortId === h.id).length }))),
      };
    } catch (e) { pageReplica = `ERR:${(e as Error).message}`; }

    const map = (rows: Record<string, unknown>[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, n(v)])));
    return NextResponse.json({
      ok: true,
      tenantContext: { currentTenantId: cur, defaultTenant: def, dataTenant: 'cmqdhvf3w000304jyl1qxb3v7' },
      allTenants,
      rawCourseCount,
      pageReplica,
      scopedEnrolWithCohort: scopedEnrol,
      tenants: map(tenants), cohorts: map(cohorts), links: map(links),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message }, { status: 500 });
  }
}
