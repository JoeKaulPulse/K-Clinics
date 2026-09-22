-- BLD-1869: Booking.pricePence 0 was overloaded as the "on consultation"
-- sentinel, so an appointment staff had deliberately priced at GBP 0 (via
-- overrideBookingPrice, reason required) displayed as "On consultation"
-- everywhere. This column records when a staff override was applied, so the
-- display can tell a deliberate zero from a never-priced booking. Additive
-- only: one new nullable column, no constraint, index or type change.
--
-- IF NOT EXISTS because deploys currently run `prisma db push`
-- (scripts/db-sync.mjs), so this column can already be present by the time
-- this migration is applied.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "priceOverriddenAt" TIMESTAMP(3);
