-- Add AI-100 to the FuelType enum.
-- Note: a new enum value cannot be used in the same transaction it is added,
-- so any data that references 'AI_100' lives in a separate, later migration.
ALTER TYPE "FuelType" ADD VALUE IF NOT EXISTS 'AI_100';
