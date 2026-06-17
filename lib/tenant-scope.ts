// ClinicOS multi-tenancy — Ring 0.2 query scoping (BLD-300).
//
// Pure, framework-free logic for injecting a tenant filter into Academy Prisma
// queries. It is deliberately dependency-free (no Prisma runtime import, no
// next/* import) so the isolation guard can exercise it in CI without a database
// or a build — see scripts/test-tenant-isolation.ts.
//
// The live wiring is in lib/db.ts: a Prisma `$extends` query hook calls
// applyTenantScope() for Academy models only, using the tenant id resolved by
// lib/tenant.ts (currentTenantId). Single tenant today → the default tenant id,
// so behaviour is identical to before scoping (see tenantScopeFilter).

/** Every Academy / Learning Prisma model that carries a nullable `tenantId`
 *  (prisma/schema.prisma). One missing entry is an unscoped query — i.e. R12
 *  (cross-tenant data leak) — so this set is the single source of truth and the
 *  isolation test asserts it against the schema. Keys are the Prisma *delegate*
 *  names (camelCase), which is what the query hook receives after normalising. */
export const ACADEMY_TENANT_MODELS: ReadonlySet<string> = new Set<string>([
  'academyStudent',
  'studentPasskey',
  'course',
  'courseModule',
  'lesson',
  'homeworkSubmission',
  'quiz',
  'quizQuestion',
  'lessonProgress',
  'quizAttempt',
  'examQuestion',
  'pastPaper',
  'practiceAttempt',
  'pointEvent',
  'studentBadge',
  'dailyActivity',
  'liveClass',
  'cohort',
  'enrolment',
  'fundingApplication',
  'vacancy',
  'jobApplication',
]);

/** Prisma passes model names capitalised (e.g. "AcademyStudent"); the delegate
 *  key is camelCase ("academyStudent"). Normalise so callers can pass either. */
export function modelKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/** True when a Prisma query against `model` must be tenant-scoped. */
export function isAcademyModel(model: string | undefined | null): boolean {
  return !!model && ACADEMY_TENANT_MODELS.has(modelKey(model));
}

/** The tenant filter injected into a query's `where`.
 *
 *  It matches this tenant's rows OR legacy rows the backfill has not yet stamped
 *  (`tenantId` is NULL). With a single tenant every Academy row is either the
 *  default tenant or NULL, so this matches *all* rows → identical behaviour to
 *  no filter. Once Ring 1 makes `tenantId` NOT NULL the NULL arm is dead and the
 *  filter becomes strict equality. Keeping the NULL arm now means a row created
 *  before its tenant stamp (e.g. a nested write) is never invisible to its own
 *  single tenant — correctness over the transition window, not isolation theatre
 *  (isolation between *real* tenants holds: a row stamped for tenant B is never
 *  NULL, so it never matches tenant A's filter). */
export function tenantScopeFilter(tenantId: string): { OR: Array<{ tenantId: string | null }> } {
  return { OR: [{ tenantId }, { tenantId: null }] };
}

// Operation classification. Prisma operation names are stable across the client.
const WHERE_SCOPED = new Set<string>([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
]);

const DATA_STAMPED = new Set<string>(['create', 'createMany', 'createManyAndReturn']);

type AnyArgs = Record<string, unknown>;

function stampOne(data: unknown, tenantId: string): AnyArgs {
  const d: AnyArgs = data && typeof data === 'object' ? { ...(data as AnyArgs) } : {};
  if (d.tenantId === undefined || d.tenantId === null) d.tenantId = tenantId;
  return d;
}

function stampData(data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) return data.map((d) => stampOne(d, tenantId));
  return stampOne(data, tenantId);
}

/** Return query `args` rewritten to scope the operation to `tenantId`.
 *
 *  - reads / bulk writes (`findMany`, `findFirst`, `count`, `aggregate`,
 *    `groupBy`, `updateMany`, `deleteMany`): inject the tenant filter into
 *    `where`, AND-combined with any caller filter.
 *  - creates (`create`, `createMany`): stamp `tenantId` onto the new row(s) when
 *    the caller has not already set it.
 *  - `upsert`: stamp the `create` branch; the unique `where` and `update` branch
 *    are left alone (single-tenant safe; Ring 1 adds the composite unique).
 *  - by-unique ops (`findUnique`, `update`, `delete`): returned unchanged. Their
 *    `where` only accepts unique fields, so a tenant filter cannot be injected;
 *    cross-tenant access by a *known* id is closed by RLS in Ring 1 (the backstop
 *    the plan mandates), not here.
 *
 *  Never mutates the input; returns a shallow copy. */
export function applyTenantScope(model: string, operation: string, args: AnyArgs | undefined, tenantId: string): AnyArgs {
  const next: AnyArgs = args ? { ...args } : {};

  if (WHERE_SCOPED.has(operation)) {
    const scope = tenantScopeFilter(tenantId);
    const existing = next.where;
    next.where = existing ? { AND: [existing, scope] } : scope;
    return next;
  }

  if (DATA_STAMPED.has(operation)) {
    next.data = stampData(next.data, tenantId);
    return next;
  }

  if (operation === 'upsert') {
    next.create = stampOne(next.create, tenantId);
    return next;
  }

  return next;
}
