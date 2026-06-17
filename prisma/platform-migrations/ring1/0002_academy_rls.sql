-- ClinicOS Ring 1 (BLD-301) — Row-Level Security backstop for the Academy tables.
--
-- ⚠ NOT APPLIED by any deploy (see ./README.md). This is the database backstop
--   the plan mandates (ADR-015, R12): even if application code forgets a tenant
--   filter, Postgres will not return another tenant's rows.
--
-- ⚠⚠ HARD PRECONDITION — APPLYING THIS BEFORE THE APP SETS THE GUC WILL BREAK
--    THE LIVE ACADEMY. The policy below denies every row unless the connection
--    has set `app.tenant_id` for the current transaction. Today the app does NOT
--    set it, so enabling RLS now would make every Academy query return zero rows.
--    Apply ONLY after the Ring 1 app change ships, which wraps Academy DB work in
--      await db.$transaction(async (tx) => {
--        await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId);
--        … tenant-scoped queries on tx …
--      });
--    The `true` third argument makes the setting transaction-local — required
--    because Accelerate / PgBouncer multiplex one physical connection across
--    tenants, so a session-level SET would leak across requests.
--
-- ROLES:
--   * The runtime application role must be a NON-owner role (RLS does not apply to
--     a table's owner unless FORCE is set; we set FORCE so even an owner is bound).
--   * Keep a separate BYPASSRLS / owner role for migrations and platform-staff
--     break-glass (audited per §7.3). Do NOT run the live app as that role.

BEGIN;

-- Enable + force RLS and install one tenant-isolation policy per table.
-- (Listed explicitly rather than via a DO loop so the review diff is unambiguous.)

ALTER TABLE "AcademyStudent"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcademyStudent"     FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AcademyStudent";
CREATE POLICY tenant_isolation ON "AcademyStudent"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "StudentPasskey"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentPasskey"     FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "StudentPasskey";
CREATE POLICY tenant_isolation ON "StudentPasskey"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Course"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Course"             FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Course";
CREATE POLICY tenant_isolation ON "Course"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "CourseModule"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseModule"       FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CourseModule";
CREATE POLICY tenant_isolation ON "CourseModule"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Lesson"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson"             FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Lesson";
CREATE POLICY tenant_isolation ON "Lesson"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "HomeworkSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HomeworkSubmission" FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "HomeworkSubmission";
CREATE POLICY tenant_isolation ON "HomeworkSubmission"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Quiz"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quiz"               FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Quiz";
CREATE POLICY tenant_isolation ON "Quiz"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "QuizQuestion"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuizQuestion"       FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "QuizQuestion";
CREATE POLICY tenant_isolation ON "QuizQuestion"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "LessonProgress"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonProgress"     FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LessonProgress";
CREATE POLICY tenant_isolation ON "LessonProgress"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "QuizAttempt"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuizAttempt"        FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "QuizAttempt";
CREATE POLICY tenant_isolation ON "QuizAttempt"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ExamQuestion"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamQuestion"       FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ExamQuestion";
CREATE POLICY tenant_isolation ON "ExamQuestion"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "PastPaper"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PastPaper"          FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PastPaper";
CREATE POLICY tenant_isolation ON "PastPaper"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "PracticeAttempt"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PracticeAttempt"    FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PracticeAttempt";
CREATE POLICY tenant_isolation ON "PracticeAttempt"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "PointEvent"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PointEvent"         FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PointEvent";
CREATE POLICY tenant_isolation ON "PointEvent"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "StudentBadge"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentBadge"       FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "StudentBadge";
CREATE POLICY tenant_isolation ON "StudentBadge"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "DailyActivity"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyActivity"      FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DailyActivity";
CREATE POLICY tenant_isolation ON "DailyActivity"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "LiveClass"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveClass"          FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LiveClass";
CREATE POLICY tenant_isolation ON "LiveClass"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Cohort"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cohort"             FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Cohort";
CREATE POLICY tenant_isolation ON "Cohort"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Enrolment"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrolment"          FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Enrolment";
CREATE POLICY tenant_isolation ON "Enrolment"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "FundingApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FundingApplication" FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "FundingApplication";
CREATE POLICY tenant_isolation ON "FundingApplication"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Vacancy"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vacancy"            FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Vacancy";
CREATE POLICY tenant_isolation ON "Vacancy"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "JobApplication"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobApplication"     FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "JobApplication";
CREATE POLICY tenant_isolation ON "JobApplication"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

COMMIT;

-- ── Rollback (re-opens the tables — use only with the app GUC plumbing removed) ─
-- BEGIN;
-- DROP POLICY IF EXISTS tenant_isolation ON "AcademyStudent";
-- ALTER TABLE "AcademyStudent" NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "AcademyStudent" DISABLE ROW LEVEL SECURITY;
-- -- … repeat for the remaining 21 tables …
-- COMMIT;
