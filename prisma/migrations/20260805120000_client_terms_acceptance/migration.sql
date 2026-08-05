-- Additive-only (BLD-1067): durable T&C / cancellation-policy acceptance
-- evidence on Client — when, from which surface, and which wording version.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedSource" TEXT,
ADD COLUMN     "termsVersion" TEXT;
