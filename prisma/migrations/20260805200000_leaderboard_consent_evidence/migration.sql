-- Additive-only (BLD-1122, owner decision 5 Aug: tick-with-record): evidence
-- trail for the membership-leaderboard consent — who switched it on and when.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "leaderboardConsentAt" TIMESTAMP(3),
ADD COLUMN     "leaderboardConsentBy" TEXT;
