-- Delivery confirmation flow: courier-reported amount + disputed status (additive, safe).
-- Both changes are additive: the column is nullable and the enum value is new,
-- so applying this migration cannot lose data.

-- Actual dispensed liters reported by the courier; the ordered `volume` is preserved.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "dispensedVolume" INTEGER;

-- New terminal-ish status when the driver disputes the courier-reported amount.
-- A new enum value cannot be used in the same transaction it is added.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';
