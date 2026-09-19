-- BLD-1824: staff-recorded payment status for a package/course purchase settled
-- outside the online booking flow (bank transfer, in-clinic terminal, cash).
-- chargedAt/prepaidAt are only ever set by Stripe, so a package paid any other
-- way had no way to read as paid. Additive only: five new nullable columns, no
-- constraint, index or type change.
--
-- IF NOT EXISTS because deploys currently run `prisma db push`
-- (scripts/db-sync.mjs), so these columns can already be present by the time
-- this migration is applied.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "manualPaymentAmountPence" INTEGER,
ADD COLUMN IF NOT EXISTS "manualPaymentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "manualPaymentBy" TEXT,
ADD COLUMN IF NOT EXISTS "manualPaymentMethod" TEXT,
ADD COLUMN IF NOT EXISTS "manualPaymentStatus" TEXT;
