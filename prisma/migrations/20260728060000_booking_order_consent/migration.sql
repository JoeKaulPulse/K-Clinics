-- PRJ-1034.4: Booking/Order.analyticsConsent + marketingConsent -- the
-- cookie-banner choice (kc_analytics_consent / kc_marketing_consent) captured
-- at booking/checkout time, so the deferred server-side GA4/Meta conversion
-- (lib/conversions.ts), which often fires later from a Stripe webhook with no
-- request/cookie context of its own, can still honour a visitor's rejection.
-- Additive and defaulted only -- existing rows default to false (fail closed;
-- no prior consent signal was ever captured for them).
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "analyticsConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "analyticsConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
