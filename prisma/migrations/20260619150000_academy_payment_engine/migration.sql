-- CreateEnum
CREATE TYPE "AcademyPaymentMethod" AS ENUM ('CARD', 'BNPL', 'BANK_TRANSFER', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "AcademyPaymentKind" AS ENUM ('FULL', 'DEPOSIT', 'BALANCE', 'INSTALMENT');

-- CreateEnum
CREATE TYPE "AcademyPaymentState" AS ENUM ('SCHEDULED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "AcademyStudent" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "Enrolment" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "certificateIssuedAt" TIMESTAMP(3),
ADD COLUMN     "certificateRef" TEXT,
ADD COLUMN     "offerExpiresAt" TIMESTAMP(3),
ADD COLUMN     "offeredAt" TIMESTAMP(3),
ADD COLUMN     "paymentPlan" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FundingApplication" ADD COLUMN     "enrolmentId" TEXT,
ADD COLUMN     "studentId" TEXT;

-- CreateTable
CREATE TABLE "EnrolmentPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "kind" "AcademyPaymentKind" NOT NULL DEFAULT 'FULL',
    "method" "AcademyPaymentMethod",
    "state" "AcademyPaymentState" NOT NULL DEFAULT 'PENDING',
    "amountPence" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "stripePaymentIntentId" TEXT,
    "note" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrolmentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrolmentPayment_enrolmentId_idx" ON "EnrolmentPayment"("enrolmentId");

-- CreateIndex
CREATE INDEX "EnrolmentPayment_tenantId_idx" ON "EnrolmentPayment"("tenantId");

-- CreateIndex
CREATE INDEX "EnrolmentPayment_state_dueAt_idx" ON "EnrolmentPayment"("state", "dueAt");

-- CreateIndex
CREATE INDEX "EnrolmentPayment_stripePaymentIntentId_idx" ON "EnrolmentPayment"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "AcademyStudent_clientId_idx" ON "AcademyStudent"("clientId");

-- CreateIndex
CREATE INDEX "FundingApplication_studentId_idx" ON "FundingApplication"("studentId");

-- CreateIndex
CREATE INDEX "FundingApplication_enrolmentId_idx" ON "FundingApplication"("enrolmentId");

-- AddForeignKey
ALTER TABLE "AcademyStudent" ADD CONSTRAINT "AcademyStudent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrolmentPayment" ADD CONSTRAINT "EnrolmentPayment_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingApplication" ADD CONSTRAINT "FundingApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "AcademyStudent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingApplication" ADD CONSTRAINT "FundingApplication_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

