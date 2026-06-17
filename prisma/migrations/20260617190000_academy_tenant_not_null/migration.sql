-- ClinicOS Ring 1c — make tenantId NOT NULL on the Academy tables.
--
-- Self-sufficient: first backfill any rows still NULL to the default (K Clinics)
-- tenant, then enforce NOT NULL. The default tenant id is resolved from the Tenant
-- table (not hard-coded), so this is portable across environments. This removes any
-- dependency on the Ring 0 cron backfill having run first — the migration cannot
-- fail on pre-existing NULLs, and runs atomically in one transaction.

-- 1. Backfill remaining NULL tenantId to the default tenant.
UPDATE "AcademyStudent"     SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "StudentPasskey"     SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "Course"             SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "CourseModule"       SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "Lesson"             SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "HomeworkSubmission" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "Quiz"               SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "QuizQuestion"       SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "LessonProgress"     SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "QuizAttempt"        SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "ExamQuestion"       SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "PastPaper"          SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "PracticeAttempt"    SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "PointEvent"         SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "StudentBadge"       SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "DailyActivity"      SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "LiveClass"          SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "Cohort"             SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "Enrolment"          SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "FundingApplication" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "Vacancy"            SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "JobApplication"     SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'kclinics' LIMIT 1) WHERE "tenantId" IS NULL;

-- 2. Enforce NOT NULL.
ALTER TABLE "AcademyStudent"     ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "StudentPasskey"     ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Course"             ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CourseModule"       ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Lesson"             ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "HomeworkSubmission" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Quiz"               ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "QuizQuestion"       ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "LessonProgress"     ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "QuizAttempt"        ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ExamQuestion"       ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "PastPaper"          ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "PracticeAttempt"    ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "PointEvent"         ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "StudentBadge"       ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "DailyActivity"      ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "LiveClass"          ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Cohort"             ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Enrolment"          ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "FundingApplication" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Vacancy"            ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "JobApplication"     ALTER COLUMN "tenantId" SET NOT NULL;
