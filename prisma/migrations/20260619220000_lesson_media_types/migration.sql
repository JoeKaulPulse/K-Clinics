-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('TEXT', 'VIDEO', 'AUDIO', 'PDF', 'DOWNLOAD', 'EMBED');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "attachments" JSONB,
ADD COLUMN     "audioUrl" TEXT,
ADD COLUMN     "embedUrl" TEXT,
ADD COLUMN     "type" "LessonType" NOT NULL DEFAULT 'TEXT';

-- CreateTable
CREATE TABLE "LessonPlayback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "positionSec" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPlayback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonPlayback_studentId_idx" ON "LessonPlayback"("studentId");

-- CreateIndex
CREATE INDEX "LessonPlayback_tenantId_idx" ON "LessonPlayback"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPlayback_studentId_lessonId_key" ON "LessonPlayback"("studentId", "lessonId");

-- AddForeignKey
ALTER TABLE "LessonPlayback" ADD CONSTRAINT "LessonPlayback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlayback" ADD CONSTRAINT "LessonPlayback_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
