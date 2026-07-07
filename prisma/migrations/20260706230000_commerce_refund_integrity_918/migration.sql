-- PRJ-918.2 / PRJ-918.10: additive-only columns for Stripe charge.refunded
-- reconciliation. GiftVoucher.purchaseRefundedPence is the CAS watermark for
-- debiting (never crediting) a voucher's own purchase-refund; Order.restockedAt
-- guards restockOrder() so a redelivered webhook can't double-restock.
-- AlterTable
ALTER TABLE "GiftVoucher" ADD COLUMN     "purchaseRefundedPence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "restockedAt" TIMESTAMP(3);
