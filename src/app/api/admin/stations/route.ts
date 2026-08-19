import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { hashControllerKey } from "@/lib/stations";
import {
  generateControllerKey,
  onboardingDailyCostUzs,
  parseOnboardingInput,
} from "@/lib/station-onboarding";
import { defaultDailyRate } from "@/lib/station-subscriptions";

// Модуль 6/7 ТЗ v2: подключение АЗС к Benzeen. Объект создаётся вместе с
// резервуарами и колонками одной транзакцией: АЗС без резервуара с датчиком —
// это не подключённый объект, а мусорная строка в списке.
//
// Ключ контроллера возвращается ровно один раз в ответе: в базе лежит только
// хеш, и восстановить ключ потом нельзя — можно выдать новый.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if ("error" in guard) {
    return Response.json({ error: guard.error }, { status: guard.status });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Malformed body" }, { status: 400 });
  }

  const parsed = parseOnboardingInput(raw);
  if (!parsed.ok) {
    return Response.json(
      { error: "Validation failed", errors: parsed.errors },
      { status: 400 },
    );
  }
  const input = parsed.value;

  // Серийники датчиков уникальны по всей стране: один физический датчик не может
  // стоять на двух объектах, а дубль означает описку при монтаже.
  const serials = input.tanks
    .map((t) => t.sensorSerial)
    .filter((s): s is string => s !== null);
  if (serials.length > 0) {
    const taken = await prisma.tank.findFirst({
      where: { sensorSerial: { in: serials } },
      select: { sensorSerial: true },
    });
    if (taken) {
      return Response.json(
        {
          error: "Sensor serial already used",
          errors: [{ field: "tanks", code: "sensorTaken" }],
        },
        { status: 409 },
      );
    }
  }

  const controllerKey = generateControllerKey();

  const station = await prisma.$transaction(async (tx) => {
    const created = await tx.fuelStation.create({
      data: {
        name: input.name,
        brand: input.brand,
        address: input.address,
        region: input.region,
        tin: input.tin,
        lat: input.lat,
        lng: input.lng,
        controllerKeyHash: hashControllerKey(controllerKey),
        tanks: {
          create: input.tanks.map((tank) => ({
            label: tank.label,
            fuelType: tank.fuelType,
            capacityL: tank.capacityL,
            minLevelL: tank.minLevelL,
            sensorSerial: tank.sensorSerial,
          })),
        },
        dispensers: {
          create: input.dispensers.map((dispenser) => ({
            number: dispenser.number,
            fuelTypes: dispenser.fuelTypes,
          })),
        },
      },
      select: {
        id: true,
        name: true,
        tanks: { select: { id: true } },
        dispensers: { select: { id: true, number: true } },
      },
    });

    // Резервуар тарифицируется с первого дня: датчик обязателен по ТЗ, значит и
    // подписка по нему открывается сразу. Колонка — только если АЗС взяла
    // идентификацию клиента.
    const billedNumbers = new Set(
      input.dispensers.filter((d) => d.billed).map((d) => d.number),
    );
    await tx.stationBillingSubscription.createMany({
      data: [
        ...created.tanks.map((tank) => ({
          stationId: created.id,
          item: "TANK" as const,
          tankId: tank.id,
          dailyRateUzs: defaultDailyRate("TANK"),
        })),
        ...created.dispensers
          .filter((d) => billedNumbers.has(d.number))
          .map((dispenser) => ({
            stationId: created.id,
            item: "DISPENSER" as const,
            dispenserId: dispenser.id,
            dailyRateUzs: defaultDailyRate("DISPENSER"),
          })),
      ],
    });

    return created;
  });

  await writeAuditLog({
    action: "STATION_ONBOARDED",
    targetType: "FuelStation",
    targetId: station.id,
    actorId: guard.actorId,
    actorEmail: guard.actorEmail,
    metadata: {
      name: input.name,
      tanks: input.tanks.length,
      dispensers: input.dispensers.length,
      billedDispensers: input.dispensers.filter((d) => d.billed).length,
      dailyRateUzs: onboardingDailyCostUzs(input),
    },
  });

  return Response.json({
    station: { id: station.id, name: station.name },
    tanks: station.tanks.length,
    dispensers: station.dispensers.length,
    dailyRateUzs: onboardingDailyCostUzs(input),
    // Единственный показ ключа: дальше только перевыпуск.
    controllerKey,
  });
}
