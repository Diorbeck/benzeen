import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function DriverDashboard({ locale }: { locale: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const { role, id: userId } = session.user as { role?: string; id: string };
  if (role !== 'DRIVER') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('driverDashboard');
  const tOrder = await getTranslations('createOrder');
  const tTable = await getTranslations('orders.table');

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const assignments = await prisma.driverCar.findMany({
    where: { driverId: userId },
    include: { car: { include: { usage: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const cars = assignments.map((a) => {
    const usage = a.car.usage.find((u) => u.month === month && u.year === year);
    const used = usage?.usedLiters ?? 0;
    const remaining = Math.max(0, a.car.monthlyLimit - used);
    return {
      id: a.car.id,
      plateNumber: a.car.plateNumber,
      fuelType: a.car.fuelType,
      monthlyLimit: a.car.monthlyLimit,
      used,
      remaining,
    };
  });

  const carIds = cars.map((c) => c.id);
  const recentOrders = carIds.length
    ? await prisma.order.findMany({
        where: { carId: { in: carIds } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { car: true },
      })
    : [];

  async function createOrderAction(formData: FormData) {
    'use server';

    const session = await getServerSession(authOptions);
    if (!session?.user) redirect(`/${locale}/login`);

    const { role, id: userId } = session.user as { role?: string; id: string };
    if (role !== 'DRIVER') redirect(`/${locale}/dashboard`);

    const carId = String(formData.get('carId') || '');
    const address = String(formData.get('address') || '').trim();

    if (!carId) return;

    const assigned = await prisma.driverCar.findUnique({
      where: { driverId_carId: { driverId: userId, carId } },
      include: { car: true },
    });
    if (!assigned) return;

    await prisma.order.create({
      data: {
        carId,
        fuelType: assigned.car.fuelType,
        volume: 0,
        status: 'CREATED',
        address: address || undefined,
        createdById: userId,
      },
    });

    revalidatePath(`/${locale}/dashboard`);
    redirect(`/${locale}/dashboard/orders`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-premium p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t('createOrderTitle')}
          </h2>
          <form action={createOrderAction} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                {tOrder('car')}
              </label>
              <select
                name="carId"
                required
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="">{tOrder('carPlaceholder')}</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.plateNumber} — {t('remainingLiters', { remaining: c.remaining })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                {tOrder('address')}
              </label>
              <input
                name="address"
                placeholder={tOrder('addressPlaceholder')}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              {tOrder('submit')}
            </button>
          </form>
        </div>

        <div className="card-premium p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t('limitsPerMonth')}
          </h2>
          {cars.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('noCarsAssigned')}
            </p>
          ) : (
            <div className="space-y-4">
              {cars.map((c) => {
                const pct = c.monthlyLimit > 0 ? Math.min(100, (c.used / c.monthlyLimit) * 100) : 0;
                return (
                  <div key={c.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {c.plateNumber}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {c.used} / {c.monthlyLimit} л
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-primary-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('remainingLiters', { remaining: c.remaining })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="border-b border-gray-200/60 px-6 py-4 dark:border-white/[0.07]">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t('recentOrders')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white dark:bg-primary-950/95">
              <tr className="border-b border-gray-200/60 dark:border-white/[0.07]">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {tTable('plate')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {tTable('fuel')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {tTable('status')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {tTable('date')}
                </th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-sm text-gray-500 dark:text-gray-400" colSpan={4}>
                    {t('noOrdersYet')}
                  </td>
                </tr>
              ) : (
                recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-100 dark:border-white/[0.04]">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {o.car.plateNumber}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {o.fuelType.replace('_', '-')}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{o.status}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {o.createdAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

