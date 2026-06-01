import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CouriersManager } from '@/components/dashboard/couriers-manager';

export default async function CouriersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const { role } = session.user as { role?: string };
  if (role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`);

  const couriers = await prisma.user.findMany({
    where: { role: 'COURIER' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, phone: true, vehicleNumber: true },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Курьеры
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Регистрируйте курьеров, редактируйте и удаляйте их. Курьер входит в систему
        по номеру телефона и паролю.
      </p>
      <CouriersManager couriers={couriers} />
    </div>
  );
}
