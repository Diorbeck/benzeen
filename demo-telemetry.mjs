// Демо-имитатор контроллеров АЗС: раз в 60 секунд отправляет замеры уровня
// в /api/station/telemetry, чтобы на карте были живые данные. Только для демо.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = process.env.DEMO_BASE ?? 'http://localhost:3000';
const KEYS = {
  'demo-station-1': 'bz_ctrl_demo_1_5f2a9c1d7b',
  'demo-station-2': 'bz_ctrl_demo_2_ae31b8046c',
  'demo-station-3': 'bz_ctrl_demo_3_71c0d9f4ea',
};

const stations = await prisma.fuelStation.findMany({
  where: { id: { in: Object.keys(KEYS) } },
  include: { tanks: true },
});
await prisma.$disconnect();

const state = new Map();
for (const s of stations) {
  for (const t of s.tanks) {
    state.set(t.id, t.currentLevelL ?? Math.round(t.capacityL * 0.5));
  }
}

async function tick() {
  for (const s of stations) {
    const readings = s.tanks.map((t) => {
      // Небольшой расход + иногда завоз: уровень живёт, но остаётся в границах.
      const prev = state.get(t.id) ?? t.capacityL * 0.5;
      const drain = Math.random() * 60;
      const refill = Math.random() < 0.05 ? t.capacityL * 0.25 : 0;
      const next = Math.max(200, Math.min(t.capacityL, prev - drain + refill));
      state.set(t.id, next);
      return { tankId: t.id, levelL: Math.round(next), temperatureC: 18 + Math.random() * 6 };
    });
    try {
      const res = await fetch(`${BASE}/api/station/telemetry`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${KEYS[s.id]}` },
        body: JSON.stringify({ stationId: s.id, readings }),
      });
      console.log(new Date().toISOString(), s.id, res.status);
    } catch (e) {
      console.log(new Date().toISOString(), s.id, 'error', String(e).slice(0, 80));
    }
  }
}

await tick();
setInterval(tick, 60_000);
