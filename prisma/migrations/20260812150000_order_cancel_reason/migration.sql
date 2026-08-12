-- Клиентская отмена: причина + комментарий. Аддитивно + идемпотентно.
DO $$ BEGIN
  CREATE TYPE "OrderCancelReason" AS ENUM
    ('CHANGED_MIND', 'ORDERED_BY_MISTAKE', 'PRICE', 'WAIT_TOO_LONG', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelReason" "OrderCancelReason";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelComment" TEXT;
