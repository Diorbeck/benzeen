// Order dispatch helpers shared between the bot webhook and the REST API.
//
// Centralizes two things:
//   1. Building the human-readable order summary used in Telegram messages.
//   2. Notifying available couriers when an order becomes "live" (RECEIVED).
//
// All Telegram calls are fire-and-forget and degrade to no-ops when the bot is
// unconfigured, so order mutations are never blocked by a Telegram outage.

import { prisma } from './prisma';
import { createNotification } from './notifications';
import {
  sendTelegramMessage,
  getMiniAppUrl,
  FUEL_LABEL_RU,
  type InlineKeyboardMarkup,
} from './telegram';

interface OrderForSummary {
  fuelType: string;
  volume: number;
  isFullTank: boolean;
  address?: string | null;
  car: { plateNumber: string };
}

/** Builds the multi-line order summary shown to drivers and couriers. */
export function orderSummary(order: OrderForSummary): string {
  const fuel = FUEL_LABEL_RU[order.fuelType] ?? order.fuelType;
  const volume = order.isFullTank
    ? `полный бак (${order.volume} л)`
    : `${order.volume} л`;
  const lines = [
    `Машина: <b>${order.car.plateNumber}</b>`,
    `Топливо: ${fuel}`,
    `Объём: ${volume}`,
  ];
  if (order.address) lines.push(`Адрес: ${order.address}`);
  return lines.join('\n');
}

/**
 * Notifies every courier who has linked their Telegram account about a new live
 * order. Each gets a "Взять заказ" inline button (callback take:<orderId>).
 */
export async function notifyCouriersNewOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { car: { select: { plateNumber: true } } },
  });
  if (!order) return;

  const couriers = await prisma.user.findMany({
    where: { role: 'COURIER', telegramId: { not: null } },
    select: { telegramId: true },
  });
  if (couriers.length === 0) return;

  const text =
    `🆕 <b>Новый заказ</b>\n\n` +
    orderSummary({
      fuelType: order.fuelType,
      volume: order.volume,
      isFullTank: order.isFullTank,
      address: order.address,
      car: order.car,
    });

  const miniAppUrl = getMiniAppUrl();
  const markup: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: '✅ Взять заказ', callback_data: `take:${order.id}` }],
      ...(miniAppUrl
        ? [[{ text: '📋 Мои заказы', web_app: { url: miniAppUrl } }]]
        : []),
    ],
  };

  for (const c of couriers) {
    if (c.telegramId) void sendTelegramMessage(c.telegramId, text, markup);
  }
}

/**
 * Marks an order as live (RECEIVED) and notifies couriers. Used after a driver
 * confirms + shares location in the bot, or after a manager approves a full
 * tank. No-op if the order isn't in a state that can go live.
 */
export async function dispatchOrder(orderId: string): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'RECEIVED', botPhase: null },
  });
  await notifyCouriersNewOrder(orderId);
}

/**
 * Puts a full-tank order into the manager-approval queue (PENDING_APPROVAL) and
 * notifies the company's admins. Couriers are NOT notified until a manager
 * approves (see dispatchOrder).
 */
export async function requestFullTankApproval(orderId: string): Promise<void> {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'PENDING_APPROVAL', botPhase: null },
    include: { car: { select: { plateNumber: true, companyId: true } } },
  });

  const admins = await prisma.user.findMany({
    where: { role: 'COMPANY_ADMIN', companyId: order.car.companyId },
    select: { id: true },
  });
  for (const a of admins) {
    await createNotification({
      userId: a.id,
      type: 'FULL_TANK_PENDING',
      title: 'Full tank approval',
      message: `${order.car.plateNumber}: запрос на полный бак (${order.volume} л) ожидает согласования`,
      orderId: order.id,
    });
  }
}
