-- BLD-714: Stripe webhook idempotency ledger (defence-in-depth over the
-- already-idempotent handlers). New table, so no @unique-on-existing-table
-- hazard; the Stripe event id is the primary key. Additive and non-destructive
-- (safe under the prisma db push deploy gate).
CREATE TABLE IF NOT EXISTS "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProcessedStripeEvent_receivedAt_idx" ON "ProcessedStripeEvent"("receivedAt");
