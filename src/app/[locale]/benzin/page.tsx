import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { B2CHeader } from '@/components/b2c/header';
import { FuelOrderFlow, type ExistingCar } from '@/components/b2c/fuel-order-flow';

const FUELS = ['AI_92', 'AI_95', 'AI_100'] as const;
type Fuel = (typeof FUELS)[number];

export default async function BenzinPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fuel?: string; volume?: string; carId?: string; schedule?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const initialFuel = FUELS.includes(sp.fuel as Fuel) ? (sp.fuel as Fuel) : undefined;
  const volNum = sp.volume ? Number(sp.volume) : NaN;
  const initialVolume = Number.isInteger(volNum) && volNum > 0 ? volNum : undefined;
  const initialCarId = sp.carId || undefined;
  const initialScheduleOpen = sp.schedule === '1';
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  // Guests AND clients may build an order (login happens inline at "Order").
  // Staff (any non-CLIENT role) go to their dashboard.
  if (user?.id && user.role !== 'CLIENT') redirect(`/${locale}/dashboard`);
  const isLoggedIn = Boolean(user?.id && user.role === 'CLIENT');

  const [priceRows, carRows] = await Promise.all([
    prisma.price.findMany(),
    isLoggedIn
      ? prisma.clientCar.findMany({ where: { userId: user!.id }, orderBy: { createdAt: 'desc' } })
      : Promise.resolve([]),
  ]);
  const prices: Record<string, number> = {};
  for (const p of priceRows) prices[p.fuelType] = p.priceUzs;
  const cars: ExistingCar[] = carRows.map((c) => ({
    id: c.id,
    plate: c.plate,
    model: c.model,
    tankCapacity: c.tankCapacity,
  }));

  const t = await getTranslations('benzin');

  return (
    <div className="min-h-screen bg-gray-50 text-navy">
      <B2CHeader />
      <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-navy sm:text-3xl">{t('title')}</h1>
        <FuelOrderFlow
          locale={locale}
          prices={prices}
          cars={cars}
          isLoggedIn={isLoggedIn}
          paymeAvailable={!!process.env.PAYME_MERCHANT_ID}
          initialFuel={initialFuel}
          initialVolume={initialVolume}
          initialCarId={initialCarId}
          initialScheduleOpen={initialScheduleOpen}
        />
      </main>
    </div>
  );
}
