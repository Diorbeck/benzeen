// Shared courier order-action logic, used by both the session-based web route
// (/api/courier/orders/[id]) and the Telegram route (/api/tg/courier/orders/[id]).
//
// Returns a discriminated result so callers can map it to an HTTP status.

import { prisma } from './prisma';
import { sendTelegramMessage, type InlineKeyboardMarkup } from './telegram';

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

    // Cap by the car's real tank capacity (brick #4).
    if (volume > order.car.tankCapacity) {
      return { ok: false, status: 400, error: `Больше бака машины (${order.car.tankCapacity} л)` };
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const usage = order.car.usage.find((u) => u.month === month && u.year === year);
    const usedLiters = usage?.usedLiters ?? 0;
    const remaining = order.car.monthlyLimit - usedLiters;
    if (volume > remaining) {
      return { ok: false, status: 400, error: `Превышен лимит. Осталось: ${remaining} л` };
    }

    // Courier reports the dispensed amount. Do NOT finalize or deduct yet —
    // the driver must confirm via the Telegram bot ("Верно / Не верно").
    // Ordered volume is preserved; the fact goes into dispensedVolume.
    await prisma.order.update({
      where: { id: orderId },
      data: { dispensedVolume: volume, botPhase: 'AWAIT_DELIVERY_CONFIRM' },
    });

    const tgIdConfirm = order.createdBy?.telegramId;
    if (tgIdConfirm) {
      const markup: InlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: '✅ Верно', callback_data: `confirm_delivery:${orderId}` },
            { text: '❌ Не верно', callback_data: `dispute_delivery:${orderId}` },
          ],
        ],
      };
      void sendTelegramMessage(
        tgIdConfirm,
        `⛽️ Курьер указал, что залил <b>${volume} л</b> в машину <b>${order.car.plateNumber}</b>.\nВсё верно?`,
        markup,
      );
    }

    return { ok: true, status: 200, order: { id: order.id, status: order.status } };
  }

  // ---- TAKE / ON_ROUTE only past this point --------------------------------
  let newStatus = order.status;
  let assignedToId: string | undefined;

  if (action === 'TAKE') {
    newStatus = 'COURIER_ASSIGNED';
    assignedToId = courierId;
  } else if (action === 'ON_ROUTE') {
    newStatus = 'IN_DELIVERY';
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: newStatus,
      ...(assignedToId ? { assignedToId } : {}),
    },
  });

  // Notify the driver in Telegram (no-op when unconfigured / not linked).
  const tgId = order.createdBy?.telegramId;
  if (tgId) {
    const plate = order.car.plateNumber;
    let tgText: string | null = null;
    if (newStatus === 'COURIER_ASSIGNED') {
      tgText = `🚚 Курьер принял ваш заказ по машине <b>${plate}</b>.`;
    } else if (newStatus === 'IN_DELIVERY') {
      tgText = `🛣️ Курьер выехал к вам. Машина <b>${plate}</b>.`;
    }
    if (tgText) void sendTelegramMessage(tgId, tgText);
  }

  return { ok: true, status: 200, order: { id: order.id, status: newStatus } };
}
