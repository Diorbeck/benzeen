import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { FuelingError } from '@/lib/fueling';
import { AcquiringError } from '@/lib/acquiring';
import { startFuelingSession } from '@/lib/fueling-service';
import { STATION_FUEL_TYPES } from '@/lib/stations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Старт заправки: клиент подтвердил колонку, топливо и объём — резервируем сумму
// на карте (Модуль 4 ТЗ v2, базовый сценарий без BLE и камер).

const schema = z
  .object({
    stationId: z.string().min(1),
    dispenserNumber: z.number().int().positive(),
    fuelType: z.enum(STATION_FUEL_TYPES),
    liters: z.number().positive().max(1000).optional(),
    amountUzs: z.number().int().positive().max(50_000_000).optional(),
    fullTank: z.boolean().optional(),
    cardToken: z.string().min(1),
    carId: z.string().optional(),
    identifiedBy: z.enum(['MANUAL', 'BLE', 'CAMERA']).optional(),
  })
  .refine((v) => v.liters != null || v.amountUzs != null || v.fullTank === true, {
    message: 'Укажите литры, сумму или полный бак',
  });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : 'Некорректный запрос';
    return NextResponse.json({ error: message ?? 'Некорректный запрос' }, { status: 400 });
  }

  try {
    const created = await startFuelingSession({ ...data, clientId: userId });
    return NextResponse.json({ session: created }, { status: 201 });
  } catch (e) {
    if (e instanceof FuelingError) {
      // Занятая колонка — не ошибка клиента и не ошибка сервера: это состояние
      // объекта, и приложение должно предложить подождать или выбрать другую.
      const status = e.code === 'DISPENSER_BUSY' ? 409 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    if (e instanceof AcquiringError) {
      // Пока Apex не подключён, честный 503 лучше молчаливой фиктивной оплаты.
      const status = e.code === 'NOT_CONFIGURED' ? 503 : 402;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
