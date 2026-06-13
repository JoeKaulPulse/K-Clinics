import 'server-only';

// ClinicOS multi-tenancy — Ring 0 (see docs/PLATFORM_SAAS_PLAN.md v0.4, BLD-35).
// K Clinics is tenant #1. The Academy tables carry a nullable `tenantId`; this
// resolves the current tenant and self-heals the backfill. Query scoping + RLS
// arrive in Ring 0.2 / Ring 1 — today there is a single tenant, so a NULL or the
// default tenant id behave identically.

const DEFAULT_SLUG = 'kclinics';
const DEFAULT_NAME = 'K Clinics';
const DONE_KEY = 'academy_tenant_backfill_complete';

// Per-instance cache of the default tenant id.
let defaultIdCache: string | null = null;

/** Ensure the default (K Clinics) tenant row exists; returns its id. */
export async function ensureDefaultTenant(): Promise<string> {
  if (defaultIdCache) return defaultIdCache;
  const { db } = await import('@/lib/db');
  const host = (process.env.NEXT_PUBLIC_SITE_URL || 'https://kclinics.co.uk')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const t = await db.tenant.upsert({
    where: { slug: DEFAULT_SLUG },
    update: {},
    create: { slug: DEFAULT_SLUG, name: DEFAULT_NAME, host },
  });
  defaultIdCache = t.id;
  return t.id;
}

/** The current tenant id. Single-tenant today → always the default. Ring 0.2 makes
 *  this host/JWT-aware so it branches per request. */
export async function currentTenantId(): Promise<string> {
  return ensureDefaultTenant();
}

/** Self-healing backfill: stamp the default tenant onto any Academy rows still
 *  NULL. Idempotent — safe to run repeatedly. Returns how many rows were stamped. */
export async function backfillAcademyTenant(): Promise<{ stamped: number; complete: boolean }> {
  const { db } = await import('@/lib/db');
  const tenantId = await ensureDefaultTenant();
  const runs = [
    () => db.academyStudent.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.course.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.courseModule.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.lesson.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.quiz.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.quizQuestion.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.lessonProgress.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.quizAttempt.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.liveClass.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.cohort.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.enrolment.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.vacancy.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.jobApplication.updateMany({ where: { tenantId: null }, data: { tenantId } }),
  ];
  let stamped = 0;
  for (const run of runs) {
    try { stamped += (await run()).count; } catch { /* table unavailable — skip */ }
  }
  return { stamped, complete: stamped === 0 };
}

/** Daily-cron wrapper: runs the backfill until one pass stamps zero rows, then sets
 *  a flag so future days skip the scan (new rows are stamped at write time). Never
 *  throws into the cron. */
export async function backfillAcademyTenantIfNeeded(): Promise<{ ran: boolean; stamped: number; complete: boolean }> {
  const { db } = await import('@/lib/db');
  const done = await db.setting.findUnique({ where: { key: DONE_KEY } }).catch(() => null);
  if (done?.value === 'true') return { ran: false, stamped: 0, complete: true };
  const { stamped, complete } = await backfillAcademyTenant();
  if (complete) {
    await db.setting.upsert({ where: { key: DONE_KEY }, update: { value: 'true' }, create: { key: DONE_KEY, value: 'true' } }).catch(() => {});
  }
  return { ran: true, stamped, complete };
}
