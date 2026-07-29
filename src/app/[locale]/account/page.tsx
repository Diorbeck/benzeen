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

  const [user, orders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sUser.id },
      select: { phone: true, name: true },
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
        totalAmount: true,
        createdAt: true,
      },
    }),
  ]);
  if (!user) redirect(`/${locale}/client-login`);

  return (
    <AccountView
      locale={locale}
      phone={user.phone ?? ''}
      name={user.name ?? ''}
      orders={orders.map((o) => ({
        id: o.id,
        status: o.status,
        fuelType: o.fuelType,
        volume: o.volume,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt.toISOString(),
      }))}
    />
  );
}
