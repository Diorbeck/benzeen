import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role, companyId } = session.user as { role?: string; companyId?: string | null };

    let cars: { id: string; plateNumber: string; fuelType: string }[] = [];

    if (role === 'DRIVER') {
      const driverCars = await prisma.driverCar.findMany({
        where: { driverId: session.user.id },
        include: {
          car: {
            include: { usage: true },
          },
        },
      });
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      cars = driverCars.map((dc) => {
        const usage = dc.car.usage.find((u) => u.month === month && u.year === year);
        const used = usage?.usedLiters ?? 0;
        const remaining = Math.max(0, dc.car.monthlyLimit - used);
        return {
          id: dc.car.id,
          plateNumber: dc.car.plateNumber,
          fuelType: dc.car.fuelType,
          remainingLiters: remaining,
        };
      });
    } else if (role === 'COMPANY_ADMIN' && companyId) {
      const companyCars = await prisma.car.findMany({
        where: { companyId },
        include: { usage: true },
      });
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      cars = companyCars.map((car) => {
        const usage = car.usage.find((u) => u.month === month && u.year === year);
        const used = usage?.usedLiters ?? 0;
        const remaining = Math.max(0, car.monthlyLimit - used);
        return {
          id: car.id,
          plateNumber: car.plateNumber,
          fuelType: car.fuelType,
          remainingLiters: remaining,
        };
      });
    }

    return NextResponse.json(cars);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
