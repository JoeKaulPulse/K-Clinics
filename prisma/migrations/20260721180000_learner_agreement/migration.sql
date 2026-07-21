-- BLD-730: signed Learner (Training) Agreement on the enrolment — typed name,
-- timestamp and wording version captured at the pre-course gate. Additive,
-- nullable only (safe under the prisma db push deploy gate).
ALTER TABLE "Enrolment" ADD COLUMN IF NOT EXISTS "agreementSignedAt" TIMESTAMP(3);
ALTER TABLE "Enrolment" ADD COLUMN IF NOT EXISTS "agreementSignedName" TEXT;
ALTER TABLE "Enrolment" ADD COLUMN IF NOT EXISTS "agreementVersion" TEXT;
