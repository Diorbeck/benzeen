import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTgContext } from '@/lib/tg-auth';

export const runtime = 'nodejs';

// Driver's assigned cars with current-month remaining limit. Mirrors the logic
// in /api/orders/cars for the DRIVER branch.
export async function GET(req: Request) {
  const ctx = await getTgContext(req);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid init data' }, { status: 401 });
  }
  if (!ctx.driver) {
    return NextResponse.json({ error: 'Not linked' }, { status: 403 });
  }

  const driverCars = await prisma.driverCar.findMany({
    where: { driverId: ctx.driver.id },
    include: { car: { include: { usage: true } } },
  });

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const cars = driverCars.map((dc) => {
    const usage = dc.car.usage.find((u) => u.month === month && u.year === year);
    const used = usage?.usedLiters ?? 0;
    const remaining = Math.max(0, dc.car.monthlyLimit - used);
    return {
      id: dc.car.id,
      plateNumber: dc.car.plateNumber,
      fuelType: dc.car.fuelType,
      monthlyLimit: dc.car.monthlyLimit,
      remainingLiters: remaining,
    };
  });

  return NextResponse.json(cars);
}
