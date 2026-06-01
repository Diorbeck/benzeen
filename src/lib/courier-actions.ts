// Shared courier order-action logic, used by both the session-based web route
// (/api/courier/orders/[id]) and the Telegram route (/api/tg/courier/orders/[id]).
//
// Returns a discriminated result so callers can map it to an HTTP status.

import { prisma } from './prisma';
import { createNotification } from './notifications';
import { sendTelegramMessage } from './telegram';

export type CourierAction = 'TAKE' | 'ON_ROUTE' | 'DELIVERED';

export type CourierActionResult =
  | { ok: true; status: number; order: { id: string; status: string } }
  | { ok: false; status: number; error: string };

export async function applyCourierAction(
  courierId: string,
  orderId: string,
  action: CourierAction,
  volume?: number,
): Promise<CourierActionResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { car: { include: { usage: true } }, createdBy: true },
  });

  if (!order) return { ok: false, status: 404, error: 'Order not found' };

  if (action === 'TAKE') {
    if (order.status !== 'RECEIVED' || order.assignedToId !== null) {
      return { ok: false, status: 409, error: 'Заказ уже взят' };
    }
  } else if (action === 'ON_ROUTE') {
    if (order.assignedToId !== courierId || order.status !== 'COURIER_ASSIGNED') {
      return { ok: false, status: 403, error: 'Заказ не назначен вам' };
    }
  } else if (action === 'DELIVERED') {
    if (order.assignedToId !== courierId || order.status !== 'IN_DELIVERY') {
      return { ok: false, status: 403, error: 'Заказ не в доставке' };
    }
    if (!volume) return { ok: false, status: 400, error: 'Укажите объём' };

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const usage = order.car.usage.find((u) => u.month === month && u.year === year);
    const usedLiters = usage?.usedLiters ?? 0;
    const remaining = order.car.monthlyLimit - usedLiters;
    if (volume > remaining) {
      return { ok: false, status: 400, error: `Превышен лимит. Осталось: ${remaining} л` };
    }
  }

  let newStatus = order.status;
  let assignedToId: string | undefined;
  let deliveredAt: Date | undefined;
  let deliveredVolume = order.volume;

  if (action === 'TAKE') {
    newStatus = 'COURIER_ASSIGNED';
    assignedToId = courierId;
  } else if (action === 'ON_ROUTE') {
    newStatus = 'IN_DELIVERY';
  } else if (action === 'DELIVERED' && volume) {
    newStatus = 'DELIVERED';
    deliveredAt = new Date();
    deliveredVolume = volume;
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        ...(assignedToId ? { assignedToId } : {}),
        deliveredAt,
        volume: deliveredVolume,
      },
    });

    if (newStatus === 'DELIVERED' && deliveredVolume > 0) {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      await tx.carUsage.upsert({
        where: { carId_month_year: { carId: order.car.id, month, year } },
        create: { carId: order.car.id, month, year, usedLiters: deliveredVolume },
        update: { usedLiters: { increment: deliveredVolume } },
      });
    }
  });

  if (newStatus === 'DELIVERED' && order.createdById) {
    await createNotification({
      userId: order.createdById,
      type: 'ORDER_DELIVERED',
      title: 'Order delivered',
      message: `${order.car.plateNumber}: ${deliveredVolume} L delivered`,
      orderId: order.id,
    });
  }

  // Notify the driver in Telegram (no-op when unconfigured / not linked).
  const tgId = order.createdBy?.telegramId;
  if (tgId) {
    const plate = order.car.plateNumber;
    let tgText: string | null = null;
    if (newStatus === 'COURIER_ASSIGNED') {
      tgText = `🚚 Курьер принял ваш заказ по машине <b>${plate}</b>.`;
    } else if (newStatus === 'IN_DELIVERY') {
      tgText = `🛣️ Курьер выехал к вам. Машина <b>${plate}</b>.`;
    } else if (newStatus === 'DELIVERED') {
      tgText = `✅ Заказ доставлен: <b>${plate}</b> — ${deliveredVolume} л.`;
    }
    if (tgText) void sendTelegramMessage(tgId, tgText);
  }

  return { ok: true, status: 200, order: { id: order.id, status: newStatus } };
}
