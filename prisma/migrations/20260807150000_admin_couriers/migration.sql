-- Курьер 2.0 PR-2: admin couriers section. Additive + idempotent — no column
-- drops, no backfills. Adds a courier deactivation flag and audit actions for
-- the deactivate/activate toggle and the privacy-critical CSV export.

-- Courier deactivation. NULL = active (every existing row). When set, the
-- courier can no longer authenticate and is excluded from dispatch. Nullable;
-- semantically used only for COURIER users, harmless on every other role.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);

-- Additive enum values. `ADD VALUE IF NOT EXISTS` is itself idempotent and must
-- run as a top-level statement (ALTER TYPE ADD VALUE is not allowed inside a
-- DO/function block). Safe to re-run.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COURIER_DEACTIVATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COURIER_ACTIVATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COURIER_CSV_EXPORT';
