import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(['RECEIVED', 'COURIER_ASSIGNED', 'IN_DELIVERY', 'DELIVERED', 'CANCELLED']).optional(),
  assignedToId: z.string().cuid().optional().nullable(),
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

    const role = (session.user as { role?: string }).role;
    if (role !== 'SUPER_ADMIN' && role !== 'DISPATCHER') {
      return NextResponse.json({ error: 'Only dispatcher can update order status' }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.order.update({
        where: { id },
        data: {
          status: data.status,
          assignedToId: data.assignedToId,
          deliveredAt: data.status === 'DELIVERED' ? new Date() : undefined,
        },
        include: { car: true },
      });

      if (data.status === 'DELIVERED' && order.volume > 0) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        await tx.carUsage.upsert({
          where: {
            carId_month_year: {
              carId: order.car.id,
              month,
              year,
            },
          },
          create: {
            carId: order.car.id,
            month,
            year,
            usedLiters: order.volume,
          },
          update: {
            usedLiters: { increment: order.volume },
          },
        });
      }

      return upd;
    });

    if (data.status === 'COURIER_ASSIGNED' && order.createdById) {
      await createNotification({
        userId: order.createdById,
        type: 'COURIER_ASSIGNED',
        title: 'Courier assigned',
        message: `Order for ${order.car.plateNumber} — courier assigned`,
        orderId: order.id,
      });
    }

    if (data.status === 'DELIVERED' && order.createdById) {
      await createNotification({
        userId: order.createdById,
        type: 'ORDER_DELIVERED',
        title: 'Order delivered',
        message: `${order.car.plateNumber}: ${order.volume} L delivered`,
        orderId: order.id,
      });
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
