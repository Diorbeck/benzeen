import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStationAccess } from '@/lib/station-auth';
import {
  billingEffect,
  decideSwitch,
  identificationDailyRateUzs,
  isIdentificationMode,
} from '@/lib/dispenser-identification';
import { CAMERA_IDENTIFICATION_ENABLED } from '@/lib/features';
import { writeAuditLog } from '@/lib/audit';

// Модуль 6 ТЗ v2: владелец АЗС включает и выключает идентификацию клиента на
// конкретной колонке. Изменение режима сразу отражается в подписке: платная
// колонка появляется в счёте с этих суток, выключенная — перестаёт начисляться.

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const access = await requireStationAccess();
  if ('error' in access) {
    return Response.json({ error: access.error }, { status: access.status });
  }

  let body: { dispenserId?: unknown; mode?: unknown };
  try {
    body = (await req.json()) as { dispenserId?: unknown; mode?: unknown };
  } catch {
    return Response.json({ error: 'Malformed body' }, { status: 400 });
  }

  const dispenserId = typeof body.dispenserId === 'string' ? body.dispenserId : null;
  if (!dispenserId || !isIdentificationMode(body.mode)) {
    return Response.json({ error: 'dispenserId and mode are required' }, { status: 400 });
  }
  const mode = body.mode;

  const dispenser = await prisma.dispenser.findFirst({
    where: { id: dispenserId, stationId: { in: access.stationIds } },
    select: { id: true, stationId: true, number: true, identificationMode: true, bleBeaconId: true },
  });
  if (!dispenser) {
    return Response.json({ error: 'Dispenser not found' }, { status: 404 });
  }

  const decision = decideSwitch({
    from: dispenser.identificationMode,
    to: mode,
    hasBeacon: dispenser.bleBeaconId !== null,
    cameraEnabled: CAMERA_IDENTIFICATION_ENABLED,
  });
  if (!decision.ok) {
    return Response.json({ error: decision.reason }, { status: 409 });
  }

  const now = new Date();
  const effect = billingEffect(dispenser.identificationMode, mode);

  await prisma.$transaction(async (tx) => {
    await tx.dispenser.update({ where: { id: dispenser.id }, data: { identificationMode: mode } });

    if (effect === 'open') {
      // Открываем строку только если её ещё нет: повторный запрос не должен
      // удваивать начисление по одной колонке.
      const open = await tx.stationBillingSubscription.findFirst({
        where: { stationId: dispenser.stationId, item: 'DISPENSER', dispenserId: dispenser.id, endedAt: null },
        select: { id: true },
      });
      if (!open) {
        await tx.stationBillingSubscription.create({
          data: {
            stationId: dispenser.stationId,
            item: 'DISPENSER',
            dispenserId: dispenser.id,
            dailyRateUzs: identificationDailyRateUzs(mode),
            startedAt: now,
          },
        });
      }
    } else if (effect === 'close') {
      await tx.stationBillingSubscription.updateMany({
        where: { stationId: dispenser.stationId, item: 'DISPENSER', dispenserId: dispenser.id, endedAt: null },
        data: { endedAt: now },
      });
    }
  });

  await writeAuditLog({
    action: 'STATION_DISPENSER_IDENTIFICATION',
    targetType: 'Dispenser',
    targetId: dispenser.id,
    actorId: access.userId,
    metadata: { from: dispenser.identificationMode, to: mode, billing: effect },
  });

  return Response.json({ ok: true, mode, billing: effect });
}
