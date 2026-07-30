import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { B2CHeader } from '@/components/b2c/header';
import { OrderStatus } from '@/components/account/order-status';

export default async function ClientOrderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user?.id) redirect(`/${locale}/client-login`);
  if (user.role !== 'CLIENT') redirect(`/${locale}/dashboard`);

  const order = await prisma.order.findFirst({
    where: { id, clientId: user.id },
    include: { clientCar: { select: { plate: true } } },
  });
  if (!order) notFound();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <B2CHeader />
      <OrderStatus
        locale={locale}
        initial={{
          id: order.id,
          status: order.status,
          fuelType: order.fuelType,
          volume: order.volume,
          dispensedVolume: order.dispensedVolume,
          pricePerLiter: order.pricePerLiter,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          address: order.address,
          lat: order.lat,
          lng: order.lng,
          plate: order.clientCar?.plate ?? null,
          createdAt: order.createdAt.toISOString(),
        }}
      />
    </div>
  );
}
