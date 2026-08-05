-- Additive-only (BLD-1014 / BLD-1098): package (course) session tracking.
-- A session booked against an already-purchased course links back to the
-- purchase booking, so used/remaining balances derive from real bookings.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "packageBookingId" TEXT;

-- CreateIndex
CREATE INDEX "Booking_packageBookingId_idx" ON "Booking"("packageBookingId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_packageBookingId_fkey" FOREIGN KEY ("packageBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
