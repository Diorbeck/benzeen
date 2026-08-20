"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { FLOW_IDLE_TIMEOUT_MS } from "@/lib/fueling";
import { FlowShell } from "./flow-shell";

// Живой экран заправки — Модуль 2 ТЗ v2: литры и сумма должны совпадать с экраном
// колонки. Данные идут потоком SSE, поэтому цифра меняется сама, без обновления
// страницы и без кнопки «проверить». На терминальном статусе экран превращается
// в итог: литры, сумма, возврат и кешбэк.

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
  lastTickAt: string | null;
  dispenser: { number: number } | null;
  station: { name: string } | null;
};

const ACTIVE_STATUSES = new Set(["RESERVED", "FLOWING"]);

export function FuelingLive({ sessionId }: { sessionId: string }) {
  const t = useTranslations("fueling");
  const tf = useTranslations("stations.fuel");
  const pathname = usePathname() ?? "";
  const seg = pathname.split("/").filter(Boolean)[0];
  const locale = seg === "ru" || seg === "en" || seg === "uz" ? seg : "ru";
  const router = useRouter();

  const [state, setState] = useState<LiveState | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Точка отсчёта «ожидания колонки», пока не пришло ни одного тика.
  const openedAtRef = useRef(Date.now());

  useEffect(() => {
    const es = new EventSource(`/api/fueling/sessions/${sessionId}/stream`);
    es.addEventListener("state", (e) => {
      setState(JSON.parse((e as MessageEvent<string>).data) as LiveState);
    });
    es.addEventListener("done", () => es.close());
    // Браузер сам переподключается при обрыве, поэтому здесь ничего не делаем:
    // на мобильном интернете обрыв — норма, а не ошибка.
    return () => es.close();
  }, [sessionId]);

  // Таймер «ожидания колонки»: без тиков дольше минуты цифры не растут, и
  // клиенту важно видеть, что дело в колонке, а не в зависшем экране.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);

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
      <FlowShell
        title={t("liveTitle")}
        onBack={() => router.push(`/${locale}/stations`)}
        backAria={t("backAria")}
      >
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t("stationLoading")}
        </p>
      </FlowShell>
    );
  }

  const liters = state.litersDispensed ?? 0;
  const amount = state.amountUzs ?? 0;
  const active = ACTIVE_STATUSES.has(state.status);

  const lastSignalMs = state.lastTickAt
    ? Date.parse(state.lastTickAt)
    : openedAtRef.current;
  const waiting = active && now - lastSignalMs > FLOW_IDLE_TIMEOUT_MS;

  // Итоговый экран: заправка закончилась (успехом, отменой или сверкой).
  if (!active) {
    const settled = state.status === "SETTLED";
    return (
      <FlowShell
        title={
          settled
            ? t("settled")
            : state.status === "MANUAL_REVIEW"
              ? t("manualReviewShort")
              : t("cancelled")
        }
        subtitle={state.station?.name ?? undefined}
        onBack={() => router.push(`/${locale}`)}
        backAria={t("backAria")}
        action={
          <button
            type="button"
            onClick={() => router.push(`/${locale}`)}
            className="flex h-14 w-full items-center justify-center rounded-control bg-primary-500 text-base font-semibold text-primary-950 transition-colors hover:bg-primary-600 active:bg-primary-700"
          >
            {t("toHome")}
          </button>
        }
      >
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {settled && (
            <CheckCircle2
              className="h-14 w-14 text-primary-700 dark:text-primary-500"
              aria-hidden
            />
          )}
          <p className="mt-4 font-display text-5xl font-bold tabular-nums">
            {liters.toFixed(2)}
            <span className="ml-2 text-xl font-medium text-gray-500 dark:text-gray-400">
              {t("litersShort")}
            </span>
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-primary-800 dark:text-primary-500">
            {formatMoney(amount, locale)}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tf(state.fuelType)}
            {state.dispenser
              ? ` · ${t("dispenser", { n: state.dispenser.number })}`
              : ""}
          </p>

          {state.status === "MANUAL_REVIEW" && (
            <p className="mt-4 rounded-card bg-warning-500/10 px-4 py-3 text-sm text-warning-600">
              {t("manualReview")}
            </p>
          )}

          <dl className="mt-6 w-full max-w-xs space-y-2.5 text-sm">
            {(state.refundUzs ?? 0) > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">
                  {t("refund")}
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatMoney(state.refundUzs ?? 0, locale)}
                </dd>
              </div>
            )}
            {(state.cashbackUzs ?? 0) > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-success-600">{t("cashback")}</dt>
                <dd className="font-semibold tabular-nums text-success-600">
                  {formatMoney(state.cashbackUzs ?? 0, locale)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </FlowShell>
    );
  }

  // Прогресс к заказанному объёму: длина дуги кольца.
  const progress =
    state.limitLiters && state.limitLiters > 0
      ? Math.min(1, liters / state.limitLiters)
      : 0;
  const R = 112;
  const C = 2 * Math.PI * R;

  return (
    <FlowShell
      title={t("liveTitle")}
      subtitle={
        (state.station?.name ?? "") +
        (state.dispenser
          ? ` · ${t("dispenser", { n: state.dispenser.number })}`
          : "")
      }
      onBack={() => router.push(`/${locale}/stations`)}
      backAria={t("backAria")}
      action={
        <button
          type="button"
          onClick={cancel}
          disabled={cancelling}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-control bg-gray-100 text-base font-semibold text-navy transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
        >
          {cancelling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {cancelling ? t("stopping") : t("stop")}
        </button>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative h-64 w-64">
          <svg viewBox="0 0 256 256" className="h-full w-full -rotate-90">
            <circle
              cx="128"
              cy="128"
              r={R}
              fill="none"
              strokeWidth="10"
              className="stroke-gray-200 dark:stroke-white/10"
            />
            <circle
              cx="128"
              cy="128"
              r={R}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              className="stroke-primary-500 transition-[stroke-dashoffset] duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="font-display text-5xl font-bold tabular-nums">
              {liters.toFixed(2)}
            </p>
            {state.limitLiters !== null && (
              <p className="mt-1 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                {t("ofOrdered", { n: state.limitLiters.toFixed(1) })}
              </p>
            )}
            <p className="mt-2 text-xl font-semibold tabular-nums text-primary-800 dark:text-primary-500">
              {formatMoney(amount, locale)}
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-sm font-medium">
          {waiting ? (
            <span className="text-warning-600">{t("waitingDispenser")}</span>
          ) : state.status === "FLOWING" ? (
            <span className="text-primary-800 dark:text-primary-500">
              {t("flowing")}
            </span>
          ) : (
            <span className="text-gray-600 dark:text-gray-300">
              {t("reservedHint")}
            </span>
          )}
        </p>

        <p className="mt-2 text-center text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {tf(state.fuelType)} · {formatMoney(state.priceUzs, locale)} ·{" "}
          {t("holdLabel")} {formatMoney(state.holdAmountUzs, locale)}
        </p>
      </div>
    </FlowShell>
  );
}
