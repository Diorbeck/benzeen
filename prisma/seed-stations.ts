import { PrismaClient, type FuelType } from '@prisma/client';
import { createHash } from 'crypto';

// Демо-данные v2: несколько стационарных АЗС с резервуарами, колонками, ценами
// и подпиской. Нужны, чтобы карта и кабинет были проверяемы до появления
// пилотного объекта и до установки реальных датчиков.
//
// Запуск: DATABASE_URL=... npx tsx prisma/seed-stations.ts
// Идемпотентно: повторный запуск обновляет те же АЗС по ключу station-<n>.

const prisma = new PrismaClient();

const TANK_DAILY_RATE_UZS = 25_000;
const DISPENSER_DAILY_RATE_UZS = 10_000;

type TankSeed = {
  label: string;
  fuelType: FuelType;
  capacityL: number;
  fillRatio: number;
  /** false — датчик ещё не подключён: без показаний, карточка честно говорит «нет данных». */
  sensor?: boolean;
};

type StationSeed = {
  id: string;
  name: string;
  brand: string;
  address: string;
  region: string;
  lat: number;
  lng: number;
  controllerKey: string;
  /** Минут назад пришёл последний признак жизни: так проверяется офлайн. */
  lastSeenMinutesAgo: number | null;
  prices: Partial<Record<FuelType, number>>;
  tanks: TankSeed[];
  dispensers: { number: number; fuelTypes: FuelType[]; identificationMode: 'MANUAL' | 'BLE' | 'CAMERA'; status?: 'ACTIVE' | 'DISABLED' }[];
};

