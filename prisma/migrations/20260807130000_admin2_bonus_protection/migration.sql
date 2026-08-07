-- PR-C: Кабинет 2.0 admin + bonus-program protection. Additive + idempotent.
-- No column drops, no destructive backfills. Existing ledger rows become POSTED
-- (they were already counted), so the balance is unchanged by this migration.

-- New ledger status enum. Only POSTED rows count toward balance + milestone.
DO $$ BEGIN
  CREATE TYPE "BonusLedgerStatus" AS ENUM ('POSTED', 'PENDING', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Additive enum values. `ADD VALUE IF NOT EXISTS` is itself idempotent and must
-- run as a top-level statement (ALTER TYPE ADD VALUE is not allowed inside a
-- DO/function block). Safe to re-run.
ALTER TYPE "BonusReason" ADD VALUE IF NOT EXISTS 'ADMIN_ADJUSTMENT';

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BONUS_FREEZE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BONUS_UNFREEZE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BONUS_ADJUSTMENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BONUS_APPROVE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BONUS_REJECT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPPORT_RESOLVE';

-- User: bonus freeze flag. Existing rows default to false (not frozen).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bonusFrozen" BOOLEAN NOT NULL DEFAULT false;

-- BonusLedger: status + admin metadata. Existing rows become POSTED via the
-- NOT NULL DEFAULT so the current balance is preserved exactly.
ALTER TABLE "BonusLedger" ADD COLUMN IF NOT EXISTS "status" "BonusLedgerStatus" NOT NULL DEFAULT 'POSTED';
ALTER TABLE "BonusLedger" ADD COLUMN IF NOT EXISTS "adminComment" TEXT;
ALTER TABLE "BonusLedger" ADD COLUMN IF NOT EXISTS "adminId" TEXT;

CREATE INDEX IF NOT EXISTS "BonusLedger_status_idx" ON "BonusLedger"("status");
CREATE INDEX IF NOT EXISTS "BonusLedger_reason_status_idx" ON "BonusLedger"("reason", "status");
