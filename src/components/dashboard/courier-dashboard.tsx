import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function CourierDashboard({ locale }: { locale: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const { role, id: courierId } = session.user as { role?: string; id: string };
  if (role !== 'COURIER') redirect(`/${locale}/dashboard`);

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { status: 'RECEIVED', assignedToId: null },
        { assignedToId: courierId, status: { in: ['COURIER_ASSIGNED', 'IN_DELIVERY'] } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    include: { car: { include: { usage: true } } },
    take: 50,
  });

  async function takeOrderAction(formData: FormData) {
    'use server';

    const session = await getServerSession(authOptions);
    if (!session?.user) redirect(`/${locale}/login`);
    const { role, id: courierId } = session.user as { role?: string; id: string };
    if (role !== 'COURIER') redirect(`/${locale}/dashboard`);

    const orderId = String(formData.get('orderId') || '');
    if (!orderId) return;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'RECEIVED' || order.assignedToId !== null) return;

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'COURIER_ASSIGNED', assignedToId: courierId },
    });

    revalidatePath(`/${locale}/dashboard`);
  }

  async function markOnRouteAction(formData: FormData) {
    'use server';

    const session = await getServerSession(authOptions);
    if (!session?.user) redirect(`/${locale}/login`);
    const { role, id: courierId } = session.user as { role?: string; id: string };
    if (role !== 'COURIER') redirect(`/${locale}/dashboard`);

    const orderId = String(formData.get('orderId') || '');
    if (!orderId) return;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.assignedToId !== courierId || order.status !== 'COURIER_ASSIGNED') return;

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'IN_DELIVERY' },
    });

    revalidatePath(`/${locale}/dashboard`);
  }

  async function markDeliveredAction(formData: FormData) {
    'use server';

    const session = await getServerSession(authOptions);
    if (!session?.user) redirect(`/${locale}/login`);
    const { role, id: courierId } = session.user as { role?: string; id: string };
    if (role !== 'COURIER') redirect(`/${locale}/dashboard`);

    const orderId = String(formData.get('orderId') || '');
    const volume = parseInt(String(formData.get('volume') || '0'), 10);

    if (!orderId || !Number.isFinite(volume) || volume <= 0) return;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { car: { include: { usage: true } } },
    });
    if (!order || order.assignedToId !== courierId || order.status !== 'IN_DELIVERY') return;

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const usage = order.car.usage.find((u) => u.month === month && u.year === year);
    const usedLiters = usage?.usedLiters ?? 0;
    const remaining = order.car.monthlyLimit - usedLiters;
    if (volume > remaining) return;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          volume,
        },
      });
      await tx.carUsage.upsert({
        where: {
          carId_month_year: {
            carId: order.carId,
            month,
            year,
          },
        },
        create: {
          carId: order.carId,
          month,
          year,
          usedLiters: volume,
        },
        update: {
          usedLiters: { increment: volume },
        },
      });
    });

    revalidatePath(`/${locale}/dashboard`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Кабинет курьера
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Назначенные заказы и статусы.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="card-premium p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Пока нет назначенных заказов.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {orders.map((o) => (
            <div key={o.id} className="card-premium space-y-3 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {o.car.plateNumber} · {o.fuelType.replace('_', '-')}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Статус: {o.status}
                  </p>
                </div>
                {o.address && (
                  <a
                    className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                    href={`https://yandex.ru/maps/?text=${encodeURIComponent(o.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Открыть в навигаторе
                  </a>
                )}
              </div>

              {o.address && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Адрес: <span className="font-medium">{o.address}</span>
                </p>
              )}

              <div className="flex flex-wrap items-end gap-2">
                {o.status === 'RECEIVED' && (
                  <form action={takeOrderAction}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-green-600 px-4 text-xs font-semibold text-white transition hover:bg-green-700"
                    >
                      Принять
                    </button>
                  </form>
                )}

                {o.status === 'COURIER_ASSIGNED' && (
                  <form action={markOnRouteAction}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-primary-600 px-4 text-xs font-semibold text-white transition hover:bg-primary-700"
                    >
                      В пути
                    </button>
                  </form>
                )}

                {o.status === 'IN_DELIVERY' && (
                  <form action={markDeliveredAction} className="flex items-end gap-2">
                    <input type="hidden" name="orderId" value={o.id} />
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-gray-600 dark:text-gray-300">
                        Литры
                      </label>
                      <input
                        name="volume"
                        type="number"
                        min={1}
                        max={80}
                        required
                        className="h-9 w-24 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-primary-600 px-4 text-xs font-semibold text-white transition hover:bg-primary-700"
                    >
                      Доставлено
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

