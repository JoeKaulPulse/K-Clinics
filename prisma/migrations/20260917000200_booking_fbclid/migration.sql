-- PRJ-1200.4: capture the Meta click id (fbclid) alongside the existing
-- gclid, for Meta CAPI user_data fbc matching. Additive only.
--
-- IF NOT EXISTS because deploys currently run `prisma db push`
-- (scripts/db-sync.mjs), so this column can already exist by the time this
-- migration is applied.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "fbclid" TEXT;
