import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const STATUSES = ['CREATED', 'PENDING_APPROVAL', 'ASSIGNED', 'ON_ROUTE', 'DELIVERED', 'CLOSED'] as const;

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { locale } = await params;
  if (!session?.user) redirect(`/${locale}/login`);

  const { role } = session.user as { role?: string };
  if (role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('admin');
  const sp = await searchParams;
  const status = sp.status && STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? sp.status : 'all';

  const [companies, cars, orders] = await Promise.all([
    prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { cars: true, users: true } },
      },
    }),
    prisma.car.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        plateNumber: true,
        fuelType: true,
        monthlyLimit: true,
        company: { select: { name: true } },
      },
    }),
    prisma.order.findMany({
      where: status === 'all' ? undefined : { status: status as (typeof STATUSES)[number] },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        status: true,
        fuelType: true,
        volume: true,
        createdAt: true,
        address: true,
        car: { select: { plateNumber: true, company: { select: { name: true } } } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-premium p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t('companies')}
          </h2>
          <div className="space-y-3">
            {companies.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('carsCount', { count: c._count.cars })} · {t('usersCount', { count: c._count.users })}
                  </p>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {c.createdAt.toISOString().slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-premium p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t('cars')}
          </h2>
          <div className="space-y-3">
            {cars.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.plateNumber}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {c.company.name} · {c.fuelType.replace('_', '-')} · {t('carLimitL', { limit: c.monthlyLimit })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-premium p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('orders')}
            </h2>
            <form method="GET">
              <select
                name="status"
                defaultValue={status}
                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="all">{t('filterAll')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </form>
          </div>

          <div className="mt-4 space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-gray-100 p-3 dark:border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {o.car.company.name} · {o.car.plateNumber}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {o.fuelType.replace('_', '-')} · {o.volume} л · {o.status}
                    </p>
                    {o.address && (
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        {t('addressLabel')}: {o.address}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {o.createdAt.toISOString().slice(0, 10)}
                  </span>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('noOrders')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

