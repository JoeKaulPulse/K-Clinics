-- BLD-1874: show and allow correcting how a booking's treatment charge was
-- actually taken (card on file, payment link, cash, card terminal,
-- Treatwell, ClassPass, ...). Additive only: one new nullable column, no
-- constraint, index or type change. Never backfilled for historical rows.
--
-- IF NOT EXISTS because deploys currently run `prisma db push`
-- (scripts/db-sync.mjs), so this column can already be present by the time
-- this migration is applied.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
