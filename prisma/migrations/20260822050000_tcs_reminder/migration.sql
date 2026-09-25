-- BLD-1452: adds the TCS_REMINDER email kind and the per-client dedupe/cadence
-- timestamp for the "please accept T&Cs + add a card" reminder.
-- AlterEnum
ALTER TYPE "EmailKind" ADD VALUE 'TCS_REMINDER';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "tcsReminderSentAt" TIMESTAMP(3);
