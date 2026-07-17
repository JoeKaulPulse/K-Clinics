-- BLD-844: additive-only patch-test status fields on Client, mirroring the
-- existing medicalFlag triad. New AuditAction enum value for the audit trail.
-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PATCH_TEST_RECORDED';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "patchTestDate" TIMESTAMP(3),
ADD COLUMN     "patchTestResult" TEXT,
ADD COLUMN     "patchTestSetBy" TEXT;