const STATIONS: StationSeed[] = [
  {
    id: 'demo-station-1',
    name: 'АЗС Юнусабад',
    brand: 'UZGASTRADE',
    address: 'Ташкент, Юнусабадский район, ул. Амира Темура 108',
    region: 'Ташкент',
    lat: 41.3468,
    lng: 69.2861,
    controllerKey: 'bz_ctrl_demo_1_5f2a9c1d7b',
    lastSeenMinutesAgo: 1,
    prices: { AI_92: 10_900, AI_95: 12_400, AI_98: 14_200, DIESEL: 12_900 },
    tanks: [
      { label: 'Р-1', fuelType: 'AI_92', capacityL: 25_000, fillRatio: 0.62 },
      { label: 'Р-2', fuelType: 'AI_95', capacityL: 25_000, fillRatio: 0.31 },
      { label: 'Р-3', fuelType: 'AI_98', capacityL: 15_000, fillRatio: 0.08 },
      { label: 'Р-4', fuelType: 'DIESEL', capacityL: 20_000, fillRatio: 0.74 },
    ],
    dispensers: [
      { number: 1, fuelTypes: ['AI_92', 'AI_95'], identificationMode: 'BLE' },
      { number: 2, fuelTypes: ['AI_95', 'AI_98'], identificationMode: 'BLE' },
      { number: 3, fuelTypes: ['DIESEL'], identificationMode: 'MANUAL' },
    ],
  },
  {
    id: 'demo-station-2',
    name: 'АЗС Чиланзар',
    brand: 'Benzeen Partner',
    address: 'Ташкент, Чиланзарский район, ул. Бунёдкор 45',
    region: 'Ташкент',
    lat: 41.2758,
    lng: 69.2043,
    controllerKey: 'bz_ctrl_demo_2_ae31b8046c',
    lastSeenMinutesAgo: 3,
    prices: { AI_92: 10_800, AI_95: 12_300, DIESEL: 12_700 },
    tanks: [
      { label: 'Р-1', fuelType: 'AI_92', capacityL: 30_000, fillRatio: 0.45 },
      { label: 'Р-2', fuelType: 'AI_95', capacityL: 30_000, fillRatio: 0.87 },
      { label: 'Р-3', fuelType: 'DIESEL', capacityL: 20_000, fillRatio: 0.21 },
    ],
    dispensers: [
      { number: 1, fuelTypes: ['AI_92', 'AI_95'], identificationMode: 'CAMERA' },
      { number: 2, fuelTypes: ['AI_92', 'AI_95', 'DIESEL'], identificationMode: 'MANUAL' },
    ],
  },
  {
    id: 'demo-station-3',
    name: 'АЗС Самарканд-Восток',
    brand: 'UZGASTRADE',
    address: 'Самарканд, ул. Мирзо Улугбека 12',
    region: 'Самаркандская область',
    lat: 39.6543,
    lng: 66.9758,
    controllerKey: 'bz_ctrl_demo_3_71c0d9f4ea',
    // Связь потеряна больше часа назад — на карте эта АЗС должна быть офлайн,
    // а её остатки помечены как неактуальные.
    lastSeenMinutesAgo: 95,
    prices: { AI_92: 10_950, AI_95: 12_500 },
    tanks: [
      { label: 'Р-1', fuelType: 'AI_92', capacityL: 20_000, fillRatio: 0.55 },
      // Датчик на 95-м ещё не подключён: состояние «нет данных» должно быть
      // проверяемым на демо — и в карточке, и на шаге выбора топлива.
      { label: 'Р-2', fuelType: 'AI_95', capacityL: 20_000, fillRatio: 0.4, sensor: false },
    ],
    dispensers: [{ number: 1, fuelTypes: ['AI_92', 'AI_95'], identificationMode: 'MANUAL' }],
  },
  {
    // Большая АЗС: 5 видов топлива и 10 колонок — на ней проверяются скролл
    // сетки колонок, длинный список топлива и приглушение неработающей колонки.
    id: 'demo-station-4',
    name: 'АЗС Мирзо-Улугбек',
    brand: 'Benzeen Partner',
    address: 'Ташкент, Мирзо-Улугбекский район, ул. Буюк Ипак Йули 79',
    region: 'Ташкент',
    lat: 41.325,
    lng: 69.305,
    controllerKey: 'bz_ctrl_demo_4_c9d81f2b45',
    lastSeenMinutesAgo: 2,
    prices: { AI_92: 10_900, AI_95: 12_400, AI_98: 14_200, AI_100: 15_800, DIESEL: 12_900 },
    tanks: [
      { label: 'Р-1', fuelType: 'AI_92', capacityL: 30_000, fillRatio: 0.55 },
      { label: 'Р-2', fuelType: 'AI_95', capacityL: 30_000, fillRatio: 0.72 },
      { label: 'Р-3', fuelType: 'AI_98', capacityL: 15_000, fillRatio: 0.3 },
      // Почти пустой — на карточке видно «заканчивается».
      { label: 'Р-4', fuelType: 'AI_100', capacityL: 15_000, fillRatio: 0.08 },
      // Почти полный — противоположный край шкалы.
      { label: 'Р-5', fuelType: 'DIESEL', capacityL: 25_000, fillRatio: 0.94 },
    ],
    dispensers: [
      { number: 1, fuelTypes: ['AI_92', 'AI_95'], identificationMode: 'MANUAL' },
      { number: 2, fuelTypes: ['AI_92', 'AI_95', 'AI_98'], identificationMode: 'MANUAL' },
      { number: 3, fuelTypes: ['AI_92', 'AI_95'], identificationMode: 'MANUAL' },
      { number: 4, fuelTypes: ['AI_95', 'AI_98', 'AI_100'], identificationMode: 'MANUAL' },
      { number: 5, fuelTypes: ['AI_92', 'AI_95', 'AI_98', 'AI_100'], identificationMode: 'MANUAL' },
      { number: 6, fuelTypes: ['AI_92', 'AI_95'], identificationMode: 'MANUAL' },
      // Одна колонка выключена — приглушённая карточка тоже должна быть видна.
      { number: 7, fuelTypes: ['AI_92', 'AI_95', 'AI_98', 'AI_100', 'DIESEL'], identificationMode: 'MANUAL', status: 'DISABLED' },
      { number: 8, fuelTypes: ['AI_92', 'AI_95', 'AI_98', 'AI_100', 'DIESEL'], identificationMode: 'MANUAL' },
      { number: 9, fuelTypes: ['AI_92', 'AI_95', 'AI_98', 'AI_100', 'DIESEL'], identificationMode: 'MANUAL' },
      { number: 10, fuelTypes: ['DIESEL'], identificationMode: 'MANUAL' },
    ],
  },
];

function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

