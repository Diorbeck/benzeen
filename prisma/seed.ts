import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@benzeen.uz').trim().toLowerCase();
  const password = (process.env.SUPER_ADMIN_PASSWORD || 'AD4543895').trim();
  const adminHash = await bcrypt.hash(password, 10);

  // Fuel prices
  await prisma.price.upsert({
    where: { fuelType: 'AI_92' },
    create: { fuelType: 'AI_92', priceUzs: 9500 },
    update: { priceUzs: 9500 },
  });
  await prisma.price.upsert({
    where: { fuelType: 'AI_95' },
    create: { fuelType: 'AI_95', priceUzs: 10500 },
    update: { priceUzs: 10500 },
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
