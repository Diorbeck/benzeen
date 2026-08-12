import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { B2CHeader } from '@/components/b2c/header';
import { FuelOrderFlow, type ExistingCar, type SavedLocationT, type LastOrderT } from '@/components/b2c/fuel-order-flow';
import { getBonusBalance } from '@/lib/referral';
import { getDefaultCarId } from '@/lib/session';

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

  const [priceRows, carRows, locationRows, bonusBalance, lastOrderRow] = await Promise.all([
    prisma.price.findMany(),
    isLoggedIn
      ? prisma.clientCar.findMany({ where: { userId: user!.id }, orderBy: { createdAt: 'desc' } })
      : Promise.resolve([]),
    isLoggedIn
      ? prisma.savedLocation.findMany({ where: { userId: user!.id }, orderBy: { createdAt: 'asc' } })
      : Promise.resolve([]),
    isLoggedIn ? getBonusBalance(user!.id!) : Promise.resolve(0),
    // Most recent client order — powers the "Repeat last order" fork on entry.
    isLoggedIn
      ? prisma.order.findFirst({
          where: { clientId: user!.id },
          orderBy: { createdAt: 'desc' },
          include: { clientCar: { select: { plate: true, model: true } } },
        })
      : Promise.resolve(null),
  ]);
  const prices: Record<string, number> = {};
  for (const p of priceRows) prices[p.fuelType] = p.priceUzs;
  const cars: ExistingCar[] = carRows.map((c) => ({
    id: c.id,
    plate: c.plate,
    model: c.model,
    tankCapacity: c.tankCapacity,
    // PR-A: the car's usual fuel — used to auto-preselect on the fuel step.
    fuelType: (c.fuelType as ExistingCar['fuelType']) ?? null,
    brand: c.brand ?? null,
  }));
  const savedLocations: SavedLocationT[] = locationRows.map((l) => ({
    id: l.id,
    name: l.name,
    lat: l.lat,
    lng: l.lng,
  }));

  // "Repeat last order" prefill — car, fuel, liters and delivery point/address.
  const lastOrder: LastOrderT | null = lastOrderRow
    ? {
        fuelType: lastOrderRow.fuelType as LastOrderT['fuelType'],
        volume: lastOrderRow.volume,
        isFullTank: lastOrderRow.isFullTank,
        address: lastOrderRow.address,
        lat: lastOrderRow.lat,
        lng: lastOrderRow.lng,
        clientCarId: lastOrderRow.clientCarId,
        carPlate: lastOrderRow.clientCar?.plate ?? null,
        carModel: lastOrderRow.clientCar?.model ?? null,
        pricePerLiter: lastOrderRow.pricePerLiter,
      }
    : null;

  // Prefill the client's default car when the URL doesn't pin one (prereq:
  // session + default car). Falls back to most-recently-used → most-recent car.
  const resolvedInitialCarId =
    initialCarId ?? (isLoggedIn ? (await getDefaultCarId(user!.id!)) ?? undefined : undefined);

  // Этап 2: адрес по умолчанию — предвыбор на шаге адреса.
  const defaultLocationId = isLoggedIn
    ? (
        await prisma.user.findUnique({
          where: { id: user!.id! },
          select: { defaultLocationId: true },
        })
      )?.defaultLocationId ?? null
    : null;

  const t = await getTranslations('benzin');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-navy-950 text-navy dark:text-white">
      <B2CHeader />
      <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <h1 className="mb-8 text-title text-navy dark:text-white">{t('title')}</h1>
        <FuelOrderFlow
          locale={locale}
          prices={prices}
          cars={cars}
          isLoggedIn={isLoggedIn}
          paymeAvailable={!!process.env.PAYME_MERCHANT_ID}
          initialFuel={initialFuel}
          initialVolume={initialVolume}
          initialCarId={resolvedInitialCarId}
          initialScheduleOpen={initialScheduleOpen}
          bonusBalance={bonusBalance}
          savedLocations={savedLocations}
          defaultLocationId={defaultLocationId}
          lastOrder={lastOrder}
          hasPrefill={Boolean(initialFuel || initialVolume || initialCarId || initialScheduleOpen)}
        />
      </main>
    </div>
  );
}
