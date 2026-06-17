-- DropIndex
DROP INDEX "AcademyStudent_email_key";

-- DropIndex
DROP INDEX "Course_slug_key";

-- DropIndex
DROP INDEX "Vacancy_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "AcademyStudent_tenantId_email_key" ON "AcademyStudent"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Course_tenantId_slug_key" ON "Course"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Vacancy_tenantId_slug_key" ON "Vacancy"("tenantId", "slug");

