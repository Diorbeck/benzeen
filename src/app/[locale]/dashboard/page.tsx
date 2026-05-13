import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardOverview } from '@/components/dashboard/overview';
import { DriverDashboard } from '@/components/dashboard/driver-dashboard';
import { CourierDashboard } from '@/components/dashboard/courier-dashboard';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const { role, companyId } = session.user as { role?: string; companyId?: string | null };

  if (role === 'DRIVER') {
    return <DriverDashboard locale={locale} />;
  }

  if (role === 'COURIER') {
    return <CourierDashboard locale={locale} />;
  }

  if (role === 'DISPATCHER') {
    const DispatcherDashboard = (await import('@/components/dashboard/dispatcher-dashboard')).DispatcherDashboard;
    return <DispatcherDashboard locale={locale} />;
  }

  let remainingLiters = 0;
  let totalLitersUsed = 0;
  let recentOrders: { id: string; volume: number; status: string; fuelType: string; plateNumber?: string }[] = [];
  let pendingOrders: { id: string; volume: number; status: string }[] = [];
  let carsCount = 0;
  let deliveredToday = 0;
  let perCar: { plateNumber: string; used: number; limit: number }[] = [];

  if (companyId) {
    const cars = await prisma.car.findMany({
      where: { companyId },
      include: { usage: true },
    });
    carsCount = cars.length;

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    for (const car of cars) {
      const usage = car.usage.find((u) => u.month === month && u.year === year);
      const used = usage?.usedLiters ?? 0;
      totalLitersUsed += used;
      remainingLiters += Math.max(0, car.monthlyLimit - used);
    }

    const [orders, pendingList] = await Promise.all([
      prisma.order.findMany({
        where: { car: { companyId } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { car: true },
      }),
      prisma.order.findMany({
        where: { car: { companyId }, status: 'CREATED' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    recentOrders = orders.map((o) => ({
      id: o.id,
      volume: o.volume,
      status: o.status,
      fuelType: o.fuelType,
      plateNumber: o.car.plateNumber,
    }));
    pendingOrders = pendingList.map((o) => ({ id: o.id, volume: o.volume, status: o.status }));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const delivered = await prisma.order.count({
      where: {
        car: { companyId },
        status: 'DELIVERED',
        deliveredAt: { gte: todayStart },
      },
    });
    deliveredToday = delivered;

    perCar = cars.map((car) => {
      const usage = car.usage.find((u) => u.month === month && u.year === year);
      const used = usage?.usedLiters ?? 0;
      return { plateNumber: car.plateNumber, used, limit: car.monthlyLimit };
    });
  } else if (role === 'SUPER_ADMIN') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    deliveredToday = await prisma.order.count({
      where: { status: 'DELIVERED', deliveredAt: { gte: todayStart } },
    });
  }

  return (
    <DashboardOverview
      remainingLiters={remainingLiters}
      totalLitersUsed={totalLitersUsed}
      recentOrders={recentOrders}
      pendingOrders={pendingOrders}
      carsCount={carsCount}
      deliveredToday={deliveredToday}
      perCar={perCar}
      role={role}
    />
  );
}
