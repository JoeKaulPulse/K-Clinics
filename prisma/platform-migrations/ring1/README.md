# ClinicOS Ring 1 — Academy tenant constraints (BLD-301)

Reviewed SQL for the Ring 1 step of the platform plan
(`docs/PLATFORM_SAAS_PLAN.md`): make `tenantId` `NOT NULL`, add per-tenant
uniqueness, and add Row-Level Security as the database backstop for tenant
isolation.

## These files are NOT applied by any deploy

This directory sits **outside** `prisma/migrations/`, so:

- `prisma db push` (the current live deploy path) never reads it.
- `prisma migrate deploy` (the `USE_MIGRATIONS=true` path) never reads it.

They are a design artifact for review. Nothing here touches production until the
owner deliberately promotes it (steps below). This matches the "safe Ring 1 prep
only" decision: the constraints are authored and reviewable, but the live deploy
regime and the production database are untouched.

| File | What it does | Extra precondition beyond the verifier |
|---|---|---|
| `0001_academy_tenant_constraints.sql` | `tenantId NOT NULL` on all 22 Academy tables; swaps the global `email`/`slug` uniques for per-tenant composite uniques | — |
| `0002_academy_rls.sql` | Enables + forces RLS and installs a `tenant_isolation` policy per table | **App must set `app.tenant_id` per transaction first** (see below) — otherwise the live Academy returns zero rows |
| `../../scripts/verify-tenant-backfill.mjs` | Read-only check that the preconditions hold | run it before promoting anything |

## Why this can't ride the live `db push` gate

`scripts/db-sync.mjs` runs `prisma db push` without `--accept-data-loss`. That
gate **refuses** both new `@unique` on an existing table and `NOT NULL` additions
(Prisma flags them as potential data loss), so every deploy would fail. The whole
point of Ring 1 is to move the platform track onto **versioned migrations**
(ADR-004), where this SQL is applied as a reviewed migration instead.

Do **not** add the companion `@@unique` / required-`tenantId` edits to
`prisma/schema.prisma` while the live deploy is still on `db push` — that alone
would break deploys. The schema edits happen only at promotion time (step 3).

## Preconditions (verify before promoting)

1. **Backfill complete + no duplicates.** Run, against the production DB or a
   fresh snapshot/branch:

   ```
   DATABASE_URL='postgres://…' node scripts/verify-tenant-backfill.mjs
   ```

   It must report **ALL GREEN**. If not, let the daily-cron backfill
   (`backfillAcademyTenantIfNeeded` in `lib/tenant.ts`) finish, or resolve the
   duplicate rows it lists, then re-run.

2. **Snapshot / PITR bookmark recorded** (plan §6.4) before any DDL.

3. **A non-owner runtime DB role** exists for the app, plus a separate
   `BYPASSRLS`/owner role for migrations and audited break-glass (plan §7.3).
   `FORCE ROW LEVEL SECURITY` binds even the table owner, so the live app must not
   connect as the owner once `0002` is applied.

## RLS needs an app change first (don't skip this)

`0002` denies every row unless the connection has set `app.tenant_id` for the
current transaction. The app does not do this yet. Before applying `0002`, ship
the Ring 1 app change that wraps Academy DB work in a transaction that sets the
GUC, e.g.:

```ts
await db.$transaction(async (tx) => {
  await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId);
  // …tenant-scoped queries on tx…
});
```

The `true` (transaction-local) argument is required: Accelerate/PgBouncer
multiplex one physical connection across requests, so a session-level `SET` would
leak a tenant id into the next request. Applying `0002` **before** this ships will
make every Academy query return nothing.

## Promotion procedure (when the owner is ready to flip)

1. Create the migrations baseline if it does not exist yet
   (`npx prisma migrate dev --name init` against a prod-schema copy — see
   `prisma/migrations/README.md`), commit it, and set `USE_MIGRATIONS=true`.
2. Run the verifier (above) — must be all green.
3. Make the companion `schema.prisma` edits: drop `?` on `tenantId` for the 22
   models; replace the field-level `@unique` on `AcademyStudent.email`,
   `Course.slug`, `Vacancy.slug` with `@@unique([tenantId, …])`.
4. `npx prisma migrate dev --name academy_tenant_constraints` — confirm the
   generated SQL matches `0001` here, adjust if Prisma names an index differently.
5. Ship the RLS app change (GUC per transaction) and verify on staging.
6. Add `0002`'s contents as a manual migration step (RLS is not expressible in the
   Prisma schema) in the same or a following reviewed migration.
7. Apply on platform-staging first; run the cross-tenant isolation suite
   (extend `scripts/test-tenant-isolation.ts` with a live two-tenant DB check)
   before anything reaches production.

## Rollback

Each SQL file ends with a commented rollback block. `0001` is fully reversible
(drop the composite indexes, recreate the globals, drop `NOT NULL`). `0002`
rollback (`DISABLE ROW LEVEL SECURITY`) re-opens the tables and must only be run
with the GUC plumbing removed from the app.

## Status

- Ring 0.1 — `Tenant` model + nullable `tenantId` + self-healing backfill — **merged**.
- Ring 0.2 (BLD-300) — central query scoping + resolver + CI isolation guard — **merged**.
- Ring 1 (BLD-301) — this directory: reviewed SQL **authored, not applied**.
