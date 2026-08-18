-- BLD-1354: demonstrable consent evidence (version + source) for the kiosk
-- facial-photo AI flow, mirroring the booking-page AI consult pattern.
-- AlterTable
ALTER TABLE "KioskSession" ADD COLUMN     "consentSource" TEXT,
ADD COLUMN     "consentVersion" TEXT;
