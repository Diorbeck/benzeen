// One-time data reset: wipes ALL records and recreates only the SUPER_ADMIN + prices.
// Triggered from scripts/start.sh when RESET_DEMO_DATA=true.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@benzeen.uz').trim().toLowerCase();
  const password = (process.env.SUPER_ADMIN_PASSWORD || 'AD4543895').trim();

  console.log('▶ RESET_DEMO_DATA: wiping all records...');

  // Delete in FK-safe order (children first).
  const steps = [
    ['notification', () => prisma.notification.deleteMany()],
    ['invoice', () => prisma.invoice.deleteMany()],
    ['order', () => prisma.order.deleteMany()],
    ['carUsage', () => prisma.carUsage.deleteMany()],
    ['driverCar', () => prisma.driverCar.deleteMany()],
    ['car', () => prisma.car.deleteMany()],
    ['verificationCode', () => prisma.verificationCode.deleteMany()],
    ['session', () => prisma.session.deleteMany()],
    ['account', () => prisma.account.deleteMany()],
    ['company', () => prisma.company.deleteMany()],
    ['user', () => prisma.user.deleteMany()],
  ];

  for (const [name, fn] of steps) {
    try {
      const r = await fn();
      console.log(`   cleared ${name}: ${r.count ?? 0}`);
    } catch (e) {
      console.log(`   skip ${name}: ${e.message}`);
    }
  }

  // Recreate fuel prices (UZS per liter).
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

  // Recreate the single SUPER_ADMIN.
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    create: { email, name: 'Super Admin', passwordHash, role: 'SUPER_ADMIN' },
    update: { passwordHash, role: 'SUPER_ADMIN', companyId: null },
  });

  console.log(`✓ Reset complete. Only SUPER_ADMIN remains: ${email}`);
}

main()
  .catch((e) => {
    console.error('RESET_DEMO_DATA failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
