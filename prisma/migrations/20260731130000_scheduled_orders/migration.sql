-- Scheduled B2C orders. Additive + idempotent.
-- New enum value (can't be used in the same tx it's added — used later at runtime).
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

-- Planned delivery time.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3);
