-- AlterTable
ALTER TABLE "AcademyStudent" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StudentPasskey" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CourseModule" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Lesson" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "HomeworkSubmission" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Quiz" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "QuizQuestion" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "LessonProgress" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "QuizAttempt" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ExamQuestion" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PastPaper" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PracticeAttempt" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PointEvent" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StudentBadge" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "DailyActivity" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "LiveClass" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Cohort" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Enrolment" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "FundingApplication" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Vacancy" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "JobApplication" ALTER COLUMN "tenantId" SET NOT NULL;

