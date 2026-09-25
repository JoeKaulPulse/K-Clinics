-- BLD-1763: adds the two audit actions written when staff edit or clear an
-- existing staff-recorded outstanding balance ("Mark as Debt", BLD-1572).
-- Additive only: two new enum values, no table, column or constraint change.
--
-- IF NOT EXISTS because deploys currently run `prisma db push` (scripts/db-sync.mjs),
-- so the values can already be present by the time these files are applied.
-- Neither value is referenced elsewhere in this migration, so adding them
-- inside the migration transaction is safe on Postgres 12+.

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLIENT_DEBT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLIENT_DEBT_RESOLVED';
