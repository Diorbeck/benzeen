import { getServerSession } from 'next-auth';
import { Landing } from '@/components/landing/landing';
import { HomeSwitch } from '@/components/b2c/home-switch';
import type { HomeClient } from '@/components/b2c/mobile-home';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDefaultCarId } from '@/lib/session';
import { B2B_ENABLED } from '@/lib/features';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // B2C is the default product. The legacy B2B marketing landing is kept behind
  // the feature flag (code not deleted) and shown only when B2B is enabled.
  if (B2B_ENABLED) return <Landing />;

  // Мобильной главной вошедшего клиента нужны его машина и последний заказ —
  // они известны только серверу, поэтому подгружаются здесь и передаются вниз.
  const session = await getServerSession(authOptions);
  const sUser = session?.user as { id?: string; role?: string; name?: string } | undefined;

  let client: HomeClient | null = null;
  if (sUser?.id && sUser.role === 'CLIENT') {
    const [user, cars, lastOrder, defaultCarId] = await Promise.all([
      prisma.user.findUnique({ where: { id: sUser.id }, select: { name: true } }),
      prisma.clientCar.findMany({
        where: { userId: sUser.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, brand: true, model: true, plate: true },
      }),
      prisma.order.findFirst({
        where: { clientId: sUser.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          fuelType: true,
          totalAmount: true,
          createdAt: true,
        },
      }),
      getDefaultCarId(sUser.id),
    ]);
    const car = cars.find((c) => c.id === defaultCarId) ?? cars[0] ?? null;
    client = {
      name: user?.name ?? '',
      car: car ? { brand: car.brand, model: car.model, plate: car.plate } : null,
      lastOrder: lastOrder
        ? { ...lastOrder, createdAt: lastOrder.createdAt.toISOString() }
        : null,
    };
  }

  return <HomeSwitch locale={locale} client={client} />;
}
