-- CreateTable
CREATE TABLE "CohortModuleRelease" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "releaseAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortModuleRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CohortModuleRelease_cohortId_idx" ON "CohortModuleRelease"("cohortId");

-- CreateIndex
CREATE INDEX "CohortModuleRelease_moduleId_idx" ON "CohortModuleRelease"("moduleId");

-- CreateIndex
CREATE INDEX "CohortModuleRelease_tenantId_idx" ON "CohortModuleRelease"("tenantId");

-- AddForeignKey
ALTER TABLE "CohortModuleRelease" ADD CONSTRAINT "CohortModuleRelease_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortModuleRelease" ADD CONSTRAINT "CohortModuleRelease_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

