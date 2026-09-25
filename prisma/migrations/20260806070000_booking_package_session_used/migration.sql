-- BLD-1096: admin-only marker for a CANCELLED booking whose prepaid package
-- session was still consumed (vs credited back). Additive columns only.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "packageSessionUsedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "packageSessionUsedBy" TEXT;
