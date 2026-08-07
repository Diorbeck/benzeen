import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type CurrentClient = { id: string; role: 'CLIENT'; companyId: string | null };

/**
 * Resolve the signed-in CLIENT for server components / actions / route handlers.
 * Returns null for guests and for any non-CLIENT (staff) session — callers get a
 * single, consistent gate instead of re-deriving `session.user.role === 'CLIENT'`
 * everywhere. See [[session-policy]] for how long a client session lives.
 */
export async function getCurrentClient(): Promise<CurrentClient | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string; companyId?: string | null } | undefined;
  if (!user?.id || user.role !== 'CLIENT') return null;
  return { id: user.id, role: 'CLIENT', companyId: user.companyId ?? null };
}

/**
 * Pure default-car selection. Given the explicit pointer plus fallbacks, pick the
 * car to prefill with — always validating ownership against `carIds` so a stale
 * pointer can never select a car the user no longer owns.
 *
 * Priority: explicit User.defaultCarId → most-recently-*used* car (last order) →
 * most-recently-*created* car → none.
 */
export function pickDefaultCarId(input: {
  explicitDefaultId: string | null;
  carIds: string[];
  lastUsedCarId: string | null;
  mostRecentCarId: string | null;
}): string | null {
  const owns = (id: string | null): id is string => !!id && input.carIds.includes(id);
  if (owns(input.explicitDefaultId)) return input.explicitDefaultId;
  if (owns(input.lastUsedCarId)) return input.lastUsedCarId;
  if (owns(input.mostRecentCarId)) return input.mostRecentCarId;
  return null;
}

/**
 * The client's default ClientCar id, applying the fallback in `pickDefaultCarId`.
 * Returns null if the client has no cars. Read-only — never writes the pointer.
 */
export async function getDefaultCarId(userId: string): Promise<string | null> {
  const [user, cars, lastOrder] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { defaultCarId: true } }),
    prisma.clientCar.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
    prisma.order.findFirst({
      where: { clientId: userId, clientCarId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { clientCarId: true },
    }),
  ]);

  return pickDefaultCarId({
    explicitDefaultId: user?.defaultCarId ?? null,
    carIds: cars.map((c) => c.id),
    lastUsedCarId: lastOrder?.clientCarId ?? null,
    mostRecentCarId: cars[0]?.id ?? null,
  });
}
