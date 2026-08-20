-- BLD-1418: timestamp when a kiosk session was claimed into 'analyzing', so a
-- session whose background analysis job was platform-killed before it could
-- reset stage can be re-claimed past a threshold instead of wedging forever.
-- AlterTable
ALTER TABLE "KioskSession" ADD COLUMN     "analyzingSince" TIMESTAMP(3);
