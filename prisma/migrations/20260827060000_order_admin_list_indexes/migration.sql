-- BLD-1520: indexes for the /admin/orders hot path (lib/crm-data.ts listOrders()).
--
--  - Order(status, createdAt): listOrders() filters on status and orders by
--    createdAt desc with pagination on every load. The pre-existing single-column
--    Order_status_idx / Order_createdAt_idx could serve only one half of that, so
--    the sort fell back to a filter-then-sort. The composite serves both.
--    Order_status_idx is now a prefix of this index and therefore redundant, but it
--    is left in place deliberately: dropping it is not needed for correctness and
--    would make this migration destructive.
--  - OrderItem(orderId): listOrders() include:{items:true} issues a
--    WHERE "orderId" IN (...) per page. PostgreSQL does NOT index a foreign key
--    column automatically (unlike MySQL), so OrderItem_orderId_fkey left that
--    lookup as a sequential scan.
--
-- Additive only — creates indexes, changes no data, drops nothing. IF NOT EXISTS
-- because production may already be on the `prisma db push` path (scripts/db-sync.mjs
-- with USE_MIGRATIONS unset), which would have created these under the same Prisma
-- default names before this migration ever runs.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
