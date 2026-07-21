-- AddColumns: RoomPrep manual occupancy (BLD-506)
-- Written idempotently; safe no-op if already applied via prisma db push.
ALTER TABLE "RoomPrep" ADD COLUMN IF NOT EXISTS "occupied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RoomPrep" ADD COLUMN IF NOT EXISTS "occupiedAt" TIMESTAMP(3);
ALTER TABLE "RoomPrep" ADD COLUMN IF NOT EXISTS "occupiedBy" TEXT;
