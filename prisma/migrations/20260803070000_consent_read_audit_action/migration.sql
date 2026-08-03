-- PRJ-1069.7: additive-only CONSENT_READ audit action for GET /api/consent/[token].
-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_READ';
