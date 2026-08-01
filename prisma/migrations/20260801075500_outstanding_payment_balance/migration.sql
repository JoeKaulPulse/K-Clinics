-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "outstandingPaymentPence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "lateFeeOwedAt" TIMESTAMP(3);

