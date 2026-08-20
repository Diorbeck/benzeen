import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Fuel, Gauge, WifiOff } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStationAccess } from "@/lib/station-auth";
import { buildInvoiceDraft, monthEnd, monthStart } from "@/lib/station-billing";
import { isReadingFresh, isStationOnline } from "@/lib/stations";
import { CAMERA_IDENTIFICATION_ENABLED } from "@/lib/features";
import { identificationDailyRateUzs } from "@/lib/dispenser-identification";
import { receiptStatus } from "@/lib/soliq-retry";
import { DispenserIdentificationControls } from "@/components/station/dispenser-identification-controls";

// Модуль 6 ТЗ v2: кабинет АЗС. Одна страница на объект: остатки по
// резервуарам, состояние колонок и счёт за месяц — то, из-за чего владелец
// вообще заходит в кабинет.

export const dynamic = "force-dynamic";

const FUEL_LABELS: Record<string, string> = {
  AI_92: "АИ-92",
  AI_95: "АИ-95",
  AI_98: "АИ-98",
  AI_100: "АИ-100",
  DIESEL: "Дизель",
  PROPANE: "Пропан",
};

export default async function StationPanelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("stationPanel");

  const access = await requireStationAccess();
  if ("error" in access) {
    redirect(access.status === 401 ? `/${locale}/login` : `/${locale}`);
  }

  const stations = await prisma.fuelStation.findMany({
    where: { id: { in: access.stationIds }, status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    include: {
      tanks: { orderBy: { label: "asc" } },
      dispensers: { orderBy: { number: "asc" } },
      billing: {
        where: { OR: [{ endedAt: null }, { endedAt: { gt: new Date() } }] },
      },
      invoices: { orderBy: { periodStart: "desc" }, take: 6 },
      // Последние заправки через Benzeen — то, что владелец сверяет с сменным
      // отчётом заправщика.
      sessions: {
        where: { status: { in: ["FLOWING", "SETTLED", "MANUAL_REVIEW"] } },
        orderBy: { startedAt: "desc" },
        take: 15,
        select: {
          id: true,
          fuelType: true,
          litersDispensed: true,
          amountUzs: true,
          status: true,
          startedAt: true,
          offlineBuffered: true,
          soliqSyncedAt: true,
          soliqAttempts: true,
          soliqLastAttemptAt: true,
          cashbackUzs: true,
          dispenser: { select: { number: true } },
        },
      },
    },
  });

  // Сводка за сутки считается в базе, а не из последних 15 записей: иначе на активном
  // объекте цифра была бы тихо занижена.
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayTotals = await prisma.fuelingSession.groupBy({
    by: ["stationId"],
    where: {
      stationId: { in: access.stationIds },
      status: "SETTLED",
      startedAt: { gte: dayStart },
    },
    _sum: { litersDispensed: true, amountUzs: true },
    _count: { _all: true },
  });

  const now = new Date();
  // Счёт выставляется в начале месяца за прошедший месяц, поэтому в кабинете
  // показывается и уже выставленный, и накопленное за текущий месяц.
  const currentStart = monthStart(now);
  const currentEnd = monthEnd(now);

  const money = (uzs: number) => `${uzs.toLocaleString("ru-RU")} ${t("sum")}`;

  return (
    <div className="min-h-screen bg-canvas text-navy dark:bg-navy-950 dark:text-white">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Тот же издательский ключ, что и в клиентской части: надзаголовок
            разрядкой, крупный акцидентный заголовок, короткое пояснение. */}
        <p className="text-caption font-semibold uppercase tracking-[0.2em] text-primary-600 dark:text-sky-300">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 font-editorial text-[32px] font-semibold leading-[1.05] tracking-[-0.01em] text-navy dark:text-white sm:text-[38px]">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600 dark:text-gray-300">
          {t("subtitle")}
        </p>

        {stations.length === 0 && (
          <div className="mt-8 rounded-card border border-gray-200 bg-white p-10 text-center dark:border-white/10 dark:bg-navy-900">
            <h2 className="text-subheading text-navy dark:text-white">
              {t("emptyTitle")}
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-600 dark:text-gray-300">
              {t("emptyDesc")}
            </p>
          </div>
        )}

        {stations.map((station) => {
          const online = isStationOnline(station.lastSeenAt, now);
          const accrued = buildInvoiceDraft(
            station.billing.map((b) => ({
              item: b.item,
              dailyRateUzs: b.dailyRateUzs,
              startedAt: b.startedAt,
              endedAt: b.endedAt,
            })),
            currentStart,
            // Накопление считается до «сейчас», а не до конца месяца: иначе
            // владелец увидел бы сумму за дни, которые ещё не наступили.
            now,
          );

          const lowTanks = station.tanks.filter(
            (tank) =>
              tank.minLevelL !== null &&
              tank.currentLevelL !== null &&
              tank.currentLevelL <= tank.minLevelL,
          );
          const staleTanks = station.tanks.filter(
            (tank) => !isReadingFresh(tank.lastReadingAt, now),
          );
          const today = todayTotals.find((x) => x.stationId === station.id);

          return (
            <section
              key={station.id}
              className="mt-8 rounded-card border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-navy-900"
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-editorial text-[23px] font-semibold leading-tight tracking-[-0.01em] text-navy dark:text-white">
                    {station.name}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {station.address}
                  </p>
                  {/* ИНН виден владельцу: по нему Солик сводит чеки с объектом. */}
                  {station.tin ? (
                    <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      {t("tin")} {station.tin}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-warning-600 dark:text-warning-500">
                      {t("tinMissing")}
                    </p>
                  )}
                </div>
                {online ? (
                  <span className="rounded-md bg-success-500/10 px-2.5 py-0.5 text-xs font-medium text-success-600 dark:text-success-500">
                    {t("online")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                    <WifiOff className="h-3 w-3" aria-hidden /> {t("offline")}
                  </span>
                )}
              </header>

              {/* Алерты сверху: то, из-за чего надо действовать сейчас. */}
              {(lowTanks.length > 0 || staleTanks.length > 0 || !online) && (
                <ul className="mt-4 space-y-2">
                  {!online && (
                    <Alert>
                      {t("alertOffline", {
                        when: station.lastSeenAt
                          ? station.lastSeenAt.toLocaleString(locale)
                          : t("never"),
                      })}
                    </Alert>
                  )}
                  {lowTanks.map((tank) => (
                    <Alert key={`low-${tank.id}`}>
                      {t("alertLow", {
                        tank: tank.label,
                        fuel: FUEL_LABELS[tank.fuelType] ?? tank.fuelType,
                        liters: Math.round(
                          tank.currentLevelL ?? 0,
                        ).toLocaleString("ru-RU"),
                      })}
                    </Alert>
                  ))}
                  {staleTanks.map((tank) => (
                    <Alert key={`stale-${tank.id}`}>
                      {t("alertStale", { tank: tank.label })}
                    </Alert>
                  ))}
                </ul>
              )}

              <h3 className="mt-6 flex items-center gap-2 text-sm font-semibold text-navy dark:text-white">
                <Gauge className="h-4 w-4" aria-hidden /> {t("tanks")}
              </h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {station.tanks.map((tank) => {
                  const level = tank.currentLevelL ?? 0;
                  const percent = Math.min(
                    100,
                    Math.round((level / Math.max(1, tank.capacityL)) * 100),
                  );
                  const fresh = isReadingFresh(tank.lastReadingAt, now);
                  return (
                    <li
                      key={tank.id}
                      className="rounded-control bg-gray-50 p-4 dark:bg-white/5"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-navy dark:text-white">
                          {tank.label} ·{" "}
                          {FUEL_LABELS[tank.fuelType] ?? tank.fuelType}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {t("capacity", {
                            n: tank.capacityL.toLocaleString("ru-RU"),
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-navy dark:text-white">
                        {fresh
                          ? `${Math.round(level).toLocaleString("ru-RU")} ${t("liters")}`
                          : t("noData")}
                      </p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                        <div
                          className={
                            tank.minLevelL !== null && level <= tank.minLevelL
                              ? "h-full rounded-full bg-red-500"
                              : "h-full rounded-full bg-primary-500 dark:bg-primary-500"
                          }
                          style={{ width: `${fresh ? percent : 0}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {tank.lastReadingAt
                          ? t("lastReading", {
                              when: tank.lastReadingAt.toLocaleString(locale),
                            })
                          : t("noReadings")}
                      </p>
                    </li>
                  );
                })}
                {station.tanks.length === 0 && (
                  <li className="text-sm text-gray-500 dark:text-gray-400">
                    {t("noTanks")}
                  </li>
                )}
              </ul>

              <h3 className="mt-6 flex items-center gap-2 text-sm font-semibold text-navy dark:text-white">
                <Fuel className="h-4 w-4" aria-hidden /> {t("dispensers")}
              </h3>
              <ul className="mt-3 space-y-2">
                {station.dispensers.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-control bg-gray-50 px-4 py-3 dark:bg-white/5"
                  >
                    <span className="block text-sm font-medium text-navy dark:text-white">
                      {t("dispenserNo", { n: d.number })} ·{" "}
                      {d.fuelTypes.map((f) => FUEL_LABELS[f] ?? f).join(", ")}
                    </span>
                    <div className="mt-2">
                      <DispenserIdentificationControls
                        dispenser={{
                          dispenserId: d.id,
                          mode: d.identificationMode,
                          hasBeacon: d.bleBeaconId !== null,
                        }}
                        cameraEnabled={CAMERA_IDENTIFICATION_ENABLED}
                        dailyRateUzs={identificationDailyRateUzs(
                          d.identificationMode === "MANUAL"
                            ? "BLE"
                            : d.identificationMode,
                        )}
                      />
                    </div>
                  </li>
                ))}
                {station.dispensers.length === 0 && (
                  <li className="text-sm text-gray-500 dark:text-gray-400">
                    {t("noDispensers")}
                  </li>
                )}
              </ul>

              {/* Заправки через приложение — Модуль 6 ТЗ v2. Кассовые операции по ним
                  АЗС не ведёт, поэтому этот список и есть её отчёт по смене. */}
              <h3 className="mt-6 flex items-center gap-2 text-sm font-semibold text-navy dark:text-white">
                <Gauge className="h-4 w-4" aria-hidden /> {t("fuelings")}
              </h3>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-control bg-gray-50 px-3 py-2 dark:bg-white/5">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("todayCount")}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-navy dark:text-white">
                    {today?._count._all ?? 0}
                  </p>
                </div>
                <div className="rounded-control bg-gray-50 px-3 py-2 dark:bg-white/5">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("todayLiters")}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-navy dark:text-white">
                    {Math.round(
                      today?._sum.litersDispensed ?? 0,
                    ).toLocaleString("ru-RU")}
                  </p>
                </div>
                <div className="rounded-control bg-gray-50 px-3 py-2 dark:bg-white/5">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("todayAmount")}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-navy dark:text-white">
                    {(today?._sum.amountUzs ?? 0).toLocaleString("ru-RU")}
                  </p>
                </div>
              </div>

              {station.sessions.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  {t("noFuelings")}
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {station.sessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-gray-50 px-4 py-3 text-sm dark:bg-white/5"
                    >
                      <span className="text-navy dark:text-white">
                        {s.startedAt.toLocaleString(locale, {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" · "}
                        {t("dispenserNo", { n: s.dispenser?.number ?? 0 })}
                        {" · "}
                        {FUEL_LABELS[s.fuelType] ?? s.fuelType}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums text-gray-600 dark:text-gray-300">
                          {(s.litersDispensed ?? 0).toFixed(2)} {t("liters")}
                        </span>
                        <span className="font-medium tabular-nums text-navy dark:text-white">
                          {money(s.amountUzs ?? 0)}
                        </span>
                        {s.status === "SETTLED" &&
                          (() => {
                            const state = receiptStatus(s);
                            const tone =
                              state === "sent"
                                ? "bg-success-500/10 text-success-600 dark:text-success-500"
                                : state === "stuck"
                                  ? "bg-warning-500/10 text-warning-600"
                                  : "bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-200";
                            return (
                              <span
                                className={`rounded-md px-2 py-0.5 text-xs font-medium ${tone}`}
                                title={
                                  state === "sent"
                                    ? t("receiptCashback", {
                                        sum: (
                                          s.cashbackUzs ?? 0
                                        ).toLocaleString("ru-RU"),
                                      })
                                    : undefined
                                }
                              >
                                {t(`receipt.${state}`)}
                              </span>
                            );
                          })()}
                        {s.status === "FLOWING" && (
                          <span className="rounded-md bg-primary-500/10 px-2 py-0.5 text-xs font-medium text-primary-600 dark:text-primary-500">
                            {t("fuelingFlowing")}
                          </span>
                        )}
                        {s.status === "MANUAL_REVIEW" && (
                          <span className="rounded-md bg-warning-500/10 px-2 py-0.5 text-xs font-medium text-warning-600">
                            {t("fuelingReview")}
                          </span>
                        )}
                        {s.offlineBuffered && (
                          <span className="rounded-md bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                            {t("fuelingBuffered")}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-6 text-sm font-semibold text-navy dark:text-white">
                {t("billing")}
              </h3>
              <div className="mt-3 rounded-control bg-gray-50 p-4 dark:bg-white/5">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t("accruedThisMonth")}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-navy dark:text-white">
                  {money(accrued.amountUzs)}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t("accruedBreakdown", {
                    tankDays: accrued.tankDays,
                    dispenserDays: accrued.dispenserDays,
                  })}
                </p>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {t("invoiceNote")}
                </p>
              </div>

              {station.invoices.length > 0 && (
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                      <th className="py-2 font-medium">{t("period")}</th>
                      <th className="py-2 font-medium">{t("amount")}</th>
                      <th className="py-2 font-medium">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {station.invoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-t border-gray-200 dark:border-white/10"
                      >
                        <td className="py-2 tabular-nums">
                          {inv.periodStart.toLocaleDateString(locale, {
                            month: "long",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-2 tabular-nums">
                          {money(inv.amountUzs)}
                        </td>
                        <td className="py-2">
                          {t(`invoiceStatus.${inv.status}`)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 rounded-control bg-warning-500/10 px-4 py-3 text-sm text-warning-600 dark:text-warning-500">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
