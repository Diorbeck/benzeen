-- Account deletion (анонимизация клиента). Additive + idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLIENT_ANONYMIZE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLIENT_HARD_DELETE';
