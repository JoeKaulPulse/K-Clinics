-- BLD-1291: staff-assisted link from an academy portfolio case to the actual
-- photographed client, so the photos are reachable by erasure and SAR export.
-- AlterTable
ALTER TABLE "PortfolioEntry" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "PortfolioEntry_clientId_idx" ON "PortfolioEntry"("clientId");

-- AddForeignKey
ALTER TABLE "PortfolioEntry" ADD CONSTRAINT "PortfolioEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
