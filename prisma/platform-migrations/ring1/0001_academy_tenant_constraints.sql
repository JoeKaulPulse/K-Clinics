-- ClinicOS Ring 1 (BLD-301) — Academy per-tenant constraints.
--
-- ⚠ PARTIALLY SUPERSEDED. The per-tenant UNIQUE part of this file (section 2) has
--   been applied for real via the versioned migration
--   prisma/migrations/20260617180000_academy_per_tenant_uniques/. What remains
--   live here is the `tenantId NOT NULL` part (section 1), which is DEFERRED to
--   the RLS phase (see ./README.md). This file is kept as the reference for that
--   step + the rollback.
--
-- ⚠ NOT APPLIED by any deploy. This directory is documentation/design only; it
--   is outside prisma/migrations/, so neither `prisma db push` nor
--   `prisma migrate deploy` ever runs it. See ./README.md for the apply path.
--
-- PRECONDITIONS (all must hold before applying):
--   1. scripts/verify-tenant-backfill.mjs reports ALL GREEN against the target DB
--      (zero NULL tenantId in every Academy table; no duplicate would-be uniques).
--   2. A pre-step snapshot / PITR bookmark is recorded (§6.4 of PLATFORM_SAAS_PLAN.md).
--   3. The platform track is on versioned migrations (USE_MIGRATIONS=true) with a
--      committed baseline — this SQL is promoted into prisma/migrations/ as a
--      reviewed migration, NOT run ad hoc against production.
--
-- Companion schema.prisma edits (made at promotion time, NOT now — adding them now
-- would break the live `db push` deploy, which refuses new @unique / NOT-NULL):
--   * drop the `?` on `tenantId` for all 22 Academy models (String? -> String)
--   * AcademyStudent: remove `@unique` on `email`; add `@@unique([tenantId, email])`
--   * Course:         remove `@unique` on `slug`;  add `@@unique([tenantId, slug])`
--   * Vacancy:        remove `@unique` on `slug`;  add `@@unique([tenantId, slug])`
--
-- Reversible: see the matching rollback block at the foot of this file.

BEGIN;

-- ── 1. tenantId NOT NULL (safe once the backfill is verified complete) ────────
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

-- ── 2. Per-tenant uniqueness ─────────────────────────────────────────────────
-- email/slug are GLOBALLY unique today — wrong the moment tenant #2 exists (two
-- clinics will legitimately share a student email or a "level-4" course slug).
-- Replace each global unique index with a composite (tenantId, …) one. Prisma
-- created the originals as unique INDEXES named "<Table>_<field>_key"; if your DB
-- has them as named CONSTRAINTS instead, use
--   ALTER TABLE "<Table>" DROP CONSTRAINT "<Table>_<field>_key";
-- The new index names match what `@@unique([tenantId, …])` generates, so the
-- promoted Prisma migration stays in lock-step.

DROP INDEX IF EXISTS "AcademyStudent_email_key";
CREATE UNIQUE INDEX "AcademyStudent_tenantId_email_key" ON "AcademyStudent" ("tenantId", "email");

DROP INDEX IF EXISTS "Course_slug_key";
CREATE UNIQUE INDEX "Course_tenantId_slug_key" ON "Course" ("tenantId", "slug");

DROP INDEX IF EXISTS "Vacancy_slug_key";
CREATE UNIQUE INDEX "Vacancy_tenantId_slug_key" ON "Vacancy" ("tenantId", "slug");

-- Intentionally left GLOBAL (not per-tenant):
--   * StudentPasskey.credentialId — a WebAuthn credential id is globally unique
--     by construction; scoping it would weaken, not help.
--   * Quiz.moduleId, LessonProgress(studentId,lessonId), StudentBadge(studentId,
--     badgeKey), DailyActivity(studentId,day) — already scoped structurally via a
--     FK to a tenant-owned row, so no tenant column is needed in the key.

COMMIT;

-- ── Rollback ─────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP INDEX IF EXISTS "AcademyStudent_tenantId_email_key";
-- CREATE UNIQUE INDEX "AcademyStudent_email_key" ON "AcademyStudent" ("email");
-- DROP INDEX IF EXISTS "Course_tenantId_slug_key";
-- CREATE UNIQUE INDEX "Course_slug_key" ON "Course" ("slug");
-- DROP INDEX IF EXISTS "Vacancy_tenantId_slug_key";
-- CREATE UNIQUE INDEX "Vacancy_slug_key" ON "Vacancy" ("slug");
-- ALTER TABLE "AcademyStudent"     ALTER COLUMN "tenantId" DROP NOT NULL;
-- -- … repeat DROP NOT NULL for the remaining 21 tables …
-- COMMIT;
