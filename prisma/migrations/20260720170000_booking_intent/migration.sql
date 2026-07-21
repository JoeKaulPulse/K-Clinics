-- BLD-838 / BLD-853: booking-funnel email capture ("email me my selection") plus
-- a one-time recovery nudge. Additive only — new enum value + new table.

-- New EmailKind value for the recovery email's dedup EmailEvent row.
ALTER TYPE "EmailKind" ADD VALUE IF NOT EXISTS 'BOOKING_INTENT';

-- Anonymous funnel intents: an optional email left after treatment selection,
-- before the deferred account step. No tenantId / no unique (mirrors
-- NewsletterSubscriber); dedupe is structural (24h window in the API, per-row
-- emailedAt/recoveredAt stamps in the automation).
CREATE TABLE IF NOT EXISTS "BookingIntent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "treatmentSlug" TEXT NOT NULL,
    "treatmentTitle" TEXT NOT NULL,
    "variantLabel" TEXT,
    "source" TEXT NOT NULL DEFAULT 'funnel',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recoveredAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),

    CONSTRAINT "BookingIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BookingIntent_email_treatmentSlug_idx" ON "BookingIntent"("email", "treatmentSlug");
CREATE INDEX IF NOT EXISTS "BookingIntent_createdAt_idx" ON "BookingIntent"("createdAt");
