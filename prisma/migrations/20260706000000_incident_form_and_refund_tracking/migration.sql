-- BLD-760: Internal Incident (Accident) form (new Incident table + INCIDENT/INCIDENT_LOGGED enum values)
-- BLD-767: Order.refundedPence — track cumulative Stripe card refunds for correct partial-refund reconciliation
-- BLD-757: Booking.chargeFailNotifiedPi — dedupe the client card-declined email/SMS across webhook redeliveries

-- AlterEnum
ALTER TYPE "InteractionType" ADD VALUE 'INCIDENT';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'INCIDENT_LOGGED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "chargeFailNotifiedPi" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "refundedPence" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bookingId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "severity" TEXT NOT NULL DEFAULT 'minor',
    "location" TEXT,
    "description" TEXT NOT NULL,
    "injury" TEXT,
    "actionTaken" TEXT,
    "witnesses" TEXT,
    "riddorReportable" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incident_clientId_createdAt_idx" ON "Incident"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_bookingId_idx" ON "Incident"("bookingId");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
