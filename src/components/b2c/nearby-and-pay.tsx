"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { fillPercent, type HomeStations } from "./use-home-stations";

// Ряд под первым экраном: слева — ближайшие АЗС списком (то же, что на карте,
// но читается без клика), справа — тёмно-синяя карточка про оплату из
// приложения: это то, чем Benzeen отличается от QR-оплаты с комиссией 3%.

const NEARBY_LIMIT = 4;

export function NearbyAndPay({
  locale,
  data,
}: {
  locale: string;
  data: HomeStations;
}) {
  const t = useTranslations("b2c");
  const { visible, stations, state, expanded, expand } = data;
  const rows = (visible.length > 0 ? visible : []).slice(0, NEARBY_LIMIT);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="rounded-card border border-paper-300 bg-white p-5 dark:border-navy-700 dark:bg-navy-900 sm:p-6">
        <p className="text-caption font-semibold uppercase tracking-[0.2em] text-gold-600 dark:text-gold-300">
          {t("console.stepNearby")}
        </p>
        <div className="mt-2.5 flex items-baseline justify-between gap-3">
          <h2 className="font-editorial text-[24px] font-semibold leading-[1.1] tracking-[-0.01em] text-navy dark:text-white sm:text-[28px]">
            {t("console.nearbyTitle")}
          </h2>
          {!expanded && stations.length > visible.length ? (
            <button
              type="button"
              onClick={expand}
              className="inline-flex items-center gap-1 text-caption font-semibold text-primary-800 hover:gap-1.5 dark:text-sky-300"
            >
              {t("console.nearbyAll")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <Link
              href={`/${locale}/stations`}
              className="inline-flex items-center gap-1 text-caption font-semibold text-primary-800 hover:gap-1.5 dark:text-sky-300"
            >
              {t("console.nearbyAll")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>

        {state === "loading" && (
          <ul className="mt-4 space-y-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-12 animate-pulse rounded-control bg-gray-100 dark:bg-navy-800"
              />
            ))}
          </ul>
        )}

        {state !== "loading" && rows.length === 0 && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            {t("console.nearbyEmpty")}
          </p>
        )}

        {rows.length > 0 && (
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-navy-700">
            {rows.map((s) => {
              const main = s.stocks[0];
              const fill = main ? fillPercent(main) : null;
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy dark:text-white">
                      {s.name}
                    </p>
                    <p className="truncate text-caption text-gray-500 dark:text-gray-400">
                      {s.address}
                      <span className="mx-1.5 text-gray-300 dark:text-gray-600">
                        ·
                      </span>
                      {t("console.km", { n: s.distanceKm.toFixed(1) })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {fill !== null && (
                      <span className="text-right">
                        <span className="block text-sm font-semibold tabular-nums text-navy dark:text-white">
                          {fill}%
                        </span>
                        <span className="block text-caption font-normal text-gray-500 dark:text-gray-400">
                          {t("console.inTank")}
                        </span>
                      </span>
                    )}
                    <span className="text-right text-base font-bold tabular-nums text-navy dark:text-white">
                      {main?.priceUzs
                        ? formatMoney(main.priceUzs, locale)
                        : "—"}
                      <span className="block text-caption font-normal text-gray-500 dark:text-gray-400">
                        {t("console.perLiter")}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-card bg-navy p-5 text-white dark:bg-navy-800 sm:p-6">
        <p className="text-caption font-semibold uppercase tracking-[0.2em] text-gold-300">
          {t("console.payEyebrow")}
        </p>
        <h2 className="mt-2.5 font-editorial text-[24px] font-semibold leading-[1.1] tracking-[-0.01em] text-white sm:text-[28px]">
          {t("console.payTitle")}
        </h2>
        <ul className="mt-4 space-y-3">
          {[
            { icon: Smartphone, key: "payStep1" as const },
            { icon: Wallet, key: "payStep2" as const },
            { icon: ShieldCheck, key: "payStep3" as const },
          ].map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-white/10 text-sky-300">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-sm leading-relaxed text-gray-200">
                {t(`console.${key}`)}
              </span>
            </li>
          ))}
        </ul>
        {/* Отдельно говорим, что сценарий у колонки живёт в приложении: в вебе
            заливка на АЗС выключена, и лучше сказать это до клика. */}
        <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-sky-200">
          {t("console.payNote")}
        </p>
      </section>
    </div>
  );
}