async function main() {
  const now = Date.now();

  for (const s of STATIONS) {
    const lastSeenAt = s.lastSeenMinutesAgo === null ? null : new Date(now - s.lastSeenMinutesAgo * 60_000);

    await prisma.fuelStation.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        name: s.name,
        brand: s.brand,
        address: s.address,
        region: s.region,
        lat: s.lat,
        lng: s.lng,
        controllerKeyHash: hashKey(s.controllerKey),
        lastSeenAt,
        isDemo: true,
      },
      update: {
        name: s.name,
        brand: s.brand,
        address: s.address,
        region: s.region,
        lat: s.lat,
        lng: s.lng,
        controllerKeyHash: hashKey(s.controllerKey),
        lastSeenAt,
        isDemo: true,
      },
    });

    for (const [fuelType, priceUzs] of Object.entries(s.prices) as [FuelType, number][]) {
      await prisma.stationPrice.upsert({
        where: { stationId_fuelType: { stationId: s.id, fuelType } },
        create: { stationId: s.id, fuelType, priceUzs },
        update: { priceUzs },
      });
    }

    for (const t of s.tanks) {
      const noSensor = t.sensor === false;
      const level = noSensor ? null : Math.round(t.capacityL * t.fillRatio);
      // Показание считается свежим только если сама АЗС на связи: иначе оно
      // датируется тем же моментом, когда связь пропала.
      const measuredAt = noSensor ? null : (lastSeenAt ?? new Date(now - 60_000));

      const tank = await prisma.tank.upsert({
        where: { stationId_label: { stationId: s.id, label: t.label } },
        create: {
          stationId: s.id,
          label: t.label,
          fuelType: t.fuelType,
          capacityL: t.capacityL,
          minLevelL: Math.round(t.capacityL * 0.1),
          currentLevelL: level,
          lastReadingAt: measuredAt,
        },
        update: {
          fuelType: t.fuelType,
          capacityL: t.capacityL,
          currentLevelL: level,
          lastReadingAt: measuredAt,
        },
      });

      if (!noSensor && level !== null && measuredAt !== null) {
        await prisma.tankReading.create({
          data: { tankId: tank.id, levelL: level, measuredAt, source: 'SENSOR' },
        });
      }

      const existingTankSub = await prisma.stationBillingSubscription.findFirst({
        where: { tankId: tank.id, endedAt: null },
      });
      if (!existingTankSub) {
        await prisma.stationBillingSubscription.create({
          data: {
            stationId: s.id,
            item: 'TANK',
            tankId: tank.id,
            dailyRateUzs: TANK_DAILY_RATE_UZS,
            // Подписка идёт с начала прошлого месяца, чтобы в кабинете сразу
            // было видно закрытый период и сумму счёта.
            startedAt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)),
          },
        });
      }
    }

    for (const d of s.dispensers) {
      const dispenser = await prisma.dispenser.upsert({
        where: { stationId_number: { stationId: s.id, number: d.number } },
        create: {
          stationId: s.id,
          number: d.number,
          fuelTypes: d.fuelTypes,
          identificationMode: d.identificationMode,
          bleBeaconId: d.identificationMode === 'BLE' ? `${s.id}-ble-${d.number}` : null,
          lastSeenAt,
          status: d.status ?? 'ACTIVE',
        },
        update: {
          fuelTypes: d.fuelTypes,
          identificationMode: d.identificationMode,
          lastSeenAt,
          status: d.status ?? 'ACTIVE',
        },
      });

      // Тарифицируется только колонка с идентификацией клиента: ручной выбор
      // колонки в приложении работает везде и денег не стоит.
      if (d.identificationMode !== 'MANUAL') {
        const existing = await prisma.stationBillingSubscription.findFirst({
          where: { dispenserId: dispenser.id, endedAt: null },
        });
        if (!existing) {
          await prisma.stationBillingSubscription.create({
            data: {
              stationId: s.id,
              item: 'DISPENSER',
              dispenserId: dispenser.id,
              dailyRateUzs: DISPENSER_DAILY_RATE_UZS,
              startedAt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)),
            },
          });
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(`✓ ${s.name}: ${s.tanks.length} резервуаров, ${s.dispensers.length} колонок`);
    // eslint-disable-next-line no-console
    console.log(`  ключ контроллера: ${s.controllerKey}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
