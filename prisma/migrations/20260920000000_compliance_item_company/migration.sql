-- BLD-1830: compliance calendar for two K-Clinics legal entities (KClinics
-- Group Limited, KClinics Skin & Laser Limited), built on the existing
-- Compliance & Renewals feature (BLD-587) rather than a new page. Adds one
-- nullable column so the admin UI can group/filter statutory deadlines by
-- legal entity; existing rows (insurance, licences, PAT testing…) are
-- unaffected and keep showing unfiltered/ungrouped. Additive only: one new
-- nullable column, no constraint, index or type change.
--
-- IF NOT EXISTS because deploys currently run `prisma db push`
-- (scripts/db-sync.mjs), so this column can already be present by the time
-- this migration is applied.

-- AlterTable
ALTER TABLE "ComplianceItem" ADD COLUMN IF NOT EXISTS "company" TEXT;
