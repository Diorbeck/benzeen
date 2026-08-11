// Account deletion (Поддержка 2.0 волна, PR-1).
// Deletion = ANONYMIZATION, not row removal: orders, BonusLedger and referral
// links are financial records and stay. Only PII is wiped. Pure helpers are
// unit-tested; deleteClient runs the actual transaction.

import { del } from '@vercel/blob';
import { prisma } from '@/lib/prisma';

/** Order statuses that no longer block deletion. */
export const TERMINAL_ORDER_STATUSES = ['DELIVERED', 'CLOSED', 'REJECTED', 'CANCELLED'] as const;

export type DeletionBlock = 'active_order' | 'active_booking' | null;

/** An active order or an active propane booking blocks deletion. */
export function deletionBlock(args: { activeOrders: number; activeBookings: number }): DeletionBlock {
  if (args.activeOrders > 0) return 'active_order';
  if (args.activeBookings > 0) return 'active_booking';
  return null;
}

/**
 * The anonymized shape of a deleted client. Phone becomes `deleted:<id>`
 * (keeps the unique constraint, frees the number for a fresh signup); the
 * synthetic client email would leak the phone, so it is rewritten too.
 */
export function anonymizedUserData(userId: string, now: Date = new Date()) {
  return {
    phone: `deleted:${userId}`,
    email: `deleted-${userId}@clients.benzeen.local`,
    name: null,
    lastName: null,
    telegramId: null,
    defaultCarId: null,
    deletedAt: now,
  };
}

/** Hard delete is for spam accounts only: zero orders AND zero ledger rows. */
export function hardDeleteEligible(args: { orders: number; ledger: number }): boolean {
  return args.orders === 0 && args.ledger === 0;
}

/** Count the things that block deletion for this client. */
export async function countDeletionBlockers(userId: string) {
  const [activeOrders, activeBookings] = await Promise.all([
    prisma.order.count({
      where: { clientId: userId, status: { notIn: [...TERMINAL_ORDER_STATUSES] } },
    }),
    prisma.propaneBooking.count({
      where: { clientId: userId, status: 'BOOKED', slotStart: { gte: new Date() } },
    }),
  ]);
  return { activeOrders, activeBookings };
}

/**
 * Anonymize a client in one transaction. Returns the car photo URLs so the
 * caller can remove them from Vercel Blob (network calls stay outside the tx).
 * Kept rows: orders (clientCarId flips to NULL via FK), BonusLedger, referral
 * links (invitees keep referredById pointing at the now-anonymous user).
 */
export async function deleteClient(userId: string): Promise<{ photoUrls: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });
  const cars = await prisma.clientCar.findMany({
    where: { userId },
    select: { photoUrl: true },
  });

  await prisma.$transaction([
    ...(user?.phone
      ? [prisma.verificationCode.deleteMany({ where: { identifier: user.phone } })]
      : []),
    prisma.savedLocation.deleteMany({ where: { userId } }),
    // Unset the default-car pointer before the cars go away.
    prisma.user.update({ where: { id: userId }, data: { defaultCarId: null } }),
    prisma.clientCar.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: anonymizedUserData(userId) }),
  ]);

  return { photoUrls: cars.map((c) => c.photoUrl).filter((u): u is string => Boolean(u)) };
}

/**
 * Physically remove the car photos from Vercel Blob. Best-effort: a missing
 * token or an already-deleted blob must not fail the deletion itself.
 */
export async function deleteCarPhotos(photoUrls: string[]): Promise<void> {
  for (const url of photoUrls) {
    try {
      await del(url);
    } catch {
      // No BLOB_READ_WRITE_TOKEN locally / blob already gone — ignore.
    }
  }
}
