-- Этап 2 (client comfort): рейтинг доставки + адрес по умолчанию.
-- Аддитивно + идемпотентно.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ratingComment" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultLocationId" TEXT;

DO $$ BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_defaultLocationId_fkey"
    FOREIGN KEY ("defaultLocationId") REFERENCES "SavedLocation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
