import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { B2CHeader } from '@/components/b2c/header';
import { FuelOrderFlow } from '@/components/b2c/fuel-order-flow';

export default async function BenzinPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  // Client-only flow. Guests are sent to sign in and returned here afterwards.
  if (!user?.id) redirect(`/${locale}/client-login?callbackUrl=/${locale}/benzin`);
  if (user.role !== 'CLIENT') redirect(`/${locale}`);

  const [priceRows, car] = await Promise.all([
    prisma.price.findMany(),
    prisma.clientCar.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  const prices: Record<string, number> = {};
  for (const p of priceRows) prices[p.fuelType] = p.priceUzs;

  const t = await getTranslations('benzin');

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <B2CHeader />
      <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
          {t('title')}
        </h1>
        <FuelOrderFlow
          locale={locale}
          prices={prices}
          paymeAvailable={!!process.env.PAYME_MERCHANT_ID}
          car={
            car
              ? { id: car.id, plate: car.plate, model: car.model, tankCapacity: car.tankCapacity }
              : null
          }
        />
      </main>
    </div>
  );
}
