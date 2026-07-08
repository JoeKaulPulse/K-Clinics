-- PRJ-939.7: composite indexes for the public booking-availability hot path
-- (lib/availability.ts cliniciansForDay/slot search filters by status + startAt,
-- often + locationId) -- additive only, no data change.
CREATE INDEX "Booking_status_startAt_idx" ON "Booking"("status", "startAt");

CREATE INDEX "Booking_locationId_startAt_idx" ON "Booking"("locationId", "startAt");
