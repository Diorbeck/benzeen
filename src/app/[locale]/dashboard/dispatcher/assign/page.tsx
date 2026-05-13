import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OrdersList } from '@/components/dashboard/orders-list';

export default async function DispatcherAssignPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);
  if ((session.user as { role?: string }).role !== 'DISPATCHER') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('dispatcher');

  const orders = await prisma.order.findMany({
    where: { status: { in: ['CREATED', 'RECEIVED'] } },
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('courierAssignment')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('courierAssignmentDesc')}</p>
      </div>
      <OrdersList orders={rows} role="DISPATCHER" pageTitle={t('courierAssignment')} />
    </div>
  );
}
