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

## Getting started (one-time setup)

1. Ensure `DATABASE_URL` points to a copy/snapshot of the production database
2. Run: `npx prisma migrate dev --name init`
3. This creates `prisma/migrations/TIMESTAMP_init/migration.sql` — the baseline
4. Commit the new directory
5. Set `USE_MIGRATIONS=true` in Vercel environment variables
6. All future deploys will use `prisma migrate deploy` instead of `db push`

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
