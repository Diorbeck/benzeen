import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInvoiceDraft, monthStart } from "@/lib/station-billing";
import { MAX_SOLIQ_ATTEMPTS } from "@/lib/soliq-retry";
import { aggregateStocks, isStationOnline } from "@/lib/stations";
import { StationOnboardingForm } from "@/components/dashboard/station-onboarding-form";
import {
  StationsNetworkMap,
  type NetworkStation,
} from "@/components/dashboard/stations-network-map";
import {
  SubscriptionControls,
  type SubscriptionTargetView,
} from "@/components/dashboard/subscription-controls";
import {
  buildSubscriptionStates,
  dailyChargeUzs,
  type SubscriptionTarget,
} from "@/lib/station-subscriptions";

// Модуль 7 ТЗ v2: админ-панель Benzeen по сети АЗС. Сводка по всем подключённым
// объектам страны: связь с контроллером, остатки с датчиков, начисление за
// инфраструктуру и выгрузки для налоговой и банка.

export const dynamic = "force-dynamic";

const FUEL_LABELS: Record<string, string> = {
  AI_92: "АИ-92",
  AI_95: "АИ-95",
  AI_98: "АИ-98",
  AI_100: "АИ-100",
  DIESEL: "Дизель",
  PROPANE: "Пропан",
};

