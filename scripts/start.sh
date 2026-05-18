#!/bin/sh
set -e

echo "▶ Clearing any failed migration state..."
npx prisma migrate resolve --rolled-back 20250228000000_add_notifications 2>/dev/null || true

echo "▶ Running database migrations..."
npx prisma migrate deploy

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
