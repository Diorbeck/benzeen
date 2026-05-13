import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OrdersList } from './orders-list';

export async function DispatcherDashboard({ locale }: { locale: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const orders = await prisma.order.findMany({
    where: { status: 'CREATED' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { car: true, createdBy: true },
  });

  const rows = orders.map((o) => ({
    id: o.id,
    volume: o.volume,
    status: o.status,
    fuelType: o.fuelType,
    plateNumber: o.car.plateNumber,
    createdAt: o.createdAt,
    address: o.address,
    driverName: o.createdBy?.name ?? o.createdBy?.email ?? null,
  }));

  const t = await getTranslations('dispatcher');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('newOrders')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('newOrdersDesc')}</p>
      </div>
      <OrdersList
        orders={rows}
        role="DISPATCHER"
        defaultStatusFilter="CREATED"
        pageTitle={t('newOrders')}
      />
    </div>
  );
}
