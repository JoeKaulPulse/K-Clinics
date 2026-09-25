-- Additive-only batch (BLD-1139, PRJ-1069.12, BLD-1037):
--  - QuizAttemptGrant: staff-granted extra quiz attempts (escape hatch for
--    exhausted attempt limits; history never deleted)
--  - AuditAction.PAYMENT_DISPUTED: chargeback/dispute events from Stripe
--  - GalleryItem.consentBy/consentAt: evidence trail for the publish-consent tick

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_DISPUTED';

-- AlterTable
ALTER TABLE "GalleryItem" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "consentBy" TEXT;

-- CreateTable
CREATE TABLE "QuizAttemptGrant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "extra" INTEGER NOT NULL,
    "reason" TEXT,
    "grantedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttemptGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizAttemptGrant_studentId_quizId_idx" ON "QuizAttemptGrant"("studentId", "quizId");

-- CreateIndex
CREATE INDEX "QuizAttemptGrant_tenantId_idx" ON "QuizAttemptGrant"("tenantId");

-- AddForeignKey
ALTER TABLE "QuizAttemptGrant" ADD CONSTRAINT "QuizAttemptGrant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttemptGrant" ADD CONSTRAINT "QuizAttemptGrant_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
