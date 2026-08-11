import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@benzeen.uz').trim().toLowerCase();
  const password = (process.env.SUPER_ADMIN_PASSWORD || 'AD4543895').trim();
  const adminHash = await bcrypt.hash(password, 10);

  // Fuel prices (UZS per liter)
  await prisma.price.upsert({
    where: { fuelType: 'AI_92' },
    create: { fuelType: 'AI_92', priceUzs: 13800 },
    update: { priceUzs: 13800 },
  });
  await prisma.price.upsert({
    where: { fuelType: 'AI_95' },
    create: { fuelType: 'AI_95', priceUzs: 15800 },
    update: { priceUzs: 15800 },
  });
  await prisma.price.upsert({
    where: { fuelType: 'AI_100' },
    create: { fuelType: 'AI_100', priceUzs: 20900 },
    update: { priceUzs: 20900 },
  });

  // Single SUPER_ADMIN — no demo company/driver/courier data.
  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'Super Admin',
      passwordHash: adminHash,
      role: 'SUPER_ADMIN',
    },
    update: {
      passwordHash: adminHash,
      role: 'SUPER_ADMIN',
      companyId: null,
    },
  });

  // M4 Propane: two demo points in Tashkent (idempotent by fixed ids).
  await prisma.propanePoint.upsert({
    where: { id: 'seed-propane-chilanzar' },
    update: {},
    create: {
      id: 'seed-propane-chilanzar',
      name: 'Чиланзар, 7-й квартал',
      lat: 41.2757,
      lng: 69.2034,
      priceUzs: 8500,
      postsCount: 2,
    },
  });
  await prisma.propanePoint.upsert({
    where: { id: 'seed-propane-yunusabad' },
    update: {},
    create: {
      id: 'seed-propane-yunusabad',
      name: 'Юнусабад, 19-й квартал',
      lat: 41.3665,
      lng: 69.2946,
      priceUzs: 8500,
      postsCount: 1,
    },
  });

  console.log('Seed completed:');
  console.log(`  Admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
