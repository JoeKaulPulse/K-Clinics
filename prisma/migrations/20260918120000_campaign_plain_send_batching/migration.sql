-- BLD-1832: the plain-text broadcast composer now records enough on the
-- Campaign row for the cron sweep to finish an interrupted send --
-- `format` ('text' only ever set by that composer, so the two stuck-SENDING
-- sweeps in lib/email-campaigns.ts stay disjoint) and the per-recipient
-- discount terms captured at send time. Additive only: four new nullable
-- columns, no constraint, index or type change.
--
-- IF NOT EXISTS because deploys currently run `prisma db push`
-- (scripts/db-sync.mjs), so these columns can already be present by the time
-- this migration is applied.

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "discountExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "discountType" TEXT,
ADD COLUMN IF NOT EXISTS "discountValue" INTEGER,
ADD COLUMN IF NOT EXISTS "format" TEXT;
