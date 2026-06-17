import 'server-only';

// ClinicOS multi-tenancy — Ring 0 (see docs/PLATFORM_SAAS_PLAN.md v0.4, BLD-35).
// K Clinics is tenant #1. The Academy tables carry a nullable `tenantId`; this
// resolves the current tenant and self-heals the backfill. Query scoping + RLS
// arrive in Ring 0.2 / Ring 1 — today there is a single tenant, so a NULL or the
// default tenant id behave identically.

const DEFAULT_SLUG = 'kclinics';
const DEFAULT_NAME = 'K Clinics';
const DONE_KEY = 'academy_tenant_backfill_complete';

// Per-instance caches. These are warmed once per lambda; the multi-tenant flag
// flips only when a second Tenant row is created (onboarding tenant #2), so the
// single-tenant fast path below stays cheap.
let defaultIdCache: string | null = null;
let multiTenantCache: boolean | null = null;
const hostIdCache = new Map<string, string | null>();

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

/** Whether more than one tenant exists. Cached; while it is false we never touch
 *  request headers, so the single-tenant deployment behaves exactly as before. */
async function hasMultipleTenants(): Promise<boolean> {
  if (multiTenantCache !== null) return multiTenantCache;
  const { db } = await import('@/lib/db');
  const n = await db.tenant.count().catch(() => 1);
  multiTenantCache = n > 1;
  return multiTenantCache;
}

/** Reset the per-instance multi-tenant flag — call after creating a tenant so the
 *  resolver starts honouring the host. (Caches are per-lambda anyway; this just
 *  avoids waiting for a cold start after onboarding tenant #2.) */
export function invalidateTenantCache(): void {
  multiTenantCache = null;
  hostIdCache.clear();
}

/** The request host, lower-cased and port-stripped, or null when there is no
 *  request scope (cron, build, scripts) — in which case we fall back to default. */
async function requestHost(): Promise<string | null> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    return host ? host.toLowerCase().replace(/:\d+$/, '') : null;
  } catch {
    return null;
  }
}

/** Resolve a tenant id from a hostname (custom domain / subdomain). Cached per host. */
async function tenantIdByHost(host: string): Promise<string | null> {
  if (hostIdCache.has(host)) return hostIdCache.get(host)!;
  const { db } = await import('@/lib/db');
  const t = await db.tenant.findFirst({ where: { host, active: true }, select: { id: true } }).catch(() => null);
  const id = t?.id ?? null;
  hostIdCache.set(host, id);
  return id;
}

/** The current tenant id.
 *
 *  Single tenant (today) → the default tenant id, resolved without reading the
 *  request, so the live site is byte-for-byte unchanged. Once a second tenant is
 *  onboarded the resolver branches on the request host (custom domain /
 *  subdomain → Tenant), falling back to the default when the host is unknown or
 *  there is no request scope. A per-tenant JWT claim is a Ring 2 refinement
 *  (the academy token carries no tenant claim yet — see PLATFORM_SAAS_PLAN.md). */
export async function currentTenantId(): Promise<string> {
  const defId = await ensureDefaultTenant();
  if (!(await hasMultipleTenants())) return defId;
  const host = await requestHost();
  if (host) {
    const resolved = await tenantIdByHost(host);
    if (resolved) return resolved;
  }
  return defId;
}

/** Self-healing backfill: stamp the default tenant onto any Academy rows still
 *  NULL. Idempotent — safe to run repeatedly. Returns how many rows were stamped. */
export async function backfillAcademyTenant(): Promise<{ stamped: number; complete: boolean }> {
  const { db } = await import('@/lib/db');
  const tenantId = await ensureDefaultTenant();
  // Every Academy model carrying a nullable tenantId (kept in lock-step with
  // ACADEMY_TENANT_MODELS in lib/tenant-scope.ts; the isolation test fails if the
  // two drift). updateMany is itself tenant-scoped by the db extension, but the
  // injected filter (`tenantId = X OR tenantId IS NULL`) still matches the NULL
  // rows we are stamping, so the backfill works unchanged.
  const runs = [
    () => db.academyStudent.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.studentPasskey.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.course.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.courseModule.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.lesson.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.homeworkSubmission.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.quiz.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.quizQuestion.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.lessonProgress.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.quizAttempt.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.examQuestion.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.pastPaper.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.practiceAttempt.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.pointEvent.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.studentBadge.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.dailyActivity.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.liveClass.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.cohort.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.enrolment.updateMany({ where: { tenantId: null }, data: { tenantId } }),
    () => db.fundingApplication.updateMany({ where: { tenantId: null }, data: { tenantId } }),
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
