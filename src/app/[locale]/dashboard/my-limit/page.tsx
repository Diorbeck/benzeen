import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Gauge } from 'lucide-react';

export default async function MyLimitPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const role = (session.user as { role?: string }).role;
  if (role !== 'DRIVER') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('myLimit');

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const assignments = await prisma.driverCar.findMany({
    where: { driverId: session.user.id },
    include: { car: { include: { usage: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const limits = assignments.map((a) => {
    const usage = a.car.usage.find((u) => u.month === month && u.year === year);
    const used = usage?.usedLiters ?? 0;
    const remaining = Math.max(0, a.car.monthlyLimit - used);
    return {
      plateNumber: a.car.plateNumber,
      used,
      remaining,
      limit: a.car.monthlyLimit,
    };
  });

  const totalUsed = limits.reduce((s, l) => s + l.used, 0);
  const totalLimit = limits.reduce((s, l) => s + l.limit, 0);
  const totalRemaining = limits.reduce((s, l) => s + l.remaining, 0);

  if (limits.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <div className="card-premium flex flex-col items-center justify-center py-20 text-center">
          <Gauge className="mb-6 h-14 w-14 text-gray-400 dark:text-gray-500" />
          <p className="text-gray-600 dark:text-gray-400">{t('noVehicle')}</p>
        </div>
      </div>
    );
  }

  const pct = totalLimit > 0 ? Math.min(100, (totalUsed / totalLimit) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
      </div>

      <div className="card-premium p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-primary-500/10 p-3">
            <Gauge className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('used')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsed} L</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('remaining')}</p>
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {totalRemaining} L
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('limit')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalLimit} L</p>
          </div>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-primary-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {limits.length > 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('perVehicle')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {limits.map((l) => {
              const lpct = l.limit > 0 ? Math.min(100, (l.used / l.limit) * 100) : 0;
              return (
                <div key={l.plateNumber} className="card-premium p-4">
                  <p className="mb-3 font-medium text-gray-900 dark:text-white">{l.plateNumber}</p>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{t('used')}: {l.used} L</span>
                    <span className="text-gray-500 dark:text-gray-400">{t('remaining')}: {l.remaining} L</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-primary-600"
                      style={{ width: `${lpct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
