-- BLD-1203: Enrolment.analyticsConsent + marketingConsent -- the cookie-banner
-- choice (kc_analytics_consent / kc_marketing_consent) captured when the
-- learner starts an online payment, so the deferred server-side GA4/Meta
-- conversion (lib/conversions.ts), which fires from the Stripe webhook/confirm
-- endpoint with no request/cookie context of its own, can still honour a
-- visitor's rejection. Additive and nullable -- existing enrolments (including
-- ones with no online payment attempt) have no consent signal captured, and
-- sendPurchase() already treats missing consent as not-consented (fail closed).
ALTER TABLE "Enrolment" ADD COLUMN IF NOT EXISTS "analyticsConsent" BOOLEAN;
ALTER TABLE "Enrolment" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN;
