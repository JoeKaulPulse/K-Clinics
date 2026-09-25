-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CLIENT_STATUS_CHANGED';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "clientStatus" "ClientStatus",
ADD COLUMN     "clientStatusAt" TIMESTAMP(3),
ADD COLUMN     "clientStatusReason" TEXT,
ADD COLUMN     "clientStatusSetBy" TEXT;
