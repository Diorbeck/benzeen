import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DriversSection } from '@/components/dashboard/drivers-section';

export default async function DriversPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const t = await getTranslations('admin');
  const companyId = (session.user as { companyId?: string | null }).companyId;
  const role = (session.user as { role?: string }).role;

  if (!companyId || (role !== 'COMPANY_ADMIN' && role !== 'SUPER_ADMIN')) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
        <p className="text-amber-600 dark:text-amber-400">
          {t('noAccessDrivers')}
        </p>
      </div>
    );
  }

  const drivers = await prisma.user.findMany({
    where: { companyId, role: 'DRIVER' },
    include: {
      driverCars: {
        include: { car: true },
      },
    },
  });

  const cars = await prisma.car.findMany({
    where: { companyId },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Водители
      </h1>
      <DriversSection
        drivers={drivers.map((d) => ({
          id: d.id,
          name: d.name || d.email,
          email: d.email,
          carIds: d.driverCars.map((dc) => dc.car.id),
        }))}
        cars={cars.map((c) => ({ id: c.id, plateNumber: c.plateNumber }))}
      />
    </div>
  );
}
