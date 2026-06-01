#!/bin/sh
set -e

echo "▶ Clearing any failed migration state..."
npx prisma migrate resolve --rolled-back 20250228000000_add_notifications 2>/dev/null || true

echo "▶ Running database migrations..."
npx prisma migrate deploy

if [ "$RESET_DEMO_DATA" = "true" ]; then
  echo "▶ RESET_DEMO_DATA=true — wiping all data and recreating SUPER_ADMIN..."
  node scripts/reset-demo-data.cjs
  echo "▶ Done. IMPORTANT: remove RESET_DEMO_DATA from env to avoid wiping on next deploy."
fi

echo "▶ Checking seed status..."
USER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count()
  .then(n => { process.stdout.write(String(n)); return p.\$disconnect(); })
  .catch(() => { process.stdout.write('0'); });
")

echo "   Users in DB: $USER_COUNT"

if [ "$USER_COUNT" = "0" ]; then
  echo "▶ Database empty — running seed..."
  npx prisma db seed
else
  echo "▶ Database already seeded — skipping"
fi

echo "▶ Starting Next.js..."
exec npx next start
