-- CreateTable
CREATE TABLE "ComplianceItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "provider" TEXT,
    "reference" TEXT,
    "renewalAt" TIMESTAMP(3) NOT NULL,
    "costPence" INTEGER,
    "notes" TEXT,
    "reminderDays" INTEGER[] DEFAULT ARRAY[90, 60, 30]::INTEGER[],
    "lastRemindedDays" INTEGER,
    "lastRenewedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceItem_active_renewalAt_idx" ON "ComplianceItem"("active", "renewalAt");

