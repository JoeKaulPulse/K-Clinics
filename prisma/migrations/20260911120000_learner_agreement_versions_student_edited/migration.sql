-- BLD-1731 / BLD-1732: additive-only batch.
--  - LearnerAgreementVersion: versioned, publishable Learner Agreement wording,
--    editable from the K Academy admin area instead of hardcoded in
--    lib/learner-agreement.ts. New table; existing enrolments' stamped
--    agreementVersion strings are untouched.
--  - AuditAction.STUDENT_EDITED: new audit event for an admin editing a
--    trainee's first/last name from /admin/academy/students/[id].

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STUDENT_EDITED';

-- CreateEnum
CREATE TYPE "LearnerAgreementStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "LearnerAgreementVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "status" "LearnerAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerAgreementVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LearnerAgreementVersion_status_publishedAt_idx" ON "LearnerAgreementVersion"("status", "publishedAt");
