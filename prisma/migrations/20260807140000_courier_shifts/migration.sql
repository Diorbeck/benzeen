-- Курьер 2.0 PR-1: courier shifts (on/off duty) + TAKE→DELIVERED timing for
-- /stats. Additive + idempotent — no column drops, no backfills.

-- Courier shift flag. Existing rows default to false (off duty). Semantically
-- used only for COURIER users; harmless on every other role.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onDuty" BOOLEAN NOT NULL DEFAULT false;

-- Timestamp captured when a courier TAKEs an order. Paired with the existing
-- "deliveredAt" to compute average TAKE→DELIVERED time. Nullable; only set for
-- orders taken after this migration ships (no backfill of historical orders).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "takenAt" TIMESTAMP(3);
