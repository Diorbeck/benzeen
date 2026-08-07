// Shared courier order-action logic, used by both the session-based web route
// (/api/courier/orders/[id]) and the Telegram route (/api/tg/courier/orders/[id]).
//
// Returns a discriminated result so callers can map it to an HTTP status.

import { prisma } from './prisma';
import { sendTelegramMessage, getMiniAppUrl, type InlineKeyboardMarkup } from './telegram';
import { redispatchStale } from './order-dispatch';
import { awardReferralOnDelivery } from './referral';

export type CourierAction = 'TAKE' | 'ON_ROUTE' | 'DELIVERED';

/**
 * Inline keyboard for a courier's ACTIVE order card, matching the order status.
 * Shared by the live "you took this order" card and the `/orders` list so both
 * expose the same next-step action:
 *   - COURIER_ASSIGNED → "Выехал к клиенту" (callback `on_route:<id>`)
 *   - IN_DELIVERY      → "Доставлено" — opens the Mini App to enter actual
 *                        liters (falls back to a callback hint if the Mini App
 *                        URL is unset). Liters entry stays in the app so the
 *                        money/limit logic is untouched.
 * Any other status has no courier action → returns undefined.
 */
export function courierOrderActions(order: {
  id: string;
  status: string;
}): InlineKeyboardMarkup | undefined {
  if (order.status === 'COURIER_ASSIGNED') {
    return {
      inline_keyboard: [
        [{ text: '🚚 Выехал к клиенту', callback_data: `on_route:${order.id}` }],
      ],
    };
  }
  if (order.status === 'IN_DELIVERY') {
    const miniAppUrl = getMiniAppUrl();
    return {
      inline_keyboard: [
        [
          miniAppUrl
            ? { text: '✅ Доставлено', web_app: { url: miniAppUrl } }
            : { text: '✅ Доставлено', callback_data: `delivered:${order.id}` },
        ],
      ],
    };
  }
  return undefined;
}

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
    include: {
      car: { include: { usage: true } },
      createdBy: true,
      clientCar: true,
    },
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

    // B2C delivery (client order): courier enters actual liters → immediately
    // DELIVERED. No CarUsage limits, no driver "Верно/Не верно" confirm — the
    // client is present at the pump. (TZ M2 §4.8, §4.4.)
    if (order.clientId) {
      const cap = order.clientCar?.tankCapacity;
      if (cap && volume > cap) {
        return { ok: false, status: 400, error: `Больше бака машины (${cap} л)` };
      }
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'DELIVERED', deliveredAt: new Date(), dispensedVolume: volume },
      });
      // M5: referral accrual on first delivered order (idempotent, never throws to caller).
      try {
        await awardReferralOnDelivery(order.id);
      } catch (e) {
        console.error('[referral] award error:', e);
      }
      return { ok: true, status: 200, order: { id: order.id, status: 'DELIVERED' } };
    }

    // B2B delivery: unchanged (limit checks + driver confirmation flow).
    if (!order.car) return { ok: false, status: 400, error: 'Order has no vehicle' };
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

  const tgId = order.createdBy?.telegramId;
  if (tgId) {
    const plate = order.car?.plateNumber ?? order.clientCar?.plate ?? '';
    let tgText: string | null = null;
    if (newStatus === 'COURIER_ASSIGNED') {
      tgText = `🚚 Курьер принял ваш заказ по машине <b>${plate}</b>.`;
    } else if (newStatus === 'IN_DELIVERY') {
      tgText = `🛣️ Курьер выехал к вам. Машина <b>${plate}</b>.`;
    }
    if (tgText) void sendTelegramMessage(tgId, tgText);
  }

  // A courier taking a job is system activity — sweep any other stale B2C orders
  // and broadcast them (near-real-time backstop, replaces the sub-daily cron).
  if (action === 'TAKE') {
    await redispatchStale();
  }

  return { ok: true, status: 200, order: { id: order.id, status: newStatus } };
}
