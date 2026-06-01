import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { HistoryTable } from '@/components/dashboard/history-table';

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const { role } = session.user as { role?: string };
  if (role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`);

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 2000,
    include: {
      car: { include: { company: { select: { name: true } } } },
      createdBy: { select: { name: true, email: true } },
      assignedTo: { select: { name: true, phone: true } },
    },
  });

  const rows = orders.map((o) => ({
    id: o.id,
    company: o.car.company.name,
    plateNumber: o.car.plateNumber,
    fuelType: o.fuelType,
    volume: o.volume,
    status: o.status,
    address: o.address,
    createdAt: o.createdAt.toISOString(),
    deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
    createdBy: o.createdBy?.name ?? o.createdBy?.email ?? null,
    courier: o.assignedTo?.name ?? o.assignedTo?.phone ?? null,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Полная история
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Все заказы и доставки за всё время по всем компаниям. Можно искать, фильтровать
        по дате и выгрузить в CSV.
      </p>
      <HistoryTable rows={rows} />
    </div>
  );
}
