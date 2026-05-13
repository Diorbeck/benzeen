import { prisma } from './prisma';

export type NotificationType =
  | 'LOW_LIMIT'
  | 'FULL_TANK_PENDING'
  | 'COURIER_ASSIGNED'
  | 'ORDER_DELIVERED'
  | 'ORDER_APPROVED'
  | 'ORDER_REJECTED';

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
  carId?: string;
}) {
  await prisma.notification.create({
    data: params,
  });
}
