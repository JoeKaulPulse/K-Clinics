-- BLD-760: staff-only Internal Incident (Accident) report, linked to the client
-- (and optionally the booking) it relates to. Additive only — a new enum value
-- and a new table, nothing existing changes. The injury/description free-text is
-- encrypted at rest by the app (encClinical) before it ever reaches
-- descriptionEnc; no clinical free-text is stored in the clear.

-- New AuditAction value for the "incident logged" event (non-clinical summary).
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INCIDENT_LOGGED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "Incident" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bookingId" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "location" TEXT,
    "descriptionEnc" TEXT NOT NULL,
    "riddorReportable" BOOLEAN NOT NULL DEFAULT false,
    "loggedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Incident_clientId_idx" ON "Incident"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Incident_bookingId_idx" ON "Incident"("bookingId");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
