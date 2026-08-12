-- M4 follow-up: operator marks a no-show. Additive + idempotent.
ALTER TYPE "PropaneBookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';
