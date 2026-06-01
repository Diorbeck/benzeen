import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OrdersList } from '@/components/dashboard/orders-list';

export default async function RequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('orders');
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const { role, companyId } = session.user as {
    role?: string;
    companyId?: string | null;
  };

  if (role !== 'COMPANY_ADMIN' && role !== 'SUPER_ADMIN') {
    redirect(`/${locale}/dashboard`);
  }

  let orders: { id: string; volume: number; status: string; fuelType: string; plateNumber: string; createdAt: Date; address?: string | null; driverName?: string | null }[] = [];

  if (role === 'SUPER_ADMIN') {
    orders = (
      await prisma.order.findMany({
        where: { status: { in: ['CREATED', 'RECEIVED', 'COURIER_ASSIGNED', 'IN_DELIVERY'] } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { car: true, createdBy: true },
      })
    ).map((o) => ({
      id: o.id,
      volume: o.volume,
      status: o.status,
      fuelType: o.fuelType,
      plateNumber: o.car.plateNumber,
      createdAt: o.createdAt,
      address: o.address,
      driverName: o.createdBy?.name ?? o.createdBy?.email ?? null,
    }));
  } else if (companyId) {
    orders = (
      await prisma.order.findMany({
        where: { car: { companyId }, status: 'CREATED' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { car: true, createdBy: true },
      })
    ).map((o) => ({
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
        {t('requestsTitle')}
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('requestsSubtitle')}
      </p>
      <OrdersList
        orders={orders}
        role={role}
        defaultStatusFilter="all"
      />
    </div>
  );
}
