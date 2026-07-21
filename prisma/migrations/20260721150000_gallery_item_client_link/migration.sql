-- BLD-765: link a gallery before/after case to the client it depicts, so consent
-- is traceable and Art. 17 erasure can pull their photos off the public site.
-- Additive, nullable — safe under the prisma db push deploy gate.
ALTER TABLE "GalleryItem" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
CREATE INDEX IF NOT EXISTS "GalleryItem_clientId_idx" ON "GalleryItem"("clientId");
