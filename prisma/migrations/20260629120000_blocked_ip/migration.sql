-- BLD security audit: manually-blocked IP deny list for the admin Activity &
-- blocking page. Additive, non-destructive (new table only).
CREATE TABLE "BlockedIp" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockedIp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BlockedIp_ip_active_idx" ON "BlockedIp"("ip", "active");
CREATE INDEX "BlockedIp_active_createdAt_idx" ON "BlockedIp"("active", "createdAt");
