-- PRJ-1191.4: surfaces a calendar-sync failure to admins. Hostinger CalDAV
-- push/remove previously failed completely silently (console.error only); this
-- column is set after fetchWithRetry exhausts its attempts and cleared on the
-- next successful sync. Additive and nullable -- existing bookings have no
-- sync-error signal recorded, which is correct (no failure has been observed
-- for them under this mechanism).
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "calendarSyncError" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "calendarSyncErrorAt" TIMESTAMP(3);
