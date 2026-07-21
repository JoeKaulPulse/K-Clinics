-- BLD-702: audited AI-processing consent for facial-image analysis.
-- Additive, non-destructive (safe under the prisma db push deploy gate).
ALTER TABLE "AiAnalysis" ADD COLUMN IF NOT EXISTS "consentVersion" TEXT;
ALTER TABLE "AiAnalysis" ADD COLUMN IF NOT EXISTS "consentSource" TEXT;
