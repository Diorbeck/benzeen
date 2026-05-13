import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CarsList } from '@/components/dashboard/cars-list';

export default async function CarsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const t = await getTranslations('dashboard');
  const tCars = await getTranslations('cars');
  const companyId = (session.user as { companyId?: string | null }).companyId;
  if (!companyId) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
        <p className="text-amber-600 dark:text-amber-400">{tCars('noCompany')}</p>
      </div>
    );
  }

  const cars = await prisma.car.findMany({
    where: { companyId },
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
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        {t('nav.cars')}
      </h1>
      <CarsList cars={carsWithUsage} />
    </div>
  );
}
