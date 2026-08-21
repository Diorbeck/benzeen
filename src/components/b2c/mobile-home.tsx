"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Car, ChevronRight, Fuel, Truck } from "lucide-react";
import { BenzeenLogo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { B2CThemeToggle } from "./theme-toggle";
import { HomeStationsMap } from "./home-stations-map";
import { useHomeStations } from "./use-home-stations";
import { Tabbar, TABBAR_SPACE } from "./tabbar";
import { formatMoney } from "@/lib/format";

// Главный экран мобильного приложения: две плитки действий (заправка на АЗС —
// главная, доставка — вторичная), карта с точками АЗС крупным блоком и, для
// вошедшего клиента, его машина и последний заказ. Таббар внизу.

export type HomeClient = {
  name: string;
  car: { brand: string | null; model: string | null; plate: string } | null;
  lastOrder: {
    id: string;
    status: string;
    fuelType: string;
    totalAmount: number | null;
    createdAt: string;
  } | null;
};

const ORDER_STEPS = new Set([
  "RECEIVED",
  "COURIER_ASSIGNED",
  "IN_DELIVERY",
  "DELIVERED",
]);

export function MobileHome({
  locale,
  client,
}: {
  locale: string;
  client: HomeClient | null;
}) {
  const t = useTranslations("homeApp");
  const tb2c = useTranslations("b2c");
  const tStatus = useTranslations("orderStatus");
  const data = useHomeStations();

  return (
    <div
      className={`min-h-[100dvh] bg-canvas text-navy dark:bg-navy-950 dark:text-white ${TABBAR_SPACE}`}
    >
      <header className="sticky top-0 z-30 border-b border-paper-300 bg-canvas/95 backdrop-blur dark:border-navy-700 dark:bg-navy-950/95">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between gap-2 px-4 pt-[env(safe-area-inset-top)]">
          <Link href={`/${locale}`} className="flex min-w-0 items-center gap-2">
            <BenzeenLogo size="sm" />
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <LanguageSwitcher />
            <B2CThemeToggle hideSystemOnMobile />
            {client ? (
              <Link
                href={`/${locale}/account`}
                aria-label={tb2c("account")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 font-display text-sm font-bold text-primary-950 transition-transform active:scale-95"
              >
                {(client.name || "•").slice(0, 1).toUpperCase()}
              </Link>
            ) : (
              <Link
                href={`/${locale}/client-login?callbackUrl=/${locale}`}
                className="flex h-10 items-center rounded-control bg-gray-100 px-3.5 text-sm font-semibold text-navy transition-colors active:scale-95 dark:bg-white/10 dark:text-white"
              >
                {tb2c("signIn")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pb-6">
        {/* Плитки действий: заправка — главное, доставка — вторичное. */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            href={`/${locale}/stations`}
            className="flex min-h-[8.5rem] flex-col justify-between rounded-card bg-primary-500 p-4 text-primary-950 transition-transform hover:bg-primary-600 active:scale-[0.98]"
          >
            <Fuel className="h-7 w-7" aria-hidden />
            <span>
              <span className="block font-display text-[17px] font-bold leading-snug">
                {t("fuelAtStation")}
              </span>
              <span className="mt-1 block text-xs font-medium opacity-80">
                {t("fuelAtStationDesc")}
              </span>
            </span>
          </Link>
          <Link
            href={`/${locale}/benzin`}
            className="flex min-h-[8.5rem] flex-col justify-between rounded-card border border-gray-200 bg-white p-4 transition-transform hover:border-primary-500/60 active:scale-[0.98] dark:border-white/10 dark:bg-navy-900"
          >
            <Truck className="h-7 w-7 text-primary-800 dark:text-primary-500" aria-hidden />
            <span>
              <span className="block font-display text-[17px] font-bold leading-snug">
                {t("delivery")}
              </span>
              <span className="mt-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("deliveryDesc")}
              </span>
            </span>
          </Link>
        </div>

        {/* Вошедший клиент: его машина и последний заказ. */}
        {client?.car && (
          <Link
            href={`/${locale}/account?tab=cars`}
            className="mt-3 flex items-center gap-3 rounded-card border border-gray-200 bg-white p-4 transition-transform active:scale-[0.99] dark:border-white/10 dark:bg-navy-900"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-gray-100 dark:bg-white/10">
              <Car className="h-5 w-5 text-primary-800 dark:text-primary-500" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("myCar")}
              </span>
              <span className="block truncate text-sm font-semibold">
                {[client.car.brand, client.car.model].filter(Boolean).join(" ")}
              </span>
            </span>
            <span className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs font-bold uppercase tabular-nums tracking-wider dark:border-white/15">
              {client.car.plate}
            </span>
          </Link>
        )}

        {client?.lastOrder && (
          <Link
            href={`/${locale}/account/orders/${client.lastOrder.id}`}
            className="mt-3 flex items-center gap-3 rounded-card border border-gray-200 bg-white p-4 transition-transform active:scale-[0.99] dark:border-white/10 dark:bg-navy-900"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("lastOrder")} ·{" "}
                {new Date(client.lastOrder.createdAt).toLocaleDateString(locale)}
              </span>
              <span className="mt-0.5 block truncate text-sm font-semibold">
                {client.lastOrder.status === "CANCELLED"
                  ? tStatus("cancelled")
                  : ORDER_STEPS.has(client.lastOrder.status)
                    ? tStatus(`steps.${client.lastOrder.status}`)
                    : client.lastOrder.status}
              </span>
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {formatMoney(client.lastOrder.totalAmount ?? 0, locale)}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          </Link>
        )}

        {/* Карта с точками АЗС: крупный блок, тап по точке — карточка с остатками. */}
        <div className="mt-4">
          <HomeStationsMap locale={locale} data={data} />
        </div>
      </main>

      <Tabbar locale={locale} />
    </div>
  );
}
