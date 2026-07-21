-- BLD-857: dunning fields on scheduled academy instalments (additive, defaulted).
-- Lets the daily cron send a capped, gently-paced payment reminder without
-- re-sending. Safe under the prisma db push deploy gate.
ALTER TABLE "EnrolmentPayment" ADD COLUMN IF NOT EXISTS "remindersSent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EnrolmentPayment" ADD COLUMN IF NOT EXISTS "lastRemindedAt" TIMESTAMP(3);
