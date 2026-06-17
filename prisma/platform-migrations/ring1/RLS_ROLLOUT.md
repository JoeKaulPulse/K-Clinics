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

Wrap Academy DB work in an interactive transaction that sets the GUC first:

```ts
// lib/tenant.ts (to add at the conversion stage)
export async function withTenantTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const tenantId = await currentTenantId();
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId);
    return fn(tx);
  });
}
```

Then every Academy read/write becomes `withTenantTx((tx) => tx.course.findMany(…))`.

**This is all-or-nothing per table:** once a table has `FORCE ROW LEVEL SECURITY`,
*every* query to it must set the GUC or it returns nothing. So the entire Academy
query surface (~97 sites — the inventory behind `ACADEMY_TENANT_MODELS`) must be
converted **before** RLS is enabled on those tables.

### Mechanism options (decide at the conversion stage, after the rehearsal)
1. **Explicit `withTenantTx` at each call site** — reliable, documented, but ~97
   edits and each read becomes an interactive transaction (extra round-trip).
2. **Auto-wrap in the Ring 0.2 db extension** — the `$allOperations` hook batches
   `[ set_config, query(args) ]` into one array-form `$transaction`, so no call-site
   changes. Lower churn, but unproven here and has edge cases (a query already
   inside an interactive `$transaction` would nest → error). **Must be validated on
   a branch** before trusting it.

Recommendation: validate option 2 on a branch (it's near-zero-churn); fall back to
option 1 if nested-transaction or perf issues appear.

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
5. **Enable RLS on prod**: promote `0002` to a real migration, flip `ACADEMY_RLS=1`
   in the same release (so the GUC plumbing is live the moment RLS is), PITR
   snapshot first. Watch the Academy closely.

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
- Query-layer GUC conversion (`ACADEMY_RLS=1`, `lib/db.ts`) — **done and merged**
  (step 2). No-op until the flag flips alongside the table enable.
- Live two-tenant isolation suite (`scripts/test-tenant-isolation-live.ts`) —
  **authored and validated** on Postgres 16 (all assertions ✓, no residue). Ready
  to run against the Neon branch in step 3.
- Remaining before prod: enable `0002` on a Neon branch + run the live suite and
  the preview app, measure latency (step 3); provision the non-owner app role +
  BYPASSRLS migration role (step 4); flip `ACADEMY_RLS=1` + RLS on prod in one
  release with a PITR snapshot (step 5). Steps 3–5 need a branch DB and owner
  decisions on roles / timing.