export default async function AdminStationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("adminStations");
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);
  const { role } = session.user as { role?: string };
  if (role !== "SUPER_ADMIN") redirect(`/${locale}/dashboard`);

  const now = new Date();
  const periodStart = monthStart(now);

  const stations = await prisma.fuelStation.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    include: {
      tanks: { orderBy: { label: "asc" } },
      dispensers: {
        orderBy: { number: "asc" },
        select: { id: true, number: true },
      },
      // Нужны и закрытые в этом месяце строки: по ним считается начисление за
      // дни до отключения.
      billing: {
        where: { OR: [{ endedAt: null }, { endedAt: { gte: periodStart } }] },
      },
    },
  });

  // Заправки за месяц — одним запросом с группировкой, а не по объекту:
  // объектов в стране будут сотни.
  // Модуль 5: состояние фискальных чеков по стране. Чеки, не ушедшие в Солик, —
  // это операции, по которым АЗС осталась без кассового документа, поэтому цифра
  // должна быть на виду, а не в логах.
  const receiptBase = {
    status: "SETTLED" as const,
    amountUzs: { gt: 0 },
    startedAt: { gte: periodStart },
  };
  const [receiptsSent, receiptsQueued, receiptsStuck] = await Promise.all([
    prisma.fuelingSession.count({
      where: { ...receiptBase, soliqSyncedAt: { not: null } },
    }),
    prisma.fuelingSession.count({
      where: {
        ...receiptBase,
        soliqSyncedAt: null,
        soliqAttempts: { lt: MAX_SOLIQ_ATTEMPTS },
      },
    }),
    prisma.fuelingSession.count({
      where: {
        ...receiptBase,
        soliqSyncedAt: null,
        soliqAttempts: { gte: MAX_SOLIQ_ATTEMPTS },
      },
    }),
  ]);

  const monthly = await prisma.fuelingSession.groupBy({
    by: ["stationId"],
    where: {
      status: { in: ["SETTLED", "MANUAL_REVIEW"] },
      startedAt: { gte: periodStart },
    },
    _count: { _all: true },
    _sum: { litersDispensed: true, amountUzs: true },
  });

  const rows = stations.map((station) => {
    const accrued = buildInvoiceDraft(
      station.billing.map((b) => ({
        item: b.item,
        dailyRateUzs: b.dailyRateUzs,
        startedAt: b.startedAt,
        endedAt: b.endedAt,
      })),
      periodStart,
      now,
    );
    const stats = monthly.find((m) => m.stationId === station.id);

    const targets: SubscriptionTarget[] = [
      ...station.tanks.map((tank) => ({
        id: tank.id,
        item: "TANK" as const,
        label: tank.label,
      })),
      ...station.dispensers.map((d) => ({
        id: d.id,
        item: "DISPENSER" as const,
        label: `№ ${d.number}`,
      })),
    ];
    const states = buildSubscriptionStates(
      targets,
      station.billing.map((b) => ({
        id: b.id,
        item: b.item,
        tankId: b.tankId,
        dispenserId: b.dispenserId,
        dailyRateUzs: b.dailyRateUzs,
        startedAt: b.startedAt,
        endedAt: b.endedAt,
      })),
      now,
    );
    const subscriptionTargets: SubscriptionTargetView[] = states.map(
      (state) => ({
        targetId: state.target.id,
        item: state.target.item,
        label: state.target.label,
        active: state.active !== null,
        dailyRateUzs: state.dailyRateUzs,
      }),
    );

    return {
      subscriptionTargets,
      dailyUzs: dailyChargeUzs(states),
      station,
      online: isStationOnline(station.lastSeenAt, now),
      stocks: aggregateStocks(station.tanks, now),
      accruedUzs: accrued.amountUzs,
      sessions: stats?._count._all ?? 0,
      liters: stats?._sum.litersDispensed ?? 0,
    };
  });

  const mapStations: NetworkStation[] = rows.map((row) => ({
    id: row.station.id,
    name: row.station.name,
    address: row.station.address,
    tin: row.station.tin,
    lat: row.station.lat,
    lng: row.station.lng,
    online: row.online,
    tanks: row.station.tanks.length,
    dispensers: row.station.dispensers.length,
    stocks: row.stocks.map((s) => ({
      fuelType: s.fuelType,
      litersAvailable: s.litersAvailable,
      dataFresh: s.dataFresh,
    })),
  }));

  const money = (uzs: number) =>
    `${Math.round(uzs).toLocaleString("ru-RU")} ${t("sum")}`;
  const onlineCount = rows.filter((r) => r.online).length;
  const totalAccrued = rows.reduce((sum, r) => sum + r.accruedUzs, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <p className="text-caption font-semibold uppercase tracking-[0.2em] text-primary-600 dark:text-sky-300">
        {t("eyebrow")}
      </p>
      <h1 className="mt-3 font-editorial text-[32px] font-semibold leading-[1.05] tracking-[-0.01em] text-navy dark:text-white sm:text-[38px]">
        {t("title")}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600 dark:text-gray-300">
        {t("subtitle")}
      </p>

      <StationOnboardingForm locale={locale} />

      {/* Три цифры, за которыми смотрит Benzeen и банк: сколько объектов, сколько
          на связи и сколько начислено по подписке с начала месяца. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: t("totalStations"), value: String(rows.length) },
          { label: t("totalOnline"), value: `${onlineCount} / ${rows.length}` },
          { label: t("totalAccrued"), value: money(totalAccrued) },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-card border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-navy-900"
          >
            <p className="text-caption uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
              {kpi.label}
            </p>
            <p className="mt-2 font-display text-[26px] font-bold tabular-nums leading-none text-navy dark:text-white">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Модуль 5 ТЗ v2: чеки в Солик. Очередь — норма, «требует разбора» —
          повод открыть заправку руками. */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: t("receiptsSent"),
            value: String(receiptsSent),
            warn: false,
          },
          {
            label: t("receiptsQueued"),
            value: String(receiptsQueued),
            warn: false,
          },
          {
            label: t("receiptsStuck"),
            value: String(receiptsStuck),
            warn: receiptsStuck > 0,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={
              kpi.warn
                ? "rounded-card border border-warning-500/40 bg-warning-500/5 p-5"
                : "rounded-card border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-navy-900"
            }
          >
            <p className="text-caption uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
              {kpi.label}
            </p>
            <p
              className={
                kpi.warn
                  ? "mt-2 font-display text-[26px] font-bold tabular-nums leading-none text-warning-600"
                  : "mt-2 font-display text-[26px] font-bold tabular-nums leading-none text-navy dark:text-white"
              }
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {mapStations.length > 0 && <StationsNetworkMap stations={mapStations} />}

      <section className="mt-8 rounded-card border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-navy-900">
        <h2 className="font-editorial text-[21px] font-semibold text-navy dark:text-white">
          {t("exportTitle")}
        </h2>
        {/* Это не навигация, а скачивание CSV, поэтому обычная ссылка, а не Link. */}
        {/* eslint-disable @next/next/no-html-link-for-pages */}
        {/* Это не навигация, а скачивание CSV, поэтому обычная ссылка, а не Link. */}
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/api/admin/stations/export?kind=soliq"
            className="inline-flex items-center gap-2 rounded-control border border-gray-200 px-3.5 py-2 text-sm font-medium text-navy transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
          >
            <Download className="h-4 w-4" aria-hidden />
            {t("exportSoliq")}
          </a>
          <a
            href="/api/admin/stations/export?kind=acquiring"
            className="inline-flex items-center gap-2 rounded-control border border-gray-200 px-3.5 py-2 text-sm font-medium text-navy transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
          >
            <Download className="h-4 w-4" aria-hidden />
            {t("exportAcquiring")}
          </a>
        </div>
        {/* eslint-enable @next/next/no-html-link-for-pages */}
      </section>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-card border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 dark:border-white/10 dark:bg-navy-900 dark:text-gray-300">
          {t("empty")}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((row) => (
            <li
              key={row.station.id}
              className="rounded-card border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-navy-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-editorial text-[21px] font-semibold leading-tight text-navy dark:text-white">
                    {row.station.name}
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {row.station.address}
                  </p>
                  {row.station.tin ? (
                    <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      {t("tin")} {row.station.tin}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-warning-600 dark:text-warning-500">
                      {t("tinMissing")}
                    </p>
                  )}
                </div>
                <span
                  className={
                    row.online
                      ? "rounded-md bg-success-500/10 px-2.5 py-0.5 text-xs font-medium text-success-600 dark:text-success-500"
                      : "rounded-md bg-warning-500/10 px-2.5 py-0.5 text-xs font-medium text-warning-600 dark:text-warning-500"
                  }
                >
                  {row.online ? t("online") : t("offline")}
                </span>
              </div>

              {/* Остатки с датчиков — то, чего нет ни у одного конкурента,
                  поэтому в админке они на первом месте после статуса. */}
              {row.stocks.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {row.stocks.map((stock) => (
                    <span
                      key={stock.fuelType}
                      className="rounded-control border border-gray-200 px-2.5 py-1 text-xs tabular-nums text-navy dark:border-white/10 dark:text-white"
                    >
                      {FUEL_LABELS[stock.fuelType] ?? stock.fuelType}{" "}
                      {stock.dataFresh
                        ? `${Math.round(stock.litersAvailable).toLocaleString("ru-RU")} ${t("liters")}`
                        : "—"}
                    </span>
                  ))}
                </div>
              )}

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                {[
                  { k: t("tanks"), v: String(row.station.tanks.length) },
                  {
                    k: t("dispensers"),
                    v: String(row.station.dispensers.length),
                  },
                  { k: t("sessions"), v: String(row.sessions) },
                  { k: t("accrued"), v: money(row.accruedUzs) },
                ].map((cell) => (
                  <div key={cell.k}>
                    <dt className="text-xs uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                      {cell.k}
                    </dt>
                    <dd className="mt-1 tabular-nums font-medium text-navy dark:text-white">
                      {cell.v}
                    </dd>
                  </div>
                ))}
              </dl>

              <SubscriptionControls
                stationId={row.station.id}
                targets={row.subscriptionTargets}
                dailyUzs={row.dailyUzs}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
