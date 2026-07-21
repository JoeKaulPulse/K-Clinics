-- Realign the migration history with prisma/schema.prisma.
--
-- The course-BNPL feature (BLD-399) added these four columns to model Booking in
-- prisma/schema.prisma WITHOUT a migration file. With USE_MIGRATIONS=true the
-- deploy runs `prisma migrate deploy`, which only applies migration files, so the
-- live database never got the columns. listBookings/getBooking default-select
-- every Booking column, so the query asked Postgres for Booking.prepaidVia →
-- "column does not exist" → /admin/bookings 500. This migration records the
-- columns so the history matches the schema again.
--
-- Written idempotently (ADD COLUMN IF NOT EXISTS): a one-off `prisma db push`
-- resync may already have added these, in which case `migrate deploy` applies
-- this as a safe no-op and simply records it as applied. If the columns are NOT
-- yet present, this migration adds them — so it is a complete fix on its own.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "prepaidVia" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "prepaidPence" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "prepaidAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "prepaidCheckoutId" TEXT;
