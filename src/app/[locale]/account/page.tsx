import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AccountView } from '@/components/account/account-view';

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
      select: { phone: true, name: true, lastName: true },
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
      select: { id: true, plate: true, model: true, tankCapacity: true },
    }),
  ]);
  if (!user) redirect(`/${locale}/client-login`);

  return (
    <AccountView
      locale={locale}
      phone={user.phone ?? ''}
      name={user.name ?? ''}
      lastName={user.lastName ?? ''}
      cars={cars}
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
