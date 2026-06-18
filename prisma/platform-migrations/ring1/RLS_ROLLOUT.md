# ClinicOS Ring 1d — RLS rollout plan (BLD-301)

Row-Level Security is the **database backstop** for tenant isolation (ADR-015,
R12): even if an application query forgets a tenant filter, Postgres returns no
other tenant's rows. This is the highest-risk ring — RLS done wrong **empties the
live Academy** — so it ships in validated stages, not in one deploy.

## The mechanism

The policy (`prisma/platform-migrations/ring1/0002_academy_rls.sql`) denies every
row unless the connection has set `app.tenant_id` for the **current transaction**:

```sql
USING ("tenantId" = current_setting('app.tenant_id', true))
```

`current_setting(…, true)` returns NULL when unset, and `tenantId = NULL` is never
true → deny-by-default. So the app must set the GUC, per transaction, before any
Academy query:

```sql
SELECT set_config('app.tenant_id', $tenantId, true)   -- true = transaction-local
```

**Why transaction-local (not session):** runtime traffic goes through Accelerate /
PgBouncer, which multiplex one physical connection across many requests. A
session-level `SET` would leak a tenant id into the next request on the same
connection. Transaction-local dies with the transaction, so it's safe under
pooling — but it means every tenant-scoped unit of work must be a transaction.

## App-side plumbing — the seam

Wrap Academy DB work in an interactive transaction that sets the GUC first. This
is now shipped in **`lib/tenant-tx.ts`** (behind the `ACADEMY_RLS` flag, OFF by
default — a prod no-op until RLS is enabled):

```ts
// lib/tenant-tx.ts (shipped, Stage 2a)
export async function withTenantTx<T>(fn: (client: TenantClient) => Promise<T>): Promise<T> {
  const { db } = await import('@/lib/db');
  if (!academyRlsEnabled()) return fn(db);          // flag OFF → unchanged behaviour
  const tenantId = await (await import('@/lib/tenant')).currentTenantId();
  const { sql, params } = tenantGucStatement(tenantId);
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(sql, ...params);
    return fn(tx);
  });
}
```

Then every Academy read/write becomes `withTenantTx((tx) => tx.course.findMany(…))`.
The flag-off passthrough means converting a call site changes nothing in prod, so
the conversion can land incrementally ahead of the RLS enable.

**This is all-or-nothing per table:** once a table has `FORCE ROW LEVEL SECURITY`,
*every* query to it must set the GUC or it returns nothing. So the entire Academy
query surface (~97 sites — the inventory behind `ACADEMY_TENANT_MODELS`) must be
converted **before** RLS is enabled on those tables.

### Mechanism options — decided
1. **Explicit `withTenantTx` at each call site** — reliable, documented, but ~97
   edits and each read becomes an interactive transaction (extra round-trip).
2. **Auto-wrap in the Ring 0.2 db extension** — the `$allOperations` hook would
   batch `[ set_config, query(args) ]` into one array-form `$transaction`, so no
   call-site changes. Lower churn, but **ruled out**: the hook would have to turn
   each query into its own transaction, which breaks the **array-form transactions
   Academy code already uses** — `awardXp()` in `lib/academy-gamification.ts` does
   `db.$transaction([ db.academyStudent.update(…), db.pointEvent.create(…) ])`, and
   an element of an array-form `$transaction` cannot itself be an interactive
   transaction (nested → error). The GUC must be set ONCE per unit of work, at the
   transaction boundary — only option 1 does that.

**Decision: option 1.** The seam (`withTenantTx`, `lib/tenant-tx.ts`) is shipped as
Stage 2a behind the OFF-by-default `ACADEMY_RLS` flag. Stage 2b converts the call
sites (route handlers / lib unit-of-work boundaries, incl. the existing array-form
`db.$transaction([…])` Academy calls) to `withTenantTx`, validated on a branch.

## Roles
- The runtime app must connect as a **non-owner** role. `FORCE ROW LEVEL SECURITY`
  binds the owner too, but keep a separate **`BYPASSRLS`/owner** role for
  migrations and audited platform-staff break-glass (plan §7.3). Do not run the
  live app as that role.
- Confirm what role Accelerate connects as before enabling RLS on prod.

## Staged rollout

