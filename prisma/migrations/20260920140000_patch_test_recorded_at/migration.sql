-- BLD-1846: staff can now backdate patchTestDate to the actual (possibly
-- historical) date a patch test was performed, so it needed a separate,
-- always-server-set audit timestamp of when the entry was made. Additive
-- only: one new nullable column, no constraint, index or type change.
--
-- IF NOT EXISTS because deploys currently run `prisma db push`
-- (scripts/db-sync.mjs), so this column can already be present by the time
-- this migration is applied.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "patchTestRecordedAt" TIMESTAMP(3);
