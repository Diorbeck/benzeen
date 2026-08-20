"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CreditCard, Loader2, Minus, Plus } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { FULL_TANK_LITERS_CAP, MIN_HOLD_UZS } from "@/lib/fueling";
import { FlowShell } from "./flow-shell";
import { BleDispenserDetect } from "./ble-dispenser-detect";

// Пошаговый мобильный сценарий заправки — Модуль 3, уровень 1 ТЗ v2: один шаг —
// один экран (колонка → топливо → объём), подтверждение — шторкой поверх.
// Клиент выбирает колонку вручную; BLE-блок остаётся надстройкой там, где
// браузер умеет сканировать, и ничего не блокирует там, где не умеет.

type Stock = {
  fuelType: string;
  litersAvailable: number;
  capacityL: number;
  dataFresh: boolean;
  priceUzs: number | null;
};

type Dispenser = {
  id: string;
  number: number;
  status: "ACTIVE" | "DISABLED";
  fuelTypes: string[];
  identificationMode: "MANUAL" | "BLE" | "CAMERA";
  online: boolean;
  busy: boolean;
};

type Station = {
  id: string;
  name: string;
  brand: string | null;
  address: string;
  status: string;
  online: boolean;
  stocks: Stock[];
  dispensers: Dispenser[];
};

type Step = "dispenser" | "fuel" | "amount";
type Mode = "amount" | "full";

/** Шаг кнопок «+/−» по сумме, сум. */
const AMOUNT_STEP_UZS = 10_000;
const DEFAULT_AMOUNT_UZS = 100_000;
const MAX_AMOUNT_UZS = 2_000_000;

