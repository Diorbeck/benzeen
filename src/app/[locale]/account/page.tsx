import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { asGasoline } from '@/lib/pricing';
import { AccountView } from '@/components/account/account-view';
import { getReferralStats } from '@/lib/referral';
import { getDefaultCarId } from '@/lib/session';

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  const sUser = session?.user as { id?: string; role?: string } | undefined;

  if (!sUser?.id) redirect(`/${locale}/client-login`);
  if (sUser.role !== 'CLIENT') redirect(`/${locale}/dashboard`);

  const [user, orders, cars] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sUser.id },
      select: { phone: true, name: true, lastName: true, defaultLocationId: true },
    }),
    prisma.order.findMany({
      where: { clientId: sUser.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        fuelType: true,
        volume: true,
        dispensedVolume: true,
        totalAmount: true,
        clientCarId: true,
        scheduledFor: true,
        createdAt: true,
      },
    }),
    prisma.clientCar.findMany({
      where: { userId: sUser.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        plate: true,
        model: true,
        tankCapacity: true,
        brand: true,
        color: true,
        fuelType: true,
        oilType: true,
        photoUrl: true,
      },
    }),
  ]);
  if (!user) redirect(`/${locale}/client-login`);

  const [referral, locations, defaultCarId] = await Promise.all([
    getReferralStats(sUser.id),
    prisma.savedLocation.findMany({
      where: { userId: sUser.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, lat: true, lng: true },
    }),
    getDefaultCarId(sUser.id),
  ]);

  return (
    <AccountView
      locale={locale}
      phone={user.phone ?? ''}
      name={user.name ?? ''}
      lastName={user.lastName ?? ''}
      cars={cars.map((c) => ({ ...c, fuelType: asGasoline(c.fuelType) }))}
      referral={referral}
      locations={locations}
      defaultCarId={defaultCarId}
      defaultLocationId={user.defaultLocationId}
      orders={orders.map((o) => ({
        id: o.id,
        status: o.status,
        fuelType: o.fuelType,
        volume: o.volume,
        dispensedVolume: o.dispensedVolume,
        totalAmount: o.totalAmount,
        clientCarId: o.clientCarId,
        scheduledFor: o.scheduledFor ? o.scheduledFor.toISOString() : null,
        createdAt: o.createdAt.toISOString(),
      }))}
    />
  );
}
