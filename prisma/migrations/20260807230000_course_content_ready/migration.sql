-- BLD-1231: notify a paid/enrolled academy student once when the course they
-- enrolled on with zero content published its first lesson/quiz
-- (lib/automations.ts courseContentReady()). Both additive -- a new enum
-- value and a nullable column, neither destructive.
ALTER TYPE "EmailKind" ADD VALUE IF NOT EXISTS 'COURSE_CONTENT_READY';

-- AlterTable
ALTER TABLE "Enrolment" ADD COLUMN     "contentReadyNotifiedAt" TIMESTAMP(3);
