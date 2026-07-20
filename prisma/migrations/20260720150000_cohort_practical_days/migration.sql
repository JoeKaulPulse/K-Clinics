-- BLD-881: per-cohort practical training days — additive table only.
CREATE TABLE IF NOT EXISTS "CohortPracticalDay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Practical training',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "trainer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortPracticalDay_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CohortPracticalDay_cohortId_startAt_idx" ON "CohortPracticalDay"("cohortId", "startAt");
CREATE INDEX IF NOT EXISTS "CohortPracticalDay_tenantId_idx" ON "CohortPracticalDay"("tenantId");

ALTER TABLE "CohortPracticalDay" ADD CONSTRAINT "CohortPracticalDay_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
