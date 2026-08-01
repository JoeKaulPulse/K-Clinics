-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'STUDENT_ERASED';

-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "imageAlt" TEXT;

-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN     "imageAlt" TEXT;

