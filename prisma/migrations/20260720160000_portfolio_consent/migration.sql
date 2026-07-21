-- BLD-740: subject-consent attestation for portfolio before/after photos —
-- additive nullable column only. Stamped when the trainee ticks the consent
-- confirmation on an entry that carries photos.
ALTER TABLE "PortfolioEntry" ADD COLUMN IF NOT EXISTS "consentAttestedAt" TIMESTAMP(3);
