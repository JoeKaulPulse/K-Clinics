-- BLD-1540: adds the ABANDONED_GIFTVOUCHER email kind used by the gift-voucher
-- abandonment recovery automation (invites a visitor to finish a gift-voucher
-- purchase they started but never paid for; gated off by default behind
-- abandoned_giftvoucher_recovery).
-- AlterEnum
ALTER TYPE "EmailKind" ADD VALUE 'ABANDONED_GIFTVOUCHER';
