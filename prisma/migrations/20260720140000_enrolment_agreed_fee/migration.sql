-- BLD-850: lock the quoted course fee at offer / first-payment time so a promo
-- starting or expiring mid-enrolment never re-prices what the learner agreed.
-- Additive and nullable — existing rows keep the legacy live-promo derivation
-- until their next offer/payment stamps the field.
ALTER TABLE "Enrolment" ADD COLUMN IF NOT EXISTS "agreedFeePence" INTEGER;
