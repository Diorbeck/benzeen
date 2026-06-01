import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createNotification } from '@/lib/notifications';
import { sendTelegramMessage } from '@/lib/telegram';
import { FULL_TANK_MAX_LITERS } from '@/lib/constants';

const schema = z.object({
  action: z.enum(['TAKE', 'ON_ROUTE', 'DELIVERED']),
  volume: z.number().int().min(1).max(FULL_TANK_MAX_LITERS).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role } = session.user as { role?: string };
    if (role !== 'COURIER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const courierId = (session.user as { id: string }).id;
    const { id } = await params;
    const body = await req.json();
    const data = schema.parse(body);

    const order = await prisma.order.findUnique({
      where: { id },
      include: { car: { include: { usage: true } }, createdBy: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (data.action === 'TAKE') {
      if (order.status !== 'CREATED' || order.assignedToId !== null) {
        return NextResponse.json({ error: 'Order already taken' }, { status: 409 });
      }
    } else if (data.action === 'ON_ROUTE') {
      if (order.assignedToId !== courierId || order.status !== 'COURIER_ASSIGNED') {
        return NextResponse.json({ error: 'Order not assigned to you' }, { status: 403 });
      }
    } else if (data.action === 'DELIVERED') {
      if (order.assignedToId !== courierId || order.status !== 'IN_DELIVERY') {
        return NextResponse.json({ error: 'Order not in delivery' }, { status: 403 });
      }
      if (!data.volume) {
        return NextResponse.json({ error: 'Volume is required' }, { status: 400 });
      }

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const usage = order.car.usage.find((u) => u.month === month && u.year === year);
      const usedLiters = usage?.usedLiters ?? 0;
      const remaining = order.car.monthlyLimit - usedLiters;

      if (data.volume > remaining) {
        return NextResponse.json(
          { error: `Превышен лимит. Осталось: ${remaining} л` },
          { status: 400 },
        );
      }
    }

    let newStatus = order.status;
    let assignedToId: string | undefined;
    let deliveredAt: Date | undefined;
    let deliveredVolume = order.volume;

    if (data.action === 'TAKE') {
      newStatus = 'COURIER_ASSIGNED';
      assignedToId = courierId;
    } else if (data.action === 'ON_ROUTE') {
      newStatus = 'IN_DELIVERY';
    } else if (data.action === 'DELIVERED' && data.volume) {
      newStatus = 'DELIVERED';
      deliveredAt = new Date();
      deliveredVolume = data.volume;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.order.update({
        where: { id },
        data: {
          status: newStatus,
          ...(assignedToId ? { assignedToId } : {}),
          deliveredAt,
          volume: deliveredVolume,
        },
        include: { car: true },
      });

      if (newStatus === 'DELIVERED' && deliveredVolume > 0) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        await tx.carUsage.upsert({
          where: {
            carId_month_year: { carId: order.car.id, month, year },
          },
          create: { carId: order.car.id, month, year, usedLiters: deliveredVolume },
          update: { usedLiters: { increment: deliveredVolume } },
        });
      }
      return upd;
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

    // Notify the driver in Telegram if they created the order from the Mini App
    // (no-op when the bot is unconfigured or the driver hasn't linked).
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
      if (tgText) {
        // Fire-and-forget; never block the response on Telegram.
        void sendTelegramMessage(tgId, tgText);
      }
    }

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.errors[0]?.message || 'Invalid data' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

