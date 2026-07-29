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
import { haversineKm } from './geo';
import { COURIER_LOCATION_MAX_AGE_MS, DISPATCH_NEAREST_COUNT } from './constants';
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
  lat?: number | null;
  lng?: number | null;
  // B2B orders carry `car`; B2C orders carry `clientCar` (+ client phone).
  car?: { plateNumber: string } | null;
  clientCar?: { plate: string } | null;
  clientPhone?: string | null;
}

/** Builds the multi-line order summary shown to drivers and couriers. */
export function orderSummary(order: OrderForSummary): string {
  const fuel = FUEL_LABEL_RU[order.fuelType] ?? order.fuelType;
  const volume = order.isFullTank
    ? `полный бак (${order.volume} л)`
    : `${order.volume} л`;
  const plate = order.car?.plateNumber ?? order.clientCar?.plate ?? '—';
  const lines = [
    `Машина: <b>${plate}</b>`,
    `Топливо: ${fuel}`,
    `Объём: ${volume}`,
  ];
  if (order.clientPhone) lines.push(`Клиент: ${order.clientPhone}`);
  if (order.address) lines.push(`Адрес: ${order.address}`);
  if (order.lat != null && order.lng != null) {
    lines.push(
      `Карта: https://yandex.ru/maps/?pt=${order.lng},${order.lat}&z=17&l=map`,
    );
  }
  return lines.join('\n');
}

/**
 * Notifies every courier who has linked their Telegram account about a new live
 * order. Each gets a "Взять заказ" inline button (callback take:<orderId>).
 */
export async function notifyCouriersNewOrder(orderId: string): Promise<void> {
  const couriers = await prisma.user.findMany({
    where: { role: 'COURIER', telegramId: { not: null } },
    select: { telegramId: true },
  });
  if (couriers.length === 0) return;
  await notifyCouriers(
    orderId,
    couriers.map((c) => c.telegramId).filter((t): t is string => !!t),
  );
}

/** Sends the "new order" offer (with a Взять button) to specific courier chats. */
async function notifyCouriers(orderId: string, chatIds: string[]): Promise<void> {
  if (chatIds.length === 0) return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      car: { select: { plateNumber: true } },
      clientCar: { select: { plate: true } },
      client: { select: { phone: true } },
    },
  });
  if (!order) return;

  const text =
    `🆕 <b>Новый заказ</b>\n\n` +
    orderSummary({
      fuelType: order.fuelType,
      volume: order.volume,
      isFullTank: order.isFullTank,
      address: order.address,
      lat: order.lat,
      lng: order.lng,
      car: order.car,
      clientCar: order.clientCar,
      clientPhone: order.client?.phone,
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

  for (const chatId of chatIds) {
    void sendTelegramMessage(chatId, text, markup);
  }
}

/**
 * B2C geo-dispatch: offer a freshly-created RECEIVED order to the N couriers with
 * the freshest live location, nearest first (haversine). Couriers without a
 * recent location are skipped — the stale-order cron falls back to a broadcast.
 * Returns the number of couriers offered the order.
 */
export async function dispatchB2COrderToNearest(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { lat: true, lng: true },
  });
  if (!order || order.lat == null || order.lng == null) return 0;

  const since = new Date(Date.now() - COURIER_LOCATION_MAX_AGE_MS);
  const locations = await prisma.courierLocation.findMany({
    where: { updatedAt: { gte: since }, courier: { role: 'COURIER', telegramId: { not: null } } },
    include: { courier: { select: { telegramId: true } } },
  });
  if (locations.length === 0) return 0;

  const origin = { lat: order.lat, lng: order.lng };
  const nearest = locations
    .map((l) => ({ chatId: l.courier.telegramId!, dist: haversineKm(origin, { lat: l.lat, lng: l.lng }) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, DISPATCH_NEAREST_COUNT);

  await notifyCouriers(orderId, nearest.map((n) => n.chatId));
  return nearest.length;
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

  if (!order.car) return; // full-tank approval is a B2B-only flow
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
