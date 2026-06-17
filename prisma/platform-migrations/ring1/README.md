# ClinicOS Ring 1 — Academy tenant constraints (BLD-301)

Ring 1 hardens the Academy tables for multi-tenancy: per-tenant uniqueness,
`tenantId NOT NULL`, and Row-Level Security as the database backstop. It is being
applied **incrementally** through versioned migrations, not all at once.

## What has shipped vs what is held here

| Step | State | Where |
|---|---|---|
| **1a — migrations-regime flip** | applied | `prisma/migrations/0_init/` baseline + the self-adopt guard in `scripts/db-sync.mjs` |
| **1b — per-tenant uniques** (`@@unique([tenantId, email/slug])`, drop the global uniques) | applied | `prisma/migrations/20260617180000_academy_per_tenant_uniques/` + the matching `schema.prisma` edits |
| **1c — `tenantId NOT NULL`** | applied | `prisma/migrations/20260617190000_academy_tenant_not_null/` + the ~26-site create cascade; the Ring 0 backfill retired |
| **1d — RLS** | **deferred (needs rehearsal + app GUC plumbing)** | `0002_academy_rls.sql` |

The `*.sql` file in **this** directory (`0002`) is a design reference for the one
remaining deferred step (RLS). It sits **outside** `prisma/migrations/`, so no
deploy runs it; the applied work lives in real migration folders under
`prisma/migrations/`. (`0001` is fully superseded — its uniques became 1b's real
migration and its NOT NULL became 1c's; it is kept only for its rollback notes.)

### 1c — NOT NULL (initially deferred, then applied)
Originally deferred because the Ring 0.2 extension + backfill already populate
`tenantId`, making `NOT NULL` a marginal guarantee for a ~26-site create cascade.
The owner subsequently chose to finish it. As the expand/contract "contract" step
it both sets the column `NOT NULL` and retires the backfill (whose
`where: { tenantId: null }` no longer type-checks once the column is non-null).
The migration is **self-sufficient**: it backfills any remaining NULLs to the
default tenant (resolved from the `Tenant` table — portable) before the
`SET NOT NULL`, in one transaction. So there is **no merge precondition** — it
can't fail on pre-existing NULLs. (The verifier below is still a useful sanity
check, and a PITR snapshot before any prod schema change remains good practice.)

## Verifier — run before applying any of the deferred steps

```
DATABASE_URL='postgres://…' node scripts/verify-tenant-backfill.mjs
```

Read-only. It must report **ALL GREEN**:
- zero NULL `tenantId` in every Academy table — the precondition for `NOT NULL` (1c);
- no duplicate `(tenantId, email)` / `(tenantId, slug)` — the precondition for the
  composite uniques (1b; already verified clean since the old global uniques
  guaranteed it for a single tenant).

If not green, let the cron backfill (`backfillAcademyTenantIfNeeded` in
`lib/tenant.ts`) finish, or resolve the duplicates it lists, then re-run.

## RLS (1d) needs an app change first — don't skip this

`0002` denies every row unless the connection has set `app.tenant_id` for the
current transaction. The app does not do this yet. Before applying `0002`, ship
the change that wraps Academy DB work in a transaction that sets the GUC:

```ts
await db.$transaction(async (tx) => {
  await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId);
  // …tenant-scoped queries on tx…
});
```

The `true` (transaction-local) argument is required: Accelerate/PgBouncer
multiplex one physical connection across requests, so a session-level `SET` would
leak a tenant id into the next request. `FORCE ROW LEVEL SECURITY` binds even the
table owner, so the app should connect as a non-owner role, with a separate
`BYPASSRLS`/owner role for migrations and audited break-glass (plan §7.3).
**Applying `0002` before the app sets the GUC empties the live Academy.** RLS
should be rehearsed on a Neon branch with the cross-tenant isolation suite before
it reaches production.

## How a deferred step gets applied

1. Run the verifier — must be all green.
2. Take a PITR snapshot / record the bookmark (plan §6.4).
3. Make the `schema.prisma` edits (for NOT NULL: drop `?` on `tenantId`; RLS is
   not expressible in the schema) and `npx prisma migrate dev --name …` to
   generate the migration; for RLS, add `0002`'s SQL as a manual migration step.
4. For RLS: rehearse on a Neon branch + run the isolation suite first.
5. Merge → the deploy's `migrate deploy` applies it.

## Rollback

Each `*.sql` file ends with a commented rollback block. The applied 1b migration
is reversible by dropping the composite indexes and recreating the global ones
(see `0001`'s rollback block). `0002` rollback (`DISABLE ROW LEVEL SECURITY`)
must only be run with the GUC plumbing removed from the app.

## Status

- Ring 0.1 — `Tenant` model + nullable `tenantId` + self-healing backfill — **merged**.
- Ring 0.2 (BLD-300) — central query scoping + resolver + CI isolation guard — **merged**.
- Ring 1a — migrations flip (baseline + self-adopt) — **merged**.
- Ring 1b — per-tenant uniques — **merged**.
- Ring 1c — `tenantId NOT NULL` (self-backfilling) + create-site cascade + backfill retired — **merged**.
- Ring 1d — RLS — **in progress** (`0002` is the policy SQL; not yet applied):
  - *Rehearsal* (`scripts/rehearse-rls.mjs`) — **run and passing** on Postgres 16 (non-bypass owner role, all 7 ✓); refuses to run under a SUPERUSER/`BYPASSRLS` role.
  - *Query-layer GUC conversion* (`ACADEMY_RLS=1`, `lib/db.ts`) — **done and merged**; no-op until the flag flips with the table enable.
  - *Live two-tenant isolation suite* (`scripts/test-tenant-isolation-live.ts`) — **authored and validated** (real Prisma + RLS path, all ✓, self-cleaning).
  - *Remaining*: Neon-branch enable + live suite + preview/latency (step 3), role provisioning (step 4), prod enable in one release with PITR (step 5) — see `RLS_ROLLOUT.md`. These need a branch DB and owner decisions.
