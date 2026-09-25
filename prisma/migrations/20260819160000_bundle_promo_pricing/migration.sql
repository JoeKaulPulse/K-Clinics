-- BLD-1376: time-boxed promotional pricing for course bundles, mirroring the Course promo fields (BLD-490).
-- AlterTable
ALTER TABLE "CourseBundle" ADD COLUMN     "promoEndAt" TIMESTAMP(3),
ADD COLUMN     "promoPrice" INTEGER,
ADD COLUMN     "promoStartAt" TIMESTAMP(3);

