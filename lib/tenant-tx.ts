// ClinicOS multi-tenancy — Ring 1d, RLS GUC seam (BLD-301).
//
// Row-Level Security (prisma/platform-migrations/ring1/0002_academy_rls.sql) is
// the database backstop for tenant isolation: every Academy table denies a row
// unless the *current transaction* has set the `app.tenant_id` GUC. This module
// is the app-side half of that contract — the seam that sets the GUC — staged
// behind a flag so it is a NO-OP in production until RLS is actually enabled.
// See prisma/platform-migrations/ring1/RLS_ROLLOUT.md for the staged rollout.
//
// Why a seam and not an auto-wrap in the db extension (lib/db.ts): the rollout
// plan considered auto-wrapping every Academy query in the `$allOperations` hook
// (option 2 — near-zero churn). That is unsafe here: Academy code already issues
// array-form transactions — e.g. awardXp() in lib/academy-gamification.ts does
//   db.$transaction([ db.academyStudent.update(…), db.pointEvent.create(…) ])
// The hook cannot turn each array element (a Prisma promise) into its own
// interactive transaction without breaking that call (nested transaction). So the
// GUC must be set ONCE per unit of work, at the transaction boundary — which is
// exactly what withTenantTx() below does (option 1). See RLS_ROLLOUT.md §"Mechanism".
//
// Dependency note: this module is import-safe with no database and no server
// runtime — `academyRlsEnabled` and `tenantGucStatement` are pure, and the only
// db/tenant imports are *dynamic*, inside withTenantTx(). That lets the CI guard
// (scripts/test-rls-seam.mjs) exercise the pure logic without a DB or a build.

import type { Prisma } from '@prisma/client';

/** A client that can run model queries — either the base client or a
 *  $transaction's interactive client. PrismaClient is assignable to this
 *  (TransactionClient is an Omit of it), so the flag-off passthrough below
 *  type-checks. Callers should treat it as "a place to run Academy queries". */
export type TenantClient = Prisma.TransactionClient;

/** Whether the app-side GUC plumbing is live. OFF by default, so production is
 *  byte-for-byte unchanged until RLS is enabled. The rollout flips this to `1`
 *  in the SAME release that enables RLS on the Academy tables (RLS_ROLLOUT.md
 *  §"Staged rollout" step 5) — setting the GUC while RLS is off is harmless
 *  (nothing reads it), so the flag is safe to leave off through the conversion. */
export function academyRlsEnabled(): boolean {
  return process.env.ACADEMY_RLS === '1';
}

/** The transaction-local statement that tells Postgres which tenant this unit of
 *  work belongs to. It MUST match the policy in 0002_academy_rls.sql, which reads
 *  `current_setting('app.tenant_id', true)`.
 *
 *  - The third arg to set_config is `true` → the setting is **transaction-local**
 *    and dies with the transaction. This is mandatory under Accelerate/PgBouncer,
 *    where one physical connection is multiplexed across requests: a session-level
 *    SET would leak a tenant id into the next request on that connection.
 *  - The tenant id is bound as `$1`, never interpolated, so it cannot inject SQL. */
export function tenantGucStatement(tenantId: string): { sql: string; params: [string] } {
  return { sql: `SELECT set_config('app.tenant_id', $1, true)`, params: [tenantId] };
}

/** Run an Academy unit of work with the tenant GUC set for its transaction.
 *
 *  Flag OFF (production default): runs `fn` against the base client with no extra
 *  transaction and no GUC — identical to calling `db` directly, so converting a
 *  call site to withTenantTx is a no-op until RLS ships.
 *
 *  Flag ON: opens one interactive transaction, sets `app.tenant_id` for it, then
 *  runs `fn` against that transaction client. Every query `fn` makes then satisfies
 *  the RLS policy; queries outside it (deny-by-default) see nothing.
 *
 *  Must wrap the OUTERMOST unit of work — do not nest withTenantTx inside another
 *  (interactive transactions cannot nest). Existing array-form `db.$transaction([…])`
 *  Academy calls become `withTenantTx((tx) => tx.$transaction([…]))` at conversion. */
export async function withTenantTx<T>(fn: (client: TenantClient) => Promise<T>): Promise<T> {
  const { db } = await import('@/lib/db');
  if (!academyRlsEnabled()) {
    // Production path: no GUC, no wrapping transaction — behaviour unchanged.
    return fn(db);
  }
  const { currentTenantId } = await import('@/lib/tenant');
  const tenantId = await currentTenantId();
  const { sql, params } = tenantGucStatement(tenantId);
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(sql, ...params);
    return fn(tx);
  });
}
