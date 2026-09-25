-- BLD-1620: academy student in-app notifications (homework reviewed / needs
-- revision / approved) and a submission-history snapshot taken before a
-- resubmit overwrites the prior tutor feedback. Both tables are new and
-- additive; no existing table is altered.
-- CreateTable
CREATE TABLE "HomeworkSubmissionHistory" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "files" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "status" "HomeworkStatus" NOT NULL,
    "feedback" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkSubmissionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyNotification" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademyNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeworkSubmissionHistory_submissionId_createdAt_idx" ON "HomeworkSubmissionHistory"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "AcademyNotification_studentId_readAt_idx" ON "AcademyNotification"("studentId", "readAt");

-- CreateIndex
CREATE INDEX "AcademyNotification_studentId_createdAt_idx" ON "AcademyNotification"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "HomeworkSubmissionHistory" ADD CONSTRAINT "HomeworkSubmissionHistory_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyNotification" ADD CONSTRAINT "AcademyNotification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
