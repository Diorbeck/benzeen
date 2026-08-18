// Доступ к кабинету АЗС. Владелец видит только свои объекты; супер-админ —
// любой, потому что ему приходится разбираться в чужих расхождениях.
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type StationAccess =
  | { ok: true; userId: string; role: string; stationIds: string[]; isAdmin: boolean }
  | { error: 'Unauthorized' | 'Forbidden'; status: 401 | 403 };

export async function requireStationAccess(): Promise<StationAccess> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized', status: 401 };

  const { role, id } = session.user as { role?: string; id?: string };
  if (!id) return { error: 'Unauthorized', status: 401 };

  if (role === 'SUPER_ADMIN') {
    const all = await prisma.fuelStation.findMany({ select: { id: true } });
    return { ok: true, userId: id, role, stationIds: all.map((s) => s.id), isAdmin: true };
  }

  if (role !== 'STATION_OWNER') return { error: 'Forbidden', status: 403 };

  const owned = await prisma.fuelStation.findMany({
    where: { ownerId: id },
    select: { id: true },
  });
  // Роль без привязанных объектов — это заведённая, но ещё не подключённая АЗС.
  // Пустой список честнее отказа: кабинет откроется и объяснит, что объектов нет.
  return { ok: true, userId: id, role, stationIds: owned.map((s) => s.id), isAdmin: false };
}
