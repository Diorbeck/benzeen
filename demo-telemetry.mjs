// Фоновый имитатор контроллеров демо-АЗС — ТОЛЬКО для локальной разработки.
//
// Кормит ВСЕ станции с isDemo=true (список берётся из базы на каждом цикле, а
// не из захардкоженных ключей): обновляет lastSeenAt станции и колонок, пишет
// TankReading по каждому резервуару и поддерживает currentLevelL, чтобы
// карточка АЗС и весь сценарий заправки работали с живыми данными.
//
// Правила уровней:
//  - резервуар, который ни разу не отчитался (lastReadingAt и currentLevelL
//    пустые), НЕ трогается — это «датчик не подключён», карточка должна честно
//    показывать «нет данных» (см. simulateDemoTanks в src/lib/station-demo.ts);
//  - резервуар на обслуживании (MAINTENANCE) тоже пропускается;
//  - резервуар, начавший день почти пустым (<12%), остаётся в полосе 4–12%,
//    чтобы «заканчивается» было видно стабильно; остальные плавно расходуются
//    с редкими «завозами» бензовоза.
//
// Запуск одной командой: npm run demo:stations (сид + имитатор), подробнее —
// README, раздел «Демо-АЗС для локальной разработки». На проде не запускается:
// ни сид demo-станций, ни этот скрипт не входят в сборку и деплой.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TICK_MS = 45_000;

/** Полоса уровней для резервуара, замеченного почти пустым при старте. */
const LOW_BAND = { min: 0.04, max: 0.12 };
const NORMAL_BAND = { min: 0.15, max: 0.95 };

/** Какой полосе следует резервуар — решается по первому увиденному уровню. */
const bands = new Map();

function bandFor(tank) {
  const known = bands.get(tank.id);
  if (known) return known;
  const ratio = (tank.currentLevelL ?? tank.capacityL * 0.5) / tank.capacityL;
  const band = ratio < LOW_BAND.max ? LOW_BAND : NORMAL_BAND;
  bands.set(tank.id, band);
  return band;
}

function nextLevel(tank) {
  const band = bandFor(tank);
  const prev = tank.currentLevelL ?? tank.capacityL * ((band.min + band.max) / 2);
  const drain = 15 + Math.random() * 60;
  // Завоз бензовоза — только для обычных резервуаров: почти пустой должен
  // оставаться почти пустым, это витрина состояния «заканчивается».
  const refill =
    band === NORMAL_BAND && Math.random() < 0.04 ? tank.capacityL * (0.85 + Math.random() * 0.08) - prev : 0;
  const next = prev - drain + Math.max(0, refill);
  return Math.round(Math.min(tank.capacityL * band.max, Math.max(tank.capacityL * band.min, next)));
}

async function tick() {
  const now = new Date();
  const stations = await prisma.fuelStation.findMany({
    where: { isDemo: true, status: { not: 'ARCHIVED' } },
    include: { tanks: true },
  });

  for (const station of stations) {
    let fed = 0;
    for (const tank of station.tanks) {
      if (tank.status === 'MAINTENANCE') continue;
      if (tank.lastReadingAt === null && tank.currentLevelL === null) continue;
      const levelL = nextLevel(tank);
      await prisma.tank.update({
        where: { id: tank.id },
        data: { currentLevelL: levelL, lastReadingAt: now },
      });
      await prisma.tankReading.create({
        data: { tankId: tank.id, levelL, measuredAt: now, source: 'SENSOR' },
      });
      fed += 1;
    }

    await Promise.all([
      prisma.fuelStation.update({ where: { id: station.id }, data: { lastSeenAt: now } }),
      prisma.dispenser.updateMany({ where: { stationId: station.id }, data: { lastSeenAt: now } }),
    ]);
    console.log(now.toISOString(), station.id, `резервуаров: ${fed}/${station.tanks.length}`);
  }

  if (stations.length === 0) {
    console.log(now.toISOString(), 'демо-АЗС в базе нет — сначала npx tsx prisma/seed-stations.ts');
  }
}

await tick();
setInterval(tick, TICK_MS);
