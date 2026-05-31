import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OrdersList } from '@/components/dashboard/orders-list';

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('orders');
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const { role, companyId, id: userId } = session.user as {
    role?: string;
    companyId?: string | null;
    id: string;
  };

  let orders: { id: string; volume: number; status: string; fuelType: string; plateNumber: string; createdAt: Date; address?: string | null; driverName?: string | null }[] = [];

  const orderInclude = { car: true, createdBy: true };

  if (role === 'SUPER_ADMIN') {
    const list = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: orderInclude,
    });
    orders = list.map((o) => ({
      id: o.id,
      volume: o.volume,
      status: o.status,
      fuelType: o.fuelType,
      plateNumber: o.car.plateNumber,
      createdAt: o.createdAt,
      address: o.address,
      driverName: o.createdBy?.name ?? o.createdBy?.email ?? null,
    }));
  } else if (role === 'DRIVER') {
    const list = await prisma.order.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { car: true },
    });
    orders = list.map((o) => ({
      id: o.id,
      volume: o.volume,
      status: o.status,
      fuelType: o.fuelType,
      plateNumber: o.car.plateNumber,
      createdAt: o.createdAt,
    }));
  } else if (role === 'COURIER') {
    const list = await prisma.order.findMany({
      where: { assignedToId: userId, status: { in: ['COURIER_ASSIGNED', 'IN_DELIVERY'] } },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: { car: true },
    });
    orders = list.map((o) => ({
      id: o.id,
      volume: o.volume,
      status: o.status,
      fuelType: o.fuelType,
      plateNumber: o.car.plateNumber,
      createdAt: o.createdAt,
      address: o.address,
    }));
  } else if (companyId) {
    const list = await prisma.order.findMany({
      where: { car: { companyId }, status: 'DELIVERED' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: orderInclude,
    });
    orders = list.map((o) => ({
      id: o.id,
      volume: o.volume,
      status: o.status,
      fuelType: o.fuelType,
      plateNumber: o.car.plateNumber,
      createdAt: o.createdAt,
      address: o.address,
      driverName: o.createdBy?.name ?? o.createdBy?.email ?? null,
    }));
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        {t('title')}
      </h1>
      <OrdersList orders={orders} role={role} />
    </div>
  );
}
