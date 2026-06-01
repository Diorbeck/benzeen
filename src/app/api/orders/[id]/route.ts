import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { dispatchOrder, notifyCouriersNewOrder } from '@/lib/order-dispatch';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(['RECEIVED', 'COURIER_ASSIGNED', 'IN_DELIVERY', 'DELIVERED', 'CANCELLED']).optional(),
  assignedToId: z.string().cuid().optional().nullable(),
  // Company-admin verbs for the approval / cancel flow.
  action: z.enum(['approve', 'reject', 'cancel']).optional(),
});

const TERMINAL = ['DELIVERED', 'CLOSED', 'CANCELLED', 'REJECTED'];

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
    const companyId = (session.user as { companyId?: string | null }).companyId;

    // ---- Company admin: approve / reject / cancel own-company orders --------
    if (role === 'COMPANY_ADMIN') {
      if (order.car.companyId !== companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const action = data.action;
      if (action === 'approve') {
        if (order.status !== 'PENDING_APPROVAL') {
          return NextResponse.json({ error: 'Order is not pending approval' }, { status: 409 });
        }
        await dispatchOrder(order.id);
        if (order.createdById) {
          await createNotification({
            userId: order.createdById,
            type: 'ORDER_APPROVED',
            title: 'Order approved',
            message: `${order.car.plateNumber}: полный бак согласован`,
            orderId: order.id,
          });
        }
        return NextResponse.json({ id: order.id, status: 'RECEIVED' });
      }
      if (action === 'reject') {
        if (order.status !== 'PENDING_APPROVAL') {
          return NextResponse.json({ error: 'Order is not pending approval' }, { status: 409 });
        }
        await prisma.order.update({
          where: { id },
          data: { status: 'REJECTED', botPhase: null },
        });
        if (order.createdById) {
          await createNotification({
            userId: order.createdById,
            type: 'ORDER_REJECTED',
            title: 'Order rejected',
            message: `${order.car.plateNumber}: полный бак отклонён`,
            orderId: order.id,
          });
        }
        return NextResponse.json({ id: order.id, status: 'REJECTED' });
      }
      if (action === 'cancel') {
        if (TERMINAL.includes(order.status)) {
          return NextResponse.json({ error: 'Order already finished' }, { status: 409 });
        }
        await prisma.order.update({
          where: { id },
          data: { status: 'CANCELLED', botPhase: null },
        });
        if (order.createdById) {
          await createNotification({
            userId: order.createdById,
            type: 'ORDER_REJECTED',
            title: 'Order cancelled',
            message: `${order.car.plateNumber}: заказ отменён менеджером`,
            orderId: order.id,
          });
        }
        return NextResponse.json({ id: order.id, status: 'CANCELLED' });
      }
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    // ---- Dispatcher / super-admin: status + courier assignment -------------
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
          where: { carId_month_year: { carId: order.car.id, month, year } },
          create: { carId: order.car.id, month, year, usedLiters: order.volume },
          update: { usedLiters: { increment: order.volume } },
        });
      }

      return upd;
    });

    // A dispatcher marking an order RECEIVED makes it available to couriers.
    if (data.status === 'RECEIVED') {
      await notifyCouriersNewOrder(order.id);
    }

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

// Delete an order. Drivers may delete their own draft (CREATED/PENDING_APPROVAL);
// company admins may delete own-company non-delivered orders; super-admins any.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { car: { select: { companyId: true } } },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const role = (session.user as { role?: string }).role;
    const userId = (session.user as { id: string }).id;
    const companyId = (session.user as { companyId?: string | null }).companyId;

    const isOwnDraft =
      role === 'DRIVER' &&
      order.createdById === userId &&
      ['CREATED', 'PENDING_APPROVAL'].includes(order.status);
    const isCompanyOrder =
      role === 'COMPANY_ADMIN' &&
      order.car.companyId === companyId &&
      !TERMINAL.includes(order.status);
    const isSuperAdmin = role === 'SUPER_ADMIN';

    if (!isOwnDraft && !isCompanyOrder && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.order.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
