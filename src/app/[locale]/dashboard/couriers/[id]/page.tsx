import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { tashkentRangeToUtc, startOfTashkentDay, formatAvgDuration } from '@/lib/courier-stats';
import { courierRangeStats } from '@/lib/courier-admin';
import { CourierCard } from '@/components/dashboard/courier-card';

function defaultFrom(): string {
  // Default range = last 30 days (inclusive of today), in Tashkent local time.
  const start = new Date(startOfTashkentDay().getTime() - 29 * 24 * 60 * 60 * 1000);
  // startOfTashkentDay returns the UTC instant of Tashkent midnight; shift back
  // into Tashkent local to derive the YYYY-MM-DD label.
  return new Date(start.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function CourierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { locale, id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);
  const { role } = session.user as { role?: string };
  if (role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('adminCouriers');

  const courier = await prisma.user.findFirst({
    where: { id, role: 'COURIER' },
    select: {
      id: true,
      name: true,
      phone: true,
      vehicleNumber: true,
      telegramId: true,
      onDuty: true,
      deactivatedAt: true,
    },
  });
  if (!courier) notFound();

  const sp = await searchParams;
  const from = sp.from || defaultFrom();
  const to = sp.to || new Date(startOfTashkentDay().getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { start, end } = tashkentRangeToUtc(from, to);

  const [bucket, history] = await Promise.all([
    courierRangeStats(id, start, end),
    prisma.order.findMany({
      where: {
        assignedToId: id,
        status: 'DELIVERED',
        deliveredAt: { gte: start, lt: end },
      },
      orderBy: { deliveredAt: 'desc' },
      take: 100,
      select: {
        id: true,
        fuelType: true,
        volume: true,
        dispensedVolume: true,
        takenAt: true,
        deliveredAt: true,
      },
    }),
  ]);

  const stats = {
    orders: bucket.count,
    liters: bucket.liters,
    avgTime: formatAvgDuration(bucket.avgTakeToDeliverMs),
  };

  const dtf = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  const historyRows = history.map((o) => ({
    id: o.id,
    fuelType: o.fuelType.replace('_', '-'),
    liters: o.dispensedVolume ?? o.volume,
    taken: o.takenAt ? dtf.format(o.takenAt) : '—',
    delivered: o.deliveredAt ? dtf.format(o.deliveredAt) : '—',
  }));

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/dashboard/couriers`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <CourierCard
        courier={{
          id: courier.id,
          name: courier.name,
          phone: courier.phone,
          vehicleNumber: courier.vehicleNumber,
          telegramLinked: courier.telegramId != null,
          onDuty: courier.onDuty,
          deactivated: courier.deactivatedAt != null,
        }}
        stats={stats}
        history={historyRows}
        range={{ from, to }}
        locale={locale}
      />
    </div>
  );
}
