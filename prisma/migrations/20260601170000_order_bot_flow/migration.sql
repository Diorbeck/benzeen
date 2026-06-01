-- Telegram bot confirmation flow + delivery location on orders (additive, safe).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "botPhase" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
