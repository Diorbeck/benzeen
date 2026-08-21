import { isReadingFresh, type TankLike } from './stations';

// Симулятор датчиков для демонстрационных АЗС.
//
// Зачем он вообще нужен. Пилотного объекта с настоящим контроллером ещё нет, а
// карта без живых цифр не показывает главного — что остатки идут с датчиков в
// резервуарах. Разовый засев в базу даёт цифру, которая через 15 минут
// становится устаревшей, и демо-АЗС уходит в «нет данных».
//
// Поэтому уровень демо-резервуара считается функцией времени, а не хранится:
// цифра всегда свежая, при каждом обновлении страницы немного другая и не
// требует ни фоновой задачи, ни записи в базу. Настоящие АЗС этот код не
// касается — он работает только при isDemo.

/** За сколько демо-резервуар опустошается от полного до минимума. */
export const DEMO_CYCLE_MS = 8 * 60 * 60 * 1000;

/** Границы уровня в долях ёмкости: пустых и по горло полных резервуаров не бывает. */
export const DEMO_MAX_FILL = 0.94;
export const DEMO_MIN_FILL = 0.18;

/** Детерминированный сдвиг фазы по строке: резервуары не должны пустеть синхронно. */
function phase(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

/**
 * Доля заполнения демо-резервуара на заданный момент: пилообразный расход
 * (машины заправляются) с редкими скачками вверх (приехал бензовоз) и мелкой
 * рябью, чтобы цифра не выглядела вычисленной по линейке.
 */
export function demoFillRatio(seed: string, now: Date = new Date()): number {
  const p = phase(seed);
  const cycle = ((now.getTime() / DEMO_CYCLE_MS + p) % 1 + 1) % 1;
  const span = DEMO_MAX_FILL - DEMO_MIN_FILL;
  const drained = DEMO_MAX_FILL - span * cycle;
  const ripple = Math.sin((now.getTime() / 60_000 + p * 60) * 0.35) * 0.012;
  return Math.min(DEMO_MAX_FILL, Math.max(DEMO_MIN_FILL, drained + ripple));
}

export type DemoTank = TankLike & { id: string };

/**
 * Подставляет демо-резервуарам свежий уровень и время показания. Резервуар на
 * обслуживании не трогается: сломанный резервуар должен выглядеть сломанным и
 * в демо тоже.
 */
export function simulateDemoTanks<T extends DemoTank>(tanks: readonly T[], now: Date = new Date()): T[] {
  return tanks.map((tank) => {
    if (tank.status === 'MAINTENANCE') return tank;
    // Резервуар, который ни разу не отчитался, — это «датчик ещё не подключён»:
    // он должен честно показывать «нет данных» и на демо-АЗС, иначе состояние
    // не проверить нигде. Симулируются только резервуары с историей показаний.
    if (tank.lastReadingAt === null && tank.currentLevelL === null) return tank;
    // Свежее показание важнее симуляции: локальный имитатор (и будущий реальный
    // контроллер) пишет настоящие уровни, и подменять их нельзя — иначе карточка
    // на карте и экран заправки показывают разные цифры. Симуляция — фолбэк на
    // случай, когда телеметрии нет и данные устарели.
    if (isReadingFresh(tank.lastReadingAt, now) && tank.currentLevelL !== null) return tank;
    const level = Math.round(tank.capacityL * demoFillRatio(`${tank.id}:${tank.fuelType}`, now));
    return { ...tank, currentLevelL: level, lastReadingAt: now };
  });
}
