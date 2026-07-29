-- B2C pivot: clients sign in by phone + SMS and get the CLIENT role.
-- Additive and idempotent: a new enum value never touches existing rows, and
-- IF NOT EXISTS makes re-running safe. A new enum value cannot be used in the
-- same transaction it is added, so any code referencing 'CLIENT' runs later.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CLIENT';
