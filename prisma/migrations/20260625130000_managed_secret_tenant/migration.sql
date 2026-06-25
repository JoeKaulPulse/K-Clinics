-- BLD-302/R15: per-tenant secrets groundwork. Additive nullable column + index;
-- per-tenant uniqueness stays structural (namespaced "t:<tenantId>:<name>" key),
-- so the existing `name` primary key is unchanged.
ALTER TABLE "ManagedSecret" ADD COLUMN     "tenantId" TEXT;
CREATE INDEX "ManagedSecret_tenantId_idx" ON "ManagedSecret"("tenantId");
