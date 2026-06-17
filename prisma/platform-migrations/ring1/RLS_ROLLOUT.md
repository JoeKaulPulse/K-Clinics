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
2. **Convert the query layer** to set the GUC (option 1 or 2 above), behind a flag
   (e.g. `ACADEMY_RLS=1`) so it is a no-op in prod until RLS is actually enabled.
   `tsc` + the isolation guard stay green.
3. **Enable RLS on a Neon branch**, point a preview at it, run the full app +
   the cross-tenant isolation suite (extend `scripts/test-tenant-isolation.ts`
   with a live two-tenant DB pass). Measure latency (every Academy query now wraps
   in a transaction).
4. **Provision the non-owner app role** + the BYPASSRLS migration role; verify the
   app connects as the former.
5. **Enable RLS on prod**: promote `0002` to a real migration, flip `ACADEMY_RLS=1`
   in the same release (so the GUC plumbing is live the moment RLS is), PITR
   snapshot first. Watch the Academy closely.

## Rollback
`ALTER TABLE … NO FORCE ROW LEVEL SECURITY; ALTER TABLE … DISABLE ROW LEVEL
SECURITY; DROP POLICY tenant_isolation ON …;` (see `0002`'s rollback block). Must
be paired with turning the GUC plumbing flag off, or queries that still expect RLS
behave the same anyway (the GUC is harmless when RLS is off).

## Status
- Rehearsal harness (`scripts/rehearse-rls.mjs`) + this plan — **authored**; run the
  rehearsal next.
- Query-layer conversion + prod RLS-enable — **staged**, gated on the rehearsal.
