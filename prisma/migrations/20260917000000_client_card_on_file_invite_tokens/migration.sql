-- BLD-1797: self-service card-on-file (Client.stripeDefaultPaymentMethodId)
-- and a dedicated passwordless-invite token pair (Client.inviteTokenHash /
-- inviteTokenExp), split off the shared password-reset columns so a second
-- invite/reset no longer silently invalidates the other. Additive only: three
-- new nullable columns, no constraint or table change.
--
-- IF NOT EXISTS because deploys currently run `prisma db push` (scripts/db-sync.mjs),
-- so the columns can already be present by the time this migration is applied.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "inviteTokenExp" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "inviteTokenHash" TEXT,
ADD COLUMN IF NOT EXISTS "stripeDefaultPaymentMethodId" TEXT;