export function FuelingStart() {
  const t = useTranslations("fueling");
  const tf = useTranslations("stations.fuel");
  const pathname = usePathname() ?? "";
  const seg = pathname.split("/").filter(Boolean)[0];
  const locale = seg === "ru" || seg === "en" || seg === "uz" ? seg : "ru";
  const router = useRouter();
  const stationId = useSearchParams()?.get("station") ?? "";

  const [station, setStation] = useState<Station | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState<Step>("dispenser");
  const [dispenserNumber, setDispenserNumber] = useState<number | null>(null);
  const [fuelType, setFuelType] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("amount");
  const [amountUzs, setAmountUzs] = useState(DEFAULT_AMOUNT_UZS);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Способ определения колонки уходит в заправку: по нему видно, работает ли BLE
  // на объекте, и АЗС платит за идентификацию не вслепую.
  const [identifiedBy, setIdentifiedBy] = useState<"MANUAL" | "BLE">("MANUAL");

  useEffect(() => {
    if (!stationId) {
      setLoadError(true);
      return;
    }
    let alive = true;
    fetch(`/api/stations/${stationId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((d: { station: Station }) => {
        if (alive) setStation(d.station);
      })
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, [stationId]);

  const dispenser = useMemo(
    () => station?.dispensers.find((d) => d.number === dispenserNumber) ?? null,
    [station, dispenserNumber],
  );

  // Топливо шага «Топливо»: есть на выбранной колонке И в наличии на АЗС.
  const fuels = useMemo(() => {
    if (!station || !dispenser) return [];
    return station.stocks.filter(
      (s) =>
        dispenser.fuelTypes.includes(s.fuelType) &&
        s.priceUzs !== null &&
        s.litersAvailable > 0,
    );
  }, [station, dispenser]);

  const stock = useMemo(
    () => station?.stocks.find((s) => s.fuelType === fuelType) ?? null,
    [station, fuelType],
  );
  const price = stock?.priceUzs ?? null;

  // Оценка полного бака — как planHold на сервере: колпак 80 л или остаток.
  const fullLiters = useMemo(() => {
    if (!stock) return FULL_TANK_LITERS_CAP;
    return Math.min(
      FULL_TANK_LITERS_CAP,
      stock.litersAvailable > 0 ? stock.litersAvailable : FULL_TANK_LITERS_CAP,
    );
  }, [stock]);

  const liters = price ? amountUzs / price : 0;
  const holdUzs =
    mode === "full" && price ? Math.round(price * fullLiters) : amountUzs;
  const cashbackUzs = Math.round(holdUzs * 0.01);
  const fillFraction =
    mode === "full" ? 1 : Math.min(1, liters / FULL_TANK_LITERS_CAP);

  const maxAmount = price
    ? Math.min(MAX_AMOUNT_UZS, Math.round(price * FULL_TANK_LITERS_CAP))
    : MAX_AMOUNT_UZS;

  const stepValid =
    step === "dispenser"
      ? dispenser !== null && dispenser.status === "ACTIVE" && !dispenser.busy
      : step === "fuel"
        ? fuelType !== null && fuels.some((f) => f.fuelType === fuelType)
        : mode === "full" || (amountUzs >= MIN_HOLD_UZS && price !== null);

  function back() {
    if (confirmOpen) {
      setConfirmOpen(false);
      return;
    }
    if (step === "fuel") setStep("dispenser");
    else if (step === "amount") setStep("fuel");
    else router.push(`/${locale}/stations`);
  }

  function next() {
    if (!stepValid) return;
    if (step === "dispenser") setStep("fuel");
    else if (step === "fuel") setStep("amount");
    else setConfirmOpen(true);
  }

  async function submit() {
    if (!station || !fuelType || dispenserNumber === null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/fueling/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId: station.id,
          dispenserNumber,
          fuelType,
          amountUzs: mode === "amount" ? amountUzs : undefined,
          fullTank: mode === "full" ? true : undefined,
          identifiedBy,
          // Токен карты выдаёт эквайринг банка; до подключения Apex сюда идёт
          // отметка сохранённой карты клиента.
          cardToken: "primary",
        }),
      });
      if (res.status === 401) {
        router.push(`/${locale}/client-login`);
        return;
      }
      const body = (await res.json()) as {
        session?: { id: string };
        error?: string;
      };
      if (!res.ok || !body.session) {
        setError(body.error ?? t("stationError"));
        return;
      }
      router.push(`/${locale}/fueling/${body.session.id}`);
    } catch {
      setError(t("stationError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <FlowShell
        title={t("title")}
        onBack={() => router.push(`/${locale}/stations`)}
        backAria={t("backAria")}
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("stationError")}
        </p>
      </FlowShell>
    );
  }

  if (!station) {
    return (
      <FlowShell
        title={t("title")}
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

  const stepTitle =
    step === "dispenser"
      ? t("stepDispenser")
      : step === "fuel"
        ? t("stepFuel")
        : t("stepAmount");

  return (
    <FlowShell
      title={stepTitle}
      subtitle={station.name}
      onBack={back}
      backAria={t("backAria")}
      action={
        <button
          type="button"
          onClick={next}
          disabled={!stepValid || !station.online}
          className="flex h-14 w-full items-center justify-center rounded-control bg-primary-500 text-base font-semibold text-primary-950 transition-colors hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("next")}
        </button>
      }
    >
      {!station.online && (
        <p className="mb-4 rounded-card bg-warning-500/10 px-4 py-3 text-sm text-warning-600">
          {t("offline")}
        </p>
      )}

      {step === "dispenser" && (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t("stepDispenserHint")}
          </p>

          {station.dispensers.some((d) => d.identificationMode === "BLE") && (
            <div className="mt-3">
              <BleDispenserDetect
                stationId={station.id}
                onPick={(n) => {
                  setDispenserNumber(n);
                  setIdentifiedBy("BLE");
                }}
              />
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            {station.dispensers.map((d) => {
              const unavailable = d.status !== "ACTIVE" || d.busy;
              const active = d.number === dispenserNumber;
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={unavailable}
                  onClick={() => {
                    setDispenserNumber(d.number);
                    setIdentifiedBy("MANUAL");
                  }}
                  className={`min-h-[7rem] rounded-card border-2 bg-white p-4 text-left transition-colors dark:bg-navy-900 ${
                    active
                      ? "border-primary-500"
                      : "border-gray-200 dark:border-white/10"
                  } ${
                    unavailable
                      ? "cursor-not-allowed opacity-40"
                      : "hover:border-primary-500/60"
                  }`}
                >
                  <span className="block font-display text-4xl font-bold tabular-nums">
                    {d.number}
                  </span>
                  <span className="mt-2 block text-xs leading-snug text-gray-600 dark:text-gray-300">
                    {d.fuelTypes.map((f) => tf(f)).join(" · ")}
                  </span>
                  {(d.busy || d.status !== "ACTIVE") && (
                    <span className="mt-1.5 block text-xs font-medium text-warning-600">
                      {d.busy ? t("dispenserBusy") : t("dispenserDisabled")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === "fuel" && (
        <ul className="space-y-3">
          {fuels.map((s) => {
            const active = s.fuelType === fuelType;
            return (
              <li key={s.fuelType}>
                <button
                  type="button"
                  onClick={() => setFuelType(s.fuelType)}
                  className={`flex w-full items-center justify-between gap-3 rounded-card border-2 bg-white px-4 py-4 text-left transition-colors dark:bg-navy-900 ${
                    active
                      ? "border-primary-500"
                      : "border-gray-200 hover:border-primary-500/60 dark:border-white/10"
                  }`}
                >
                  <span className="font-display text-xl font-semibold">
                    {tf(s.fuelType)}
                  </span>
                  <span className="text-base font-bold tabular-nums">
                    {formatMoney(s.priceUzs ?? 0, locale)}
                    <span className="ml-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("uzsShort")}/{t("litersShort")}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {step === "amount" && price !== null && (
        <div className="flex flex-1 flex-col">
          {/* Главный элемент — вертикальный «бак», заполняющийся снизу вверх. */}
          <div className="flex flex-1 items-center justify-center gap-3 py-4">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <p className="font-display text-2xl font-bold leading-none tabular-nums">
                {formatMoney(holdUzs, locale)}
              </p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("uzsShort")}
              </p>
              <button
                type="button"
                onClick={() =>
                  setAmountUzs((v) => Math.max(MIN_HOLD_UZS, v - AMOUNT_STEP_UZS))
                }
                disabled={mode === "full" || amountUzs <= MIN_HOLD_UZS}
                aria-label={t("decrease")}
                className="mt-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-navy transition-colors hover:bg-gray-200 disabled:opacity-40 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                <Minus className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div
              className="relative h-64 w-24 overflow-hidden rounded-card border-2 border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5"
              role="presentation"
            >
              <div
                className="absolute inset-x-0 bottom-0 bg-primary-500 transition-[height] duration-300"
                style={{ height: `${Math.round(fillFraction * 100)}%` }}
              />
              <span className="absolute inset-x-0 top-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                {fuelType ? tf(fuelType) : ""}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <p className="font-display text-2xl font-bold leading-none tabular-nums">
                {mode === "full"
                  ? t("fullTankUpTo", { n: Math.round(fullLiters) })
                  : liters.toFixed(1)}
              </p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("litersShort")}
              </p>
              <button
                type="button"
                onClick={() =>
                  setAmountUzs((v) => Math.min(maxAmount, v + AMOUNT_STEP_UZS))
                }
                disabled={mode === "full" || amountUzs >= maxAmount}
                aria-label={t("increase")}
                className="mt-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-navy transition-colors hover:bg-gray-200 disabled:opacity-40 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                <Plus className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>

          {mode === "full" && (
            <p className="mb-3 text-center text-sm text-gray-600 dark:text-gray-300">
              {t("fullTankNote")}
            </p>
          )}

          {/* Переключатель режима — внизу, над главной кнопкой. */}
          <div className="mb-2 flex gap-2 rounded-control bg-gray-100 p-1 dark:bg-white/10">
            {(["amount", "full"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`h-11 flex-1 rounded-control text-sm font-semibold transition-colors ${
                  mode === m
                    ? "bg-white text-navy shadow-sm dark:bg-navy-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-300"
                }`}
              >
                {m === "amount" ? t("modeSum") : t("modeFull")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Шторка «Подтверждение и оплата» поверх притемнённого экрана. */}
      {confirmOpen && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label={t("backAria")}
            onClick={() => setConfirmOpen(false)}
            className="absolute inset-0 bg-navy-950/60"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-card bg-white p-5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl dark:bg-navy-900">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300 dark:bg-white/20" />
            <h2 className="mt-4 font-display text-xl font-semibold">
              {t("confirmTitle")}
            </h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">
                  {t("litersLabel")}
                </dt>
                <dd className="font-semibold tabular-nums">
                  {mode === "full"
                    ? t("fullTankUpTo", { n: Math.round(fullLiters) })
                    : `${liters.toFixed(1)} ${t("litersShort")}`}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">
                  {t("stepFuel")}
                </dt>
                <dd className="font-semibold">{fuelType ? tf(fuelType) : "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">
                  {t("stepDispenser")}
                </dt>
                <dd className="font-semibold">
                  {dispenserNumber !== null
                    ? t("dispenser", { n: dispenserNumber })
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-2.5 dark:border-white/10">
                <dt className="text-gray-500 dark:text-gray-400">
                  {t("payCard")}
                </dt>
                <dd className="flex items-center gap-1.5 font-semibold">
                  <CreditCard className="h-4 w-4 text-gray-400" aria-hidden />
                  {t("payCardPrimary")}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-sm font-medium text-success-600">
              {t("cashbackReturn", { sum: formatMoney(cashbackUzs, locale) })}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {t("holdNote")}
            </p>

            {error && (
              <p className="mt-3 text-sm text-warning-600">{error}</p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mt-4 flex h-14 w-full items-center justify-between rounded-control bg-primary-500 px-5 text-base font-semibold text-primary-950 transition-colors hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center gap-2">
                {submitting && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                )}
                {submitting ? t("submitting") : t("confirmPay")}
              </span>
              <span className="tabular-nums">
                {formatMoney(holdUzs, locale)}
              </span>
            </button>
          </div>
        </div>
      )}
    </FlowShell>
  );
}
