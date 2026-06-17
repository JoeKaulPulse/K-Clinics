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
  rehearsal next (owner, on a Neon branch — see step 1).
- GUC seam + `ACADEMY_RLS` flag (`lib/tenant-tx.ts`) + no-DB CI guard
  (`scripts/test-rls-seam.mjs`) — **shipped (Stage 2a)**; a prod no-op (flag OFF).
  Auto-wrap (option 2) ruled out — see §"Mechanism options".
- Stage 2b — convert the ~97 Academy call sites to `withTenantTx` — **staged**,
  validated on a branch.
- Prod RLS-enable — **staged**, gated on the rehearsal + Stage 2b.
