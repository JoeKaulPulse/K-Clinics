-- BLD-1572: adds the ClientDebt model (staff-recorded outstanding balance
-- / "Mark as Debt" action on the client profile) and the CLIENT_DEBT_RECORDED
-- audit action. Additive only: new table, new enum value, both new relation
-- columns nullable (SetNull on delete).

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CLIENT_DEBT_RECORDED';

-- CreateTable
CREATE TABLE "ClientDebt" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "bookingId" TEXT,
    "amountPence" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "ClientDebt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientDebt_clientId_idx" ON "ClientDebt"("clientId");

-- CreateIndex
CREATE INDEX "ClientDebt_bookingId_idx" ON "ClientDebt"("bookingId");

-- CreateIndex
CREATE INDEX "ClientDebt_clientId_resolvedAt_idx" ON "ClientDebt"("clientId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "ClientDebt" ADD CONSTRAINT "ClientDebt_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDebt" ADD CONSTRAINT "ClientDebt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

