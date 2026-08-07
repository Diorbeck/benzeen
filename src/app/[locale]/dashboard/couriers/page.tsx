import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { fetchCourierList } from '@/lib/courier-admin';
import { CouriersSection } from '@/components/dashboard/couriers-section';

export default async function CouriersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const { role } = session.user as { role?: string };
  if (role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('adminCouriers');
  const couriers = await fetchCourierList();

  // Serialize dates for the client component.
  const rows = couriers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    vehicleNumber: c.vehicleNumber,
    telegramLinked: c.telegramLinked,
    onDuty: c.onDuty,
    deactivated: c.deactivatedAt != null,
    locationFresh: c.locationFresh,
    locationUpdatedAt: c.locationUpdatedAt ? c.locationUpdatedAt.toISOString() : null,
    activeOrders: c.activeOrders,
    deliveredToday: c.deliveredToday,
    litersToday: c.litersToday,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
      </div>
      <CouriersSection couriers={rows} locale={locale} />
    </div>
  );
}
