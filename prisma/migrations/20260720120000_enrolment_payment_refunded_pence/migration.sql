-- BLD-869: cumulative refund watermark for academy payments, mirroring
-- Booking.refundedPence. Additive only: one defaulted column.
-- AlterTable
ALTER TABLE "EnrolmentPayment" ADD COLUMN     "refundedPence" INTEGER NOT NULL DEFAULT 0;
