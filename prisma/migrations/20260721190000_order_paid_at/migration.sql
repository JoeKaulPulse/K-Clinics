-- PRJ-1032.7: Order.paidAt — the settlement timestamp, stamped when an order
-- flips to PAID, so day-close brackets card takings by the day the money was
-- actually taken (matching on updatedAt dragged an order into the wrong session
-- whenever a later fulfilment/refund edit moved the row). Additive and nullable
-- only, so it is safe under the deploy gate; day-close falls back to createdAt
-- for rows settled before this column existed.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_paidAt_idx" ON "Order"("paidAt");
