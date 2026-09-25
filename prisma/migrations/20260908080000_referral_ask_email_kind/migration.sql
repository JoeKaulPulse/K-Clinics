-- BLD-1664: adds the REFERRAL_ASK email kind used by the referral-ask
-- automation (invites a client to refer a friend, 5-10 days after a
-- completed visit; gated off by default behind referral_ask_email).
-- AlterEnum
ALTER TYPE "EmailKind" ADD VALUE 'REFERRAL_ASK';
