-- AddColumn: Cohort.name (BLD-484)
-- Written idempotently; safe no-op if already applied via prisma db push.
ALTER TABLE "Cohort" ADD COLUMN IF NOT EXISTS "name" TEXT;
