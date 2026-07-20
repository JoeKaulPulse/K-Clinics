-- BLD-882: gift-voucher redemption against bookings at front-desk checkout.
-- Additive only: two new columns, nullable/defaulted, no existing rows change.
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "giftVoucherCode" TEXT,
ADD COLUMN     "giftVoucherPence" INTEGER NOT NULL DEFAULT 0;
