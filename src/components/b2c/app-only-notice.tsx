"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Bluetooth, Smartphone, Wallet } from "lucide-react";

// Заправка на стационарной АЗС из браузера недоступна по решению владельца:
// сценарий у колонки живёт только в мобильном приложении. Причина техническая, а
// не оформительская — браузер не умеет фоново слышать BLE-маячок колонки, держать
// пуш «вы у колонки №X» и работать при заблокированном экране, а без этого
// автоматическое определение колонки превращается в ручной ввод номера.
//
// Веб при этом остаётся полезным: заказ доставки, карта АЗС с остатками с
// датчиков и история заправок с чеками — всё это работает здесь.

export function StationFuelingAppOnly({ locale }: { locale: string }) {
  const t = useTranslations("fueling.appOnly");

  const points = [
    { icon: Bluetooth, key: "pointBle" as const },
    { icon: Wallet, key: "pointPay" as const },
    { icon: Smartphone, key: "pointPush" as const },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <p className="text-caption font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-sky-300">
        {t("eyebrow")}
      </p>
      <h1 className="mt-4 max-w-3xl font-editorial text-[36px] font-semibold leading-[1.05] tracking-[-0.01em] text-navy dark:text-white sm:text-[46px]">
        {t("title")}
        <br />
        <span className="text-primary-700 dark:text-sky-300">
          {t("titleAccent")}
        </span>
      </h1>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <section className="rounded-card border border-gray-200 bg-white p-6 dark:border-navy-700 dark:bg-navy-900">
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {t("lede")}
          </p>
          <ul className="mt-6 space-y-4">
            {points.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-sky-100 text-primary-700 dark:bg-white/10 dark:text-sky-300">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {t(key)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-control bg-canvas px-4 py-3 text-xs leading-relaxed text-gray-600 dark:bg-navy-800 dark:text-gray-400">
            {t("soon")}
          </p>
        </section>

        <section className="rounded-card bg-navy p-6 text-white dark:bg-navy-800">
          <p className="text-caption font-semibold uppercase tracking-[0.18em] text-sky-300">
            {t("webEyebrow")}
          </p>
          <h2 className="mt-2 text-heading text-white">{t("webTitle")}</h2>
          <div className="mt-6 space-y-2.5">
            <Link
              href={`/${locale}`}
              className="flex items-center justify-between gap-3 rounded-control bg-white/10 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/15"
            >
              {t("webOrder")}
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
            <Link
              href={`/${locale}/stations`}
              className="flex items-center justify-between gap-3 rounded-control bg-white/10 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/15"
            >
              {t("webStations")}
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
            <Link
              href={`/${locale}/fueling/history`}
              className="flex items-center justify-between gap-3 rounded-control bg-white/10 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/15"
            >
              {t("webHistory")}
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
