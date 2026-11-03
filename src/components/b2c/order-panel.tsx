"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { asGasoline, calcOrderPrice, type FuelType } from "@/lib/pricing";
import { B2C_MIN_ORDER_LITERS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { track } from "@/lib/analytics";
import { spring } from "@/lib/motion";
import { Ticker } from "@/components/motion/ticker";
import { Magnetic } from "@/components/motion/magnetic";

// Левая карточка первого экрана — главное действие: доставить топливо к машине.
// Цена считается по тем же ценам из таблицы Price, что и в полном флоу заказа,
// поэтому сумма на главной не расходится с суммой на шаге оплаты.

const FUELS: FuelType[] = ["AI_92", "AI_95", "AI_100"];
const FUEL_LABEL: Record<FuelType, string> = {
  AI_92: "АИ-92",
  AI_95: "АИ-95",
  AI_100: "АИ-100",
};
const MAX_LITERS = 100;

export function OrderPanel({
  locale,
  located = false,
}: {
  locale: string;
  /** Адрес известен по геолокации — на карте рядом рисуется маршрут. */
  located?: boolean;
}) {
  const t = useTranslations("b2c");
  const router = useRouter();
  const [fuel, setFuel] = useState<FuelType>("AI_92");
  const [liters, setLiters] = useState(40);
  const [prices, setPrices] = useState<Partial<Record<FuelType, number>>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prices")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("request failed")),
      )
      .then((rows: { fuelType: string; priceUzs: number }[]) => {
        if (cancelled) return;
        const next: Partial<Record<FuelType, number>> = {};
        for (const row of rows) {
          const f = asGasoline(row.fuelType);
          if (f) next[f] = row.priceUzs;
        }
        setPrices(next);
      })
      // Без цен карточка всё равно работает: сумма скрывается, заказ доступен.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const pricePerLiter = prices[fuel];
  const total = useMemo(
    () =>
      pricePerLiter
        ? calcOrderPrice({ pricePerLiter, volume: liters }).total
        : null,
    [pricePerLiter, liters],
  );

  const startOrder = (where: string) => {
    track("gasoline_order_clicked", { where });
    router.push(`/${locale}/benzin?fuel=${fuel}&volume=${liters}`);
  };

  const formatTotal = useCallback(
    (n: number) => t("console.money", { n: formatMoney(n, locale) }),
    [t, locale],
  );

  const fillRatio =
    (liters - B2C_MIN_ORDER_LITERS) / (MAX_LITERS - B2C_MIN_ORDER_LITERS);

  return (
    <section className="flex flex-col rounded-[28px] bg-white p-6 dark:bg-navy-800 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="font-sans text-[26px] font-semibold leading-tight tracking-[-0.025em] text-navy dark:text-white sm:text-[30px]">
          {t("console.orderTitle")}
        </h2>
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-success-600 dark:text-success-500">
          <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden />
          {t("console.couriersOnline")}
        </p>
      </div>

      <div className="mt-7 flex-1 space-y-6">
        <div>
          <label
            className="text-[13px] font-medium text-gray-600 dark:text-gray-400"
            htmlFor="order-address"
          >
            {t("console.addressLabel")}
          </label>
          <button
            id="order-address"
            type="button"
            onClick={() => startOrder("console_address")}
            className={`mt-2 flex h-14 w-full items-center gap-3 rounded-2xl px-4 text-left text-[17px] ring-inset transition-[color,box-shadow,transform] duration-150 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 active:scale-[0.99] motion-reduce:active:scale-100 dark:hover:text-white ${
              located
                ? "bg-mist-50 text-navy ring-2 ring-primary-500 dark:bg-white/[0.06] dark:text-white dark:ring-primary-400"
                : "bg-mist-50 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400"
            }`}
          >
            <MapPin
              className="h-5 w-5 shrink-0 text-primary-700 dark:text-primary-300"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="truncate">
              {located ? t("console.addressHere") : t("widgetWhere")}
            </span>
          </button>
        </div>

        <div>
          <p className="text-[13px] font-medium text-gray-600 dark:text-gray-400">
            {t("console.fuelLabel")}
          </p>
          {/* Сегмент-контрол: «бегунок» перетекает к новому выбору. */}
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-mist-100 p-1 dark:bg-white/[0.06]">
            {FUELS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFuel(f)}
                aria-pressed={fuel === f}
                className={`relative h-10 rounded-full text-[15px] font-medium transition-[color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 active:scale-[0.97] motion-reduce:active:scale-100 ${
                  fuel === f
                    ? "text-navy dark:text-white"
                    : "text-gray-600 hover:text-navy dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {fuel === f && (
                  <motion.span
                    layoutId="order-fuel-chip"
                    className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(7,24,21,0.14),0_1px_1px_rgba(7,24,21,0.06)] dark:bg-white/[0.16] dark:shadow-none"
                    transition={spring.chip}
                    aria-hidden
                  />
                )}
                <span className="relative">{FUEL_LABEL[f]}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label
              className="text-[13px] font-medium text-gray-600 dark:text-gray-400"
              htmlFor="order-liters"
            >
              {t("console.volumeLabel")}
            </label>
            <output
              htmlFor="order-liters"
              className="text-[17px] font-semibold tabular-nums text-navy dark:text-white"
            >
              {t("console.liters", { n: liters })}
            </output>
          </div>
          <input
            id="order-liters"
            type="range"
            min={B2C_MIN_ORDER_LITERS}
            max={MAX_LITERS}
            step={5}
            value={liters}
            onChange={(e) => setLiters(Number(e.target.value))}
            className="benzeen-range mt-3 w-full"
            style={{
              ["--range-fill" as string]: `${Math.round(fillRatio * 100)}%`,
            }}
          />
          <div className="mt-1 flex justify-between text-[12px] text-gray-500 dark:text-gray-400">
            <span>{t("console.liters", { n: B2C_MIN_ORDER_LITERS })}</span>
            <span>{t("console.liters", { n: MAX_LITERS })}</span>
          </div>
        </div>

        <dl className="space-y-2 pt-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[15px] text-gray-600 dark:text-gray-400">
              {t("console.costLabel")}
            </dt>
            <dd className="text-[30px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-navy dark:text-white">
              {total === null ? (
                "—"
              ) : (
                <Ticker value={total} format={formatTotal} />
              )}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[15px] text-gray-600 dark:text-gray-400">
              {t("console.etaLabel")}
            </dt>
            <dd className="text-[15px] font-medium text-navy dark:text-white">
              {t("console.etaValue")}
            </dd>
          </div>
        </dl>
      </div>

      <Magnetic className="mt-7">
        <Button
          size="lg"
          className="h-14 w-full rounded-full text-[17px] font-medium"
          onClick={() => startOrder("console_cta")}
        >
          {t("console.cta")}
        </Button>
      </Magnetic>
      <p className="mt-4 text-center text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
        {t("console.orderNote")}
      </p>
    </section>
  );
}
