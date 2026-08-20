"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/format";

// Живой экран заправки — Модуль 2 ТЗ v2: литры и сумма должны совпадать с экраном
// колонки. Данные идут потоком SSE, поэтому цифра меняется сама, без обновления
// страницы и без кнопки «проверить».

type LiveState = {
  id: string;
  status:
    | "RESERVED"
    | "FLOWING"
    | "COMPLETED"
    | "SETTLED"
    | "CANCELLED"
    | "MANUAL_REVIEW"
    | "FAILED";
  fuelType: string;
  priceUzs: number;
  holdAmountUzs: number;
  limitLiters: number | null;
  litersDispensed: number | null;
  amountUzs: number | null;
  refundUzs: number | null;
  cashbackUzs: number | null;
  dispenser: { number: number } | null;
  station: { name: string } | null;
};

export function FuelingLive({ sessionId }: { sessionId: string }) {
  const t = useTranslations("fueling");
  const tf = useTranslations("stations.fuel");
  const pathname = usePathname() ?? "";
  const seg = pathname.split("/").filter(Boolean)[0];
  const locale = seg === "ru" || seg === "en" || seg === "uz" ? seg : "ru";

  const [state, setState] = useState<LiveState | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/fueling/sessions/${sessionId}/stream`);
    esRef.current = es;
    es.addEventListener("state", (e) => {
      setState(JSON.parse((e as MessageEvent<string>).data) as LiveState);
    });
    es.addEventListener("done", () => es.close());
    // Браузер сам переподключается при обрыве, поэтому здесь ничего не делаем:
    // на мобильном интернете обрыв — норма, а не ошибка.
    return () => es.close();
  }, [sessionId]);

  async function cancel() {
    setCancelling(true);
    try {
      await fetch(`/api/fueling/sessions/${sessionId}/cancel`, {
        method: "POST",
      });
    } finally {
      setCancelling(false);
    }
  }

  if (!state) {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-10 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
        {t("stationLoading")}
      </div>
    );
  }

  const liters = state.litersDispensed ?? 0;
  const amount = state.amountUzs ?? 0;
  const finished = state.status === "SETTLED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {state.station?.name ?? t("title")}
        {state.dispenser
          ? ` · ${t("dispenser", { n: state.dispenser.number })}`
          : ""}
      </p>
      <h1 className="mt-1 text-heading text-navy dark:text-white">
        {finished
          ? t("settled")
          : state.status === "FLOWING"
            ? t("flowing")
            : state.status === "CANCELLED"
              ? t("cancelled")
              : state.status === "MANUAL_REVIEW"
                ? t("manualReview")
                : t("reserved")}
      </h1>
      {state.status === "RESERVED" && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {t("reservedHint")}
        </p>
      )}

      <div className="mt-6 rounded-card border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-navy-900">
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {tf(state.fuelType)} · {formatMoney(state.priceUzs, locale)}
        </p>
        <p className="mt-3 text-5xl font-semibold tabular-nums text-navy dark:text-white">
          {liters.toFixed(2)}
          <span className="ml-2 text-lg font-medium text-gray-500 dark:text-gray-400">
            {t("litersLabel").toLowerCase()}
          </span>
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-primary-600 dark:text-primary-500">
          {formatMoney(amount, locale)}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-control bg-gray-50 px-3 py-2 dark:bg-white/5">
            <dt className="text-xs text-gray-500 dark:text-gray-400">
              {t("holdLabel")}
            </dt>
            <dd className="mt-0.5 font-medium tabular-nums text-navy dark:text-white">
              {formatMoney(state.holdAmountUzs, locale)}
            </dd>
          </div>
          {state.limitLiters !== null && (
            <div className="rounded-control bg-gray-50 px-3 py-2 dark:bg-white/5">
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                {t("limitLabel")}
              </dt>
              <dd className="mt-0.5 font-medium tabular-nums text-navy dark:text-white">
                {state.limitLiters.toFixed(1)}
              </dd>
            </div>
          )}
          {finished && (state.refundUzs ?? 0) > 0 && (
            <div className="rounded-control bg-gray-50 px-3 py-2 dark:bg-white/5">
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                {t("refund")}
              </dt>
              <dd className="mt-0.5 font-medium tabular-nums text-navy dark:text-white">
                {formatMoney(state.refundUzs ?? 0, locale)}
              </dd>
            </div>
          )}
          {finished && (state.cashbackUzs ?? 0) > 0 && (
            <div className="rounded-control bg-success-500/10 px-3 py-2">
              <dt className="text-xs text-success-600">{t("cashback")}</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-success-600">
                {formatMoney(state.cashbackUzs ?? 0, locale)}
              </dd>
            </div>
          )}
        </dl>

        {state.limitLiters !== null && !finished && (
          <div
            className="mt-5 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
            role="presentation"
          >
            <div
              className="h-full rounded-full bg-primary-500 transition-[width] duration-500 dark:bg-primary-500"
              style={{
                width: `${Math.min(100, Math.round((liters / Math.max(0.1, state.limitLiters)) * 100))}%`,
              }}
            />
          </div>
        )}
      </div>

      {state.status === "RESERVED" && liters === 0 && (
        <button
          type="button"
          onClick={cancel}
          disabled={cancelling}
          className="mt-4 h-11 w-full rounded-control bg-gray-100 text-sm font-medium text-navy transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
        >
          {cancelling ? t("cancelling") : t("cancel")}
        </button>
      )}

      <div className="mt-6 flex gap-4 text-sm font-medium">
        <a
          href={`/${locale}/fueling/history`}
          className="text-primary-600 hover:underline dark:text-primary-500"
        >
          {t("history")}
        </a>
        <a
          href={`/${locale}/stations`}
          className="text-gray-500 hover:underline dark:text-gray-400"
        >
          {t("back")}
        </a>
      </div>
    </div>
  );
}
