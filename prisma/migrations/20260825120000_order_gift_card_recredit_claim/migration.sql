-- BLD-1498: lease held by the payment_intent.canceled webhook handler while it
-- owes an order's gift-card re-credit. Non-null means that handler won the
-- PENDING->CANCELLED transition but has not yet confirmed creditVoucher
-- succeeded, so a Stripe redelivery may retry it once the lease has expired;
-- null means nothing is owed (another cancel path credited it, or the credit
-- landed). Additive and nullable — no backfill needed, no data loss.
-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "giftCardRecreditClaimedAt" TIMESTAMP(3);