1. **Rehearse the policy + GUC mechanism** (do this first):
   ```
   DATABASE_URL='postgres://…branch…' node scripts/rehearse-rls.mjs
   ```
   Runs entirely inside a rolled-back transaction (no persistent change). Asserts:
   GUC=A → only A's rows; GUC=B → only B's; unset → zero; cross-tenant INSERT
   blocked by `WITH CHECK`. **Must be all ✓** before proceeding.

   **Connect as an ordinary role** (NOSUPERUSER, NOBYPASSRLS) that owns the Academy
   tables — RLS is skipped for SUPERUSER/`BYPASSRLS` roles even under `FORCE`, so
   running as one makes every assertion fail (looks like a broken policy, isn't).
   A Neon branch's default owner role qualifies; a local `postgres` superuser does
   not. The harness preflights this and refuses to run under a bypass role.

   Rehearsed clean on Postgres 16 as a non-bypass owner role — all 7 ✓ (the policy
   and GUC mechanism are sound; the failure mode above was reproduced and is the
   connecting-role gotcha, now guarded).
2. **Convert the query layer** to set the GUC, behind `ACADEMY_RLS=1` so it is a
   no-op in prod until RLS is actually enabled. **Done** (option 2 — the Ring 0.2
   `$allOperations` hook batches `[ set_config, scoped query ]` into one
   transaction; `lib/db.ts`). `tsc` + the isolation guard stay green.
3. **Enable RLS on a Neon branch**, point a preview at it, run the full app +
   the cross-tenant isolation suite, and measure latency (every Academy query now
   wraps in a transaction). The live suite is `scripts/test-tenant-isolation-live.ts`
   (companion to the DB-free CI guard `scripts/test-tenant-isolation.ts`):
   ```
   DATABASE_URL='postgres://…branch-owner…' node scripts/test-tenant-isolation-live.ts
   ```
   It drives the real Prisma client + the Ring 1d GUC plumbing against a database
   with `0002` applied: creates two tenants + a course/enrolment each, asserts A
   sees only A / B only B / cross-tenant `findUnique` → null / cross-tenant write
   blocked by `WITH CHECK`, then deletes them. Same role rule as the rehearsal
   (NOSUPERUSER, NOBYPASSRLS; it preflights and refuses a bypass role). Validated
   green on Postgres 16. The preview-app pass additionally covers the host-resolver
   path that a script cannot exercise.
4. **Provision the roles** and verify the app connects as the non-owner one:
   ```sql
   -- migration / break-glass role (owner of the Academy tables; audited use only)
   ALTER ROLE clinic_migrator WITH BYPASSRLS;            -- or own the tables + FORCE
   -- runtime app role: bound by RLS, least-privilege DML, never owner/bypass
   CREATE ROLE clinic_app LOGIN NOSUPERUSER NOBYPASSRLS;
   GRANT USAGE ON SCHEMA public TO clinic_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO clinic_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO clinic_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO clinic_app;
   ```
   On Prisma Postgres / Neon the exact provisioning may go through their console;
   the invariant is what matters — **the app's connection string must resolve to a
   role that is neither the table owner nor `BYPASSRLS`**, or `FORCE` is moot.
   Confirm what role Accelerate actually connects as before enabling RLS on prod.
5. **Enable RLS on prod** — follow `RLS_PROD_CUTOVER.md` (the day-of runbook).
   In short: ship `ACADEMY_RLS=1` **first** as its own release and let it bake (the
   GUC plumbing is then harmless until RLS exists), take a PITR snapshot, then apply
   `0002` as the owner role over a direct connection. Flag-first removes the outage
   window that "flip both in one release" leaves while the old flag-off version is
   still draining. Rollback is the `0002` disable block (instant, no deploy); make
   it reproducible afterwards by promoting `0002` to a real migration +
   `migrate resolve --applied`.

## Rollback
`ALTER TABLE … NO FORCE ROW LEVEL SECURITY; ALTER TABLE … DISABLE ROW LEVEL
SECURITY; DROP POLICY tenant_isolation ON …;` (see `0002`'s rollback block). Must
be paired with turning the GUC plumbing flag off, or queries that still expect RLS
behave the same anyway (the GUC is harmless when RLS is off).

## Status
- Rehearsal harness (`scripts/rehearse-rls.mjs`) + this plan — **authored and run**:
  rehearsed on Postgres 16 as a non-bypass owner role, all 7 assertions ✓. Added a
  preflight that refuses to run under a SUPERUSER/`BYPASSRLS` role (the one way the
  rehearsal produces a misleading result).
- GUC seam + `ACADEMY_RLS` flag (`lib/tenant-tx.ts`) + no-DB CI guard
  (`scripts/test-rls-seam.mjs`) — **shipped (Stage 2a)**; a prod no-op (flag OFF).
  Auto-wrap (option 2) ruled out — see §"Mechanism options".
- Query-layer GUC conversion (`ACADEMY_RLS=1`, `lib/db.ts`) — **done and merged**
  (step 2). No-op until the flag flips alongside the table enable.
- Live two-tenant isolation suite (`scripts/test-tenant-isolation-live.ts`) —
  **authored and validated** on Postgres 16 (all assertions ✓, no residue). Ready
  to run against the Neon branch in step 3.
- Production cutover runbook (`RLS_PROD_CUTOVER.md`) — **authored and dress-rehearsed
  end-to-end** on Postgres 16 with the real two-role model: roles provisioned (step
  4), `0002` enabled by the owner role, the live suite run as the non-owner app role
  (all ✓), reads verified under RLS (GUC → 300 rows, no-GUC → 0), and the rollback
  block recovers reads. Flag overhead measured at ~0.9 ms/query (loopback). See the
  runbook's "Dress rehearsal" section.
- Remaining before prod (the only parts needing the branch DB / owner): the
  **preview-app pass** — wire a preview with `ACADEMY_RLS=1` to an RLS-enabled branch
  to exercise the real `lib/db.ts` hook + the Accelerate pooled path and re-measure
  latency (step 3); confirm the role Accelerate connects as (step 4); then run the
  flag-first cutover with a PITR snapshot (step 5). The procedure, policy, role model
  and rollback are all validated; what's left is executing it against real infra.
