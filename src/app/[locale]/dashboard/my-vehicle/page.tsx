import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Car } from 'lucide-react';

export default async function MyVehiclePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const role = (session.user as { role?: string }).role;
  if (role !== 'DRIVER') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('myVehicle');

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const assignments = await prisma.driverCar.findMany({
    where: { driverId: session.user.id },
    include: { car: { include: { usage: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const vehicles = assignments.map((a) => {
    const usage = a.car.usage.find((u) => u.month === month && u.year === year);
    const used = usage?.usedLiters ?? 0;
    const remaining = Math.max(0, a.car.monthlyLimit - used);
    return {
      plateNumber: a.car.plateNumber,
      model: a.car.model,
      fuelType: a.car.fuelType,
      monthlyLimit: a.car.monthlyLimit,
      used,
      remaining,
    };
  });

  if (vehicles.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <div className="card-premium flex flex-col items-center justify-center py-20 text-center">
          <Car className="mb-6 h-14 w-14 text-gray-400 dark:text-gray-500" />
          <p className="text-gray-600 dark:text-gray-400">{t('noVehicle')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((v, i) => (
          <div
            key={i}
            className="card-premium overflow-hidden p-6"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-primary-500/10 p-3">
                <Car className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{v.plateNumber}</p>
                {v.model && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{v.model}</p>
                )}
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('fuelType')}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {v.fuelType.replace('_', '-')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('monthlyLimit')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{v.monthlyLimit} L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('usedThisMonth')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{v.used} L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('remaining')}</span>
                <span className="font-semibold text-primary-600 dark:text-primary-400">
                  {v.remaining} L
                </span>
              </div>
            </dl>
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all"
                  style={{
                    width: `${Math.min(100, (v.used / v.monthlyLimit) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
