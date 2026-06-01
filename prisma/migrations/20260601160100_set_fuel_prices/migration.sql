-- Set per-liter fuel prices (UZS). Idempotent: updates existing rows, inserts
-- missing ones. AI-100 is now available (added in the previous migration).
INSERT INTO "Price" ("id", "fuelType", "priceUzs", "updatedAt") VALUES
  (gen_random_uuid()::text, 'AI_92', 13800, now()),
  (gen_random_uuid()::text, 'AI_95', 15800, now()),
  (gen_random_uuid()::text, 'AI_100', 20900, now())
ON CONFLICT ("fuelType") DO UPDATE
  SET "priceUzs" = EXCLUDED."priceUzs", "updatedAt" = now();
