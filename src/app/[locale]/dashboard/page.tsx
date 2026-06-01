import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardOverview } from '@/components/dashboard/overview';
import { DriverDashboard } from '@/components/dashboard/driver-dashboard';
import { CourierDashboard } from '@/components/dashboard/courier-dashboard';
import { AdminOverview } from '@/components/dashboard/admin-overview';

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
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

  if (role === 'SUPER_ADMIN') {
    const sp = await searchParams;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const dateStr =
      sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayStr;
    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999`);

    const delivered = await prisma.order.findMany({
      where: { status: 'DELIVERED', deliveredAt: { gte: dayStart, lte: dayEnd } },
      include: { car: { include: { company: true } } },
    });

    let liters92 = 0;
    let liters95 = 0;
    let liters100 = 0;
    const byCompany = new Map<string, { name: string; liters: number; orders: number }>();
    for (const o of delivered) {
      if (o.fuelType === 'AI_92') liters92 += o.volume;
      else if (o.fuelType === 'AI_100') liters100 += o.volume;
      else liters95 += o.volume;
      const c = o.car.company;
      const entry = byCompany.get(c.id) ?? { name: c.name, liters: 0, orders: 0 };
      entry.liters += o.volume;
      entry.orders += 1;
      byCompany.set(c.id, entry);
    }
    const topCompanies = Array.from(byCompany.values())
      .sort((a, b) => b.liters - a.liters)
      .slice(0, 10);

    return (
      <AdminOverview
        date={dateStr}
        totalLiters={liters92 + liters95 + liters100}
        liters92={liters92}
        liters95={liters95}
        liters100={liters100}
        ordersCount={delivered.length}
        topCompanies={topCompanies}
      />
    );
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
