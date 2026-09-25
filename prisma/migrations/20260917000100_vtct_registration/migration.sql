-- BLD-1794: VTCT Registration Details -- a trainee's personal details +
-- identity documents required for awarding-body registration. Two new
-- tables, additive only: no existing table, column or constraint changes.
--
-- IF NOT EXISTS / guards throughout because deploys currently run
-- `prisma db push` (scripts/db-sync.mjs), so these objects can already exist
-- by the time this migration is applied.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "VtctRegistrationStatus" AS ENUM ('SUBMITTED', 'CONFIRMED', 'CHANGES_PENDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VtctDocumentKind" AS ENUM ('PHOTO_ID', 'PROOF_OF_ADDRESS', 'PRIOR_QUALIFICATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "VtctRegistration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleNames" TEXT,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "genderSelfDescribe" TEXT,
    "personalEmail" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "addressCity" TEXT NOT NULL,
    "addressPostcode" TEXT NOT NULL,
    "addressCountry" TEXT NOT NULL DEFAULT 'United Kingdom',
    "previouslyRegistered" BOOLEAN NOT NULL DEFAULT false,
    "priorLearnerCode" TEXT,
    "declarationAgreedAt" TIMESTAMP(3) NOT NULL,
    "status" "VtctRegistrationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "changeRequestedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VtctRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VtctRegistrationDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "kind" "VtctDocumentKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VtctRegistrationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VtctRegistration_studentId_idx" ON "VtctRegistration"("studentId");
CREATE INDEX IF NOT EXISTS "VtctRegistration_tenantId_idx" ON "VtctRegistration"("tenantId");
CREATE INDEX IF NOT EXISTS "VtctRegistration_status_idx" ON "VtctRegistration"("status");
CREATE INDEX IF NOT EXISTS "VtctRegistrationDocument_registrationId_idx" ON "VtctRegistrationDocument"("registrationId");
CREATE INDEX IF NOT EXISTS "VtctRegistrationDocument_tenantId_idx" ON "VtctRegistrationDocument"("tenantId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "VtctRegistration" ADD CONSTRAINT "VtctRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "VtctRegistrationDocument" ADD CONSTRAINT "VtctRegistrationDocument_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "VtctRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
