import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('123', 10);
  const companyHash = await bcrypt.hash('company123', 10);
  const driverHash = await bcrypt.hash('driver123', 10);
  const courierHash = await bcrypt.hash('courier123', 10);

  // Prices
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

  // Demo company
  const company = await prisma.company.upsert({
    where: { id: 'demo-company-1' },
    create: {
      id: 'demo-company-1',
      name: 'Demo Company LLC',
      address: 'Tashkent, Uzbekistan',
      phone: '+998 90 123 45 67',
      telegram: '@democompany',
    },
    update: {},
  });

  // Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@apexoil.uz' },
    create: {
      email: 'admin@apexoil.uz',
      name: 'Super Admin',
      passwordHash: adminHash,
      role: 'SUPER_ADMIN',
    },
    update: {
      passwordHash: adminHash,
    },
  });

  const companyAdmin = await prisma.user.upsert({
    where: { email: 'company@apexoil.uz' },
    create: {
      email: 'company@apexoil.uz',
      name: 'Company Admin',
      passwordHash: companyHash,
      role: 'COMPANY_ADMIN',
      companyId: company.id,
    },
    update: {
      passwordHash: companyHash,
    },
  });

  const driver = await prisma.user.upsert({
    where: { email: 'driver@apexoil.uz' },
    create: {
      email: 'driver@apexoil.uz',
      name: 'Driver',
      passwordHash: driverHash,
      phone: '+998901112233',
      driverPassword: 'driver123',
      role: 'DRIVER',
      companyId: company.id,
    },
    update: {
      passwordHash: driverHash,
    },
  });

  const courier = await prisma.user.upsert({
    where: { email: 'courier@apexoil.uz' },
    create: {
      email: 'courier@apexoil.uz',
      name: 'Courier',
      passwordHash: courierHash,
      role: 'COURIER',
    },
    update: {
      passwordHash: courierHash,
    },
  });

  // Demo car
  const car = await prisma.car.upsert({
    where: { id: 'demo-car-1' },
    create: {
      id: 'demo-car-1',
      companyId: company.id,
      plateNumber: '01A123BC',
      model: 'Chevrolet Lacetti',
      fuelType: 'AI_95',
      tankCapacity: 80,
      monthlyLimit: 200,
    },
    update: {},
  });

  // Assign car to driver
  await prisma.driverCar.upsert({
    where: {
      driverId_carId: {
        driverId: driver.id,
        carId: car.id,
      },
    },
    create: {
      driverId: driver.id,
      carId: car.id,
    },
    update: {},
  });

  // Seed car usage for current month
  const now = new Date();
  await prisma.carUsage.upsert({
    where: {
      carId_month_year: {
        carId: car.id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
    },
    create: {
      carId: car.id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      usedLiters: 50,
    },
    update: { usedLiters: 50 },
  });

  console.log('Seed completed:');
  console.log('  Admin:    admin@apexoil.uz / 123');
  console.log('  Company:  company@apexoil.uz / company123');
  console.log('  Driver:   driver@apexoil.uz / driver123');
  console.log('  Courier:  courier@apexoil.uz / courier123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
