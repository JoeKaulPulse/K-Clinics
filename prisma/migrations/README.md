# Prisma Migrations

This directory holds the versioned migration history for K Clinics.

## Why versioned migrations?

`prisma db push` (the previous default) is fast for prototyping but:
- Has no migration history — can't roll back a bad deploy
- Required `--accept-data-loss` to handle column drops (dangerous in prod)
- Has no audit trail of what changed and when

Versioned migrations (`prisma migrate`) give:
- Explicit, reviewed SQL for every schema change
- A clear rollback path (revert the migration SQL)
- No surprise column drops — destructive changes require deliberate action
- A deployment record in the `_prisma_migrations` table

## Baseline & flip (how this repo is set up)

The production database was built by `prisma db push`, so it has the full schema
but no migration history. The flip to versioned migrations is handled without any
manual prod command:

1. `0_init/migration.sql` is the committed baseline — the entire current schema,
   generated with `prisma migrate diff --from-empty --to-schema prisma/schema.prisma`.
2. On the first deploy with `USE_MIGRATIONS=true`, `scripts/db-sync.mjs` detects
   "schema present, no `_prisma_migrations` history" and runs
   `prisma migrate resolve --applied 0_init` — this **records** `0_init` as applied
   **without running its DDL** (the tables already exist). It then runs
   `prisma migrate deploy`, which now sees `0_init` as done and applies only the
   later migrations.
3. On a genuinely empty database (e.g. a fresh branch) the guard skips adoption,
   so `migrate deploy` runs `0_init` and builds the schema from scratch.

So the flip is a no-op on prod data: it adopts the existing schema as the
baseline, then applies real migrations on top. All future schema changes go
through `prisma migrate dev` locally and `prisma migrate deploy` on deploy.

## Workflow for schema changes

1. Edit `prisma/schema.prisma` locally
2. Run `npx prisma migrate dev --name describe_your_change`
3. Prisma generates the SQL diff in `prisma/migrations/TIMESTAMP_describe_your_change/`
4. Review the generated SQL — check for `DROP COLUMN`, `DROP TABLE`, `ALTER TYPE` etc.
5. For destructive changes: write a data migration first (backfill, copy), then drop
6. Commit the migration file with your PR

## Expand/contract pattern (safe schema changes)

For changes that could break live traffic:

```
Phase 1 (expand):   Add new column/table (nullable, default value)
Phase 2 (migrate):  Backfill data from old column to new
Phase 3 (contract): Remove old column once all code uses the new one
```

Never remove a column in the same deploy that removes code references to it.

## RPO / RTO targets

| Data class       | RPO    | RTO   | Mechanism                        |
|-----------------|--------|-------|----------------------------------|
| PHI (clinical)  | ≤5 min | ≤1 h  | Neon PITR (point-in-time restore)|
| Financial        | ≤15 min| ≤2 h  | Neon PITR                        |
| Operational      | ≤1 h   | ≤4 h  | Daily snapshot restore           |

## Owner actions

- Enable Neon PITR on the production branch (Settings → Protection in Neon dashboard)
- Set backup retention to ≥30 days
- Run a DR drill quarterly: restore from PITR to a test branch and verify app health
- Document the last DR drill date here:

  Last drill: _not yet performed_
