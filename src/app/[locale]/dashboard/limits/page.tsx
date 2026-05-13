import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LimitsList } from '@/components/dashboard/limits-list';

export default async function LimitsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('limits');
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const companyId = (session.user as { companyId?: string | null }).companyId;
  const role = (session.user as { role?: string }).role;

  if (role !== 'COMPANY_ADMIN' && role !== 'SUPER_ADMIN') {
    redirect(`/${locale}/dashboard`);
  }

  const where = role === 'SUPER_ADMIN' ? {} : { companyId: companyId! };
  const cars = await prisma.car.findMany({
    where,
    include: { usage: true },
  });

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const carsWithUsage = cars.map((car) => {
    const usage = car.usage.find((u) => u.month === month && u.year === year);
    const used = usage?.usedLiters ?? 0;
    const remaining = Math.max(0, car.monthlyLimit - used);
    return {
      id: car.id,
      plateNumber: car.plateNumber,
      model: car.model,
      fuelType: car.fuelType,
      monthlyLimit: car.monthlyLimit,
      usedLiters: used,
      remainingLiters: remaining,
    };
  });

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
      <LimitsList cars={carsWithUsage} />
    </div>
  );
}
