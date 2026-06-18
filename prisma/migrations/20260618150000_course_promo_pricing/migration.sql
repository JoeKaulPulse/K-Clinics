-- AddColumns: Course promo pricing fields (BLD-490)
-- Written idempotently; safe no-op if already applied via prisma db push.
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "promoPrice" INTEGER;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "promoStartAt" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "promoEndAt" TIMESTAMP(3);
