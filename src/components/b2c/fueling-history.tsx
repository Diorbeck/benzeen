"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Receipt } from "lucide-react";
import { formatMoney } from "@/lib/format";

// История заправок и чек по каждой — Модуль 2 ТЗ v2. Чек нужен в приложении даже
// после интеграции с Солик: клиент смотрит его здесь, а не в кассовой системе.

type Item = {
  id: string;
  fuelType: string;
  litersDispensed: number | null;
  amountUzs: number | null;
  refundUzs: number | null;
  cashbackUzs: number | null;
  soliqSyncedAt: string | null;
  priceUzs: number;
  status: string;
  startedAt: string;
  station: { name: string; address: string } | null;
  dispenser: { number: number } | null;
};

export function FuelingHistory() {
  const t = useTranslations("fueling");
  const tf = useTranslations("stations.fuel");
  const pathname = usePathname() ?? "";
  const seg = pathname.split("/").filter(Boolean)[0];
  const locale = seg === "ru" || seg === "en" || seg === "uz" ? seg : "ru";

  const [items, setItems] = useState<Item[] | null>(null);
  const [needAuth, setNeedAuth] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/fueling/history")
      .then(async (r) => {
        if (r.status === 401) {
          if (alive) setNeedAuth(true);
          return null;
        }
        return (await r.json()) as { sessions: Item[] };
      })
      .then((d) => alive && d && setItems(d.sessions))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  if (needAuth) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("needAuth")}
        </p>
        <a
          href={`/${locale}/client-login`}
          className="mt-4 inline-flex h-11 items-center rounded-control bg-primary-500 px-5 text-sm font-semibold text-primary-950"
        >
          {t("login")}
        </a>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-10 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
        {t("stationLoading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <p className="text-caption font-semibold uppercase tracking-[0.2em] text-primary-800 dark:text-sky-300">
        {t("historyEyebrow")}
      </p>
      <h1 className="mt-3 font-editorial text-[32px] font-semibold leading-[1.05] tracking-[-0.01em] text-navy dark:text-white sm:text-[38px]">
        {t("historyTitle")}
      </h1>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-gray-600 dark:text-gray-300">
          {t("historyEmpty")}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((s) => (
            <li
              key={s.id}
              className="rounded-card border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-navy-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-subheading text-navy dark:text-white">
                    {s.station?.name ?? "—"}
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {tf(s.fuelType)}
                    {s.dispenser
                      ? ` · ${t("dispenser", { n: s.dispenser.number })}`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(s.startedAt).toLocaleString(locale)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-semibold tabular-nums text-navy dark:text-white">
                    {formatMoney(s.amountUzs ?? 0, locale)}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {(s.litersDispensed ?? 0).toFixed(2)}{" "}
                    {t("litersLabel").toLowerCase()}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-0.5 font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                  <Receipt className="h-3 w-3" aria-hidden /> {t("receipt")}
                </span>
                {s.soliqSyncedAt && (
                  <span className="rounded-md bg-sky-100 px-2.5 py-0.5 font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                    {t("soliqSent")}
                  </span>
                )}
                {(s.cashbackUzs ?? 0) > 0 && (
                  <span className="rounded-md bg-success-500/10 px-2.5 py-0.5 font-medium text-success-600">
                    {t("cashback")} · {formatMoney(s.cashbackUzs ?? 0, locale)}
                  </span>
                )}
                {s.status === "MANUAL_REVIEW" && (
                  <span className="rounded-md bg-warning-500/10 px-2.5 py-0.5 font-medium text-warning-600">
                    {t("manualReviewShort")}
                  </span>
                )}
                {s.status === "CANCELLED" && (
                  <span className="rounded-md bg-gray-100 px-2.5 py-0.5 font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
                    {t("cancelled")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <a
        href={`/${locale}/stations`}
        className="mt-6 inline-flex text-sm font-medium text-primary-800 hover:underline dark:text-primary-500"
      >
        {t("back")}
      </a>
    </div>
  );
}
