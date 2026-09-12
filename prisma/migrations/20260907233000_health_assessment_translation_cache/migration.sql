-- BLD-1658: encrypted cache of the machine translation shown to staff for a
-- health assessment's free-text answers, so a repeat view doesn't re-send the
-- special-category text to Google Translate every time. New, additive table
-- only; HealthAssessment itself (append-only, never updated) is untouched.
-- CreateTable
CREATE TABLE "HealthAssessmentTranslation" (
    "assessmentId" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "cipher" TEXT NOT NULL,
    "integrityHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthAssessmentTranslation_pkey" PRIMARY KEY ("assessmentId")
);

-- AddForeignKey
ALTER TABLE "HealthAssessmentTranslation" ADD CONSTRAINT "HealthAssessmentTranslation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "HealthAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
