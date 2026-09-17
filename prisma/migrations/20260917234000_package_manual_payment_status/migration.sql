-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "manualPaymentAmountPence" INTEGER,
ADD COLUMN     "manualPaymentAt" TIMESTAMP(3),
ADD COLUMN     "manualPaymentBy" TEXT,
ADD COLUMN     "manualPaymentMethod" TEXT,
ADD COLUMN     "manualPaymentStatus" TEXT;

