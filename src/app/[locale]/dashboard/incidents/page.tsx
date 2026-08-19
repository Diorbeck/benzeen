import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Gauge, Receipt, WifiOff } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_SOLIQ_ATTEMPTS } from "@/lib/soliq-retry";
import {
  STATION_OFFLINE_AFTER_MS,
  TANK_READING_STALE_AFTER_MS,
} from "@/lib/stations";
import {
  buildIncidents,
  countByKind,
  type IncidentKind,
} from "@/lib/incidents";
import { ReceiptRetryButton } from "@/components/dashboard/receipt-retry-button";

// Инцидент-борд Benzeen/Apex — Модуль 7 ТЗ v2, этап 6 роадмапы.
//
// Одно место, где видно всё, что сломалось: заправки в ручном разборе (деньги
// клиента), чеки, не ушедшие в Солик, объекты без связи и молчащие датчики.
// Сортировка по тяжести и давности — сверху то, что чинить первым.

export const dynamic = "force-dynamic";

const KIND_ICONS: Record<
  IncidentKind,
  React.ComponentType<{ className?: string }>
> = {
  MANUAL_REVIEW: AlertTriangle,
  SOLIQ_STUCK: Receipt,
  STATION_OFFLINE: WifiOff,
  TANK_STALE: Gauge,
};

export default async function IncidentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("incidents");
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);
  const { role } = session.user as { role?: string };
  if (role !== "SUPER_ADMIN") redirect(`/${locale}/dashboard`);

  const now = new Date();
  const offlineBefore = new Date(now.getTime() - STATION_OFFLINE_AFTER_MS);
  const staleBefore = new Date(now.getTime() - TANK_READING_STALE_AFTER_MS);

  const [manualReview, stuckReceipts, offlineStations, staleTanks] =
    await Promise.all([
      prisma.fuelingSession.findMany({
        where: { status: "MANUAL_REVIEW" },
        orderBy: { startedAt: "asc" },
        take: 50,
        select: {
          id: true,
          stationId: true,
          startedAt: true,
          holdAmountUzs: true,
          litersDispensed: true,
          station: { select: { name: true } },
        },
      }),
      prisma.fuelingSession.findMany({
        where: {
          status: "SETTLED",
          soliqSyncedAt: null,
          amountUzs: { gt: 0 },
          soliqAttempts: { gte: MAX_SOLIQ_ATTEMPTS },
        },
        orderBy: { startedAt: "asc" },
        take: 50,
        select: {
          id: true,
          stationId: true,
          startedAt: true,
          endedAt: true,
          amountUzs: true,
          soliqLastError: true,
          station: { select: { name: true } },
        },
      }),
      prisma.fuelStation.findMany({
        where: {
          status: { not: "ARCHIVED" },
          OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: offlineBefore } }],
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, lastSeenAt: true },
      }),
      prisma.tank.findMany({
        where: {
          station: { status: { not: "ARCHIVED" } },
          OR: [{ lastReadingAt: null }, { lastReadingAt: { lt: staleBefore } }],
        },
        orderBy: { label: "asc" },
        take: 50,
        select: {
          id: true,
          label: true,
          stationId: true,
          lastReadingAt: true,
          station: { select: { name: true } },
        },
      }),
    ]);

  const incidents = buildIncidents(
    {
      manualReview: manualReview.map((s) => ({
        id: s.id,
        stationId: s.stationId,
        stationName: s.station.name,
        startedAt: s.startedAt,
        holdAmountUzs: s.holdAmountUzs,
        litersDispensed: s.litersDispensed,
      })),
      stuckReceipts: stuckReceipts.map((s) => ({
        id: s.id,
        stationId: s.stationId,
        stationName: s.station.name,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        amountUzs: s.amountUzs,
        soliqLastError: s.soliqLastError,
      })),
      offlineStations,
      staleTanks: staleTanks.map((tank) => ({
        id: tank.id,
        label: tank.label,
        stationId: tank.stationId,
        stationName: tank.station.name,
        lastReadingAt: tank.lastReadingAt,
      })),
    },
    now,
  );

  const counts = countByKind(incidents);
  const retryLabels = {
    retry: t("retry"),
    sending: t("retrySending"),
    sent: t("retrySent"),
    failed: t("retryFailed"),
    skipped: t("retrySkipped"),
  };

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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["MANUAL_REVIEW", t("kindManualReview")],
            ["SOLIQ_STUCK", t("kindSoliqStuck")],
            ["STATION_OFFLINE", t("kindStationOffline")],
            ["TANK_STALE", t("kindTankStale")],
          ] as [IncidentKind, string][]
        ).map(([kind, label]) => {
          const value = counts[kind];
          const warn = value > 0;
          return (
            <div
              key={kind}
              className={
                warn
                  ? "rounded-card border border-warning-500/40 bg-warning-500/5 p-5"
                  : "rounded-card border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-navy-900"
              }
            >
              <p className="text-caption uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                {label}
              </p>
              <p
                className={
                  warn
                    ? "mt-2 font-display text-[26px] font-bold tabular-nums leading-none text-warning-600"
                    : "mt-2 font-display text-[26px] font-bold tabular-nums leading-none text-navy dark:text-white"
                }
              >
                {value}
              </p>
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-card border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-navy-900">
        <h2 className="text-sm font-semibold text-navy dark:text-white">
          {t("listTitle")}
        </h2>

        {incidents.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {t("empty")}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {incidents.map((item) => {
              const Icon = KIND_ICONS[item.kind];
              const kindLabel = {
                MANUAL_REVIEW: t("kindManualReview"),
                SOLIQ_STUCK: t("kindSoliqStuck"),
                STATION_OFFLINE: t("kindStationOffline"),
                TANK_STALE: t("kindTankStale"),
              }[item.kind];
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-gray-50 px-4 py-3 dark:bg-white/5"
                >
                  <span className="flex min-w-0 items-start gap-3">
                    <Icon
                      className={
                        item.severity === "high"
                          ? "mt-0.5 h-4 w-4 shrink-0 text-warning-600"
                          : "mt-0.5 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400"
                      }
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-navy dark:text-white">
                        {kindLabel} · {item.stationName}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                        {item.at.toLocaleString(locale, {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {item.detail ? ` · ${item.detail}` : ""}
                      </span>
                      {item.error && (
                        <span className="mt-0.5 block break-words text-xs text-warning-600">
                          {item.error}
                        </span>
                      )}
                    </span>
                  </span>
                  {item.kind === "SOLIQ_STUCK" && (
                    <ReceiptRetryButton
                      sessionId={item.id.replace(/^sq-/, "")}
                      labels={retryLabels}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
