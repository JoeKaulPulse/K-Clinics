-- BLD-1170: Product.vatClass — the per-product VAT class (STANDARD | REDUCED |
-- ZERO | EXEMPT) read by the VAT engine when folding retail order revenue into
-- the period VAT total. Nullable and additive only (null falls back to STANDARD),
-- so it is safe under the deploy gate and needs no backfill.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "vatClass" TEXT;
