-- PRJ-1043.2: idempotency-ledger status so a critical event whose handler
-- failed last time (left at 'PROCESSING') is re-run on redelivery instead of
-- being silently acked as a duplicate. Additive, defaulted -- existing rows
-- backfill to 'DONE' (treats historical events as already-completed).
ALTER TABLE "ProcessedStripeEvent" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DONE';
