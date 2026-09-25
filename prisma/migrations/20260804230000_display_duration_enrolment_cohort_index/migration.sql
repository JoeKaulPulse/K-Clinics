-- Additive-only batch (BLD-998, BLD-1142):
--  - ServiceVariant.displayDurationMin: client-facing treatment length; the
--    internal durationMin (setup + treatment + cleaning) keeps driving slots
--  - Enrolment (cohortId, status) index: cohortsWithRemaining() groupBy runs on
--    every public course-page ISR and previously full-table-scanned

-- AlterTable
ALTER TABLE "ServiceVariant" ADD COLUMN     "displayDurationMin" INTEGER;

-- CreateIndex
CREATE INDEX "Enrolment_cohortId_status_idx" ON "Enrolment"("cohortId", "status");
