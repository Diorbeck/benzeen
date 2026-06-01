import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = (session.user as { companyId?: string | null }).companyId;
    const role = (session.user as { role?: string }).role;

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const orderWhere =
      role === 'SUPER_ADMIN' ? {} : companyId ? { car: { companyId } } : { id: 'impossible' };
    if (!companyId && role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        perCar: [],
        perMonth: [],
        byFuelType: { AI_92: 0, AI_95: 0, AI_100: 0 },
      });
    }

    // Usage per car
    const cars = await prisma.car.findMany({
      where: role === 'SUPER_ADMIN' ? {} : { companyId: companyId! },
      include: { usage: true },
    });

    const perCar = cars.map((car) => {
      const usage = car.usage.find((u) => u.month === month && u.year === year);
      return {
        plateNumber: car.plateNumber,
        used: usage?.usedLiters ?? 0,
        limit: car.monthlyLimit,
      };
    });

    // Usage per month (last 6 months)
    const perMonth: { month: number; year: number; used: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const orders = await prisma.order.findMany({
        where: {
          ...orderWhere,
          status: { in: ['DELIVERED', 'CLOSED'] },
          createdAt: {
            gte: new Date(y, m - 1, 1),
            lt: new Date(y, m, 1),
          },
        },
        select: { volume: true },
      });
      perMonth.push({
        month: m,
        year: y,
        used: orders.reduce((s, o) => s + o.volume, 0),
      });
    }

    // AI-92 vs AI-95
    const ordersByFuel = await prisma.order.findMany({
      where: {
        ...orderWhere,
        status: { in: ['DELIVERED', 'CLOSED'] },
        createdAt: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
      select: { fuelType: true, volume: true },
    });
    const byFuelType = ordersByFuel.reduce(
      (acc, o) => {
        acc[o.fuelType] = (acc[o.fuelType] ?? 0) + o.volume;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      perCar,
      perMonth: perMonth.map((p) => ({
        ...p,
        label: `${['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'][p.month - 1]} ${p.year.toString().slice(2)}`,
      })),
      byFuelType: {
        AI_92: byFuelType.AI_92 ?? 0,
        AI_95: byFuelType.AI_95 ?? 0,
        AI_100: byFuelType.AI_100 ?? 0,
      },
    });
  } catch {
    return NextResponse.json(
      { perCar: [], perMonth: [], byFuelType: { AI_92: 0, AI_95: 0, AI_100: 0 } },
      { status: 200 }
    );
  }
}
