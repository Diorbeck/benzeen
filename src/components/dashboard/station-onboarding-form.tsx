"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { STATION_FUEL_TYPES, type StationFuelType } from "@/lib/stations";
import {
  BILLING_DAYS_PER_MONTH,
  onboardingDailyCostUzs,
  onboardingMonthlyEstimateUzs,
} from "@/lib/station-onboarding";

// Модуль 6 ТЗ v2: подключение новой АЗС. Форма живёт в админке Benzeen, потому
// что подключение — это подписка и право писать телеметрию, а не настройка,
// которую владелец объекта делает сам.
//
// Ключ контроллера показывается один раз после создания: в базе только хеш.

const FUEL_LABELS: Record<StationFuelType, string> = {
  AI_92: "АИ-92",
  AI_95: "АИ-95",
  AI_98: "АИ-98",
  AI_100: "АИ-100",
  DIESEL: "DIESEL",
};

type TankDraft = {
  label: string;
  fuelType: StationFuelType;
  capacityL: string;
  minLevelL: string;
  sensorSerial: string;
};

type DispenserDraft = {
  number: string;
  fuelTypes: StationFuelType[];
  billed: boolean;
};

function newTank(index: number): TankDraft {
  return {
    label: `Р-${index + 1}`,
    fuelType: STATION_FUEL_TYPES[0],
    capacityL: "20000",
    minLevelL: "",
    sensorSerial: "",
  };
}

function newDispenser(index: number): DispenserDraft {
  return { number: String(index + 1), fuelTypes: ["AI_92"], billed: false };
}

type Result = {
  station: { id: string; name: string };
  tanks: number;
  dispensers: number;
  dailyRateUzs: number;
  controllerKey: string;
};

const inputClass =
  "h-11 w-full rounded-control border border-gray-200 bg-paper-100 px-3 text-sm text-navy outline-none transition focus:border-primary-600 focus:bg-white dark:border-white/10 dark:bg-navy-800 dark:text-white";
const labelClass =
  "text-caption font-medium uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400";

export function StationOnboardingForm({ locale }: { locale: string }) {
  const t = useTranslations("adminStations.onboarding");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [tin, setTin] = useState("");
  const [lat, setLat] = useState("41.3111");
  const [lng, setLng] = useState("69.2797");
  const [tanks, setTanks] = useState<TankDraft[]>([newTank(0)]);
  const [dispensers, setDispensers] = useState<DispenserDraft[]>([]);
  const [sending, setSending] = useState(false);
  const [errorFields, setErrorFields] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  const money = (uzs: number) =>
    `${Math.round(uzs).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")} ${t("sum")}`;

  const costInput = useMemo(
    () => ({
      tanks,
      dispensers: dispensers.map((d) => ({ billed: d.billed })),
    }),
    [tanks, dispensers],
  );
  const daily = onboardingDailyCostUzs(costInput);
  const monthly = onboardingMonthlyEstimateUzs(costInput);

  const hasError = (code: string) => errorFields.includes(code);

  const submit = async () => {
    setSending(true);
    setFailed(false);
    setErrorFields([]);
    try {
      const res = await fetch("/api/admin/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          brand,
          address,
          region,
          tin,
          lat,
          lng,
          tanks: tanks.map((tank) => ({
            label: tank.label,
            fuelType: tank.fuelType,
            capacityL: Number(tank.capacityL),
            minLevelL: tank.minLevelL === "" ? null : Number(tank.minLevelL),
            sensorSerial: tank.sensorSerial,
          })),
          dispensers: dispensers.map((dispenser) => ({
            number: Number(dispenser.number),
            fuelTypes: dispenser.fuelTypes,
            billed: dispenser.billed,
          })),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        (Result & { errors?: { code: string }[] }) | null;
      if (!res.ok || !data || !("controllerKey" in data)) {
        const codes = data?.errors?.map((e) => e.code) ?? [];
        setErrorFields(codes);
        setFailed(codes.length === 0);
        return;
      }
      setResult(data);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  if (result) {
    // Ключ виден один раз: его надо унести на объект вместе с контроллером.
    return (
      <section className="mt-8 rounded-card border border-primary-200 bg-white p-5 dark:border-primary-500/30 dark:bg-navy-900 sm:p-6">
        <p className="text-caption font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-sky-300">
          {t("doneEyebrow")}
        </p>
        <h2 className="mt-3 font-editorial text-[24px] font-semibold leading-[1.1] text-navy dark:text-white">
          {t("doneTitle", { name: result.station.name })}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          {t("doneSummary", {
            tanks: result.tanks,
            dispensers: result.dispensers,
            daily: money(result.dailyRateUzs),
          })}
        </p>
        <p className="mt-4 text-caption font-medium uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
          {t("keyLabel")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code className="break-all rounded-control bg-paper-200 px-3 py-2 font-mono text-sm text-navy dark:bg-navy-800 dark:text-white">
            {result.controllerKey}
          </code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(result.controllerKey);
              setCopied(true);
            }}
            className="flex h-10 items-center gap-2 rounded-control bg-primary-500 px-4 text-sm font-semibold text-primary-950 transition hover:bg-primary-600"
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
        <p className="mt-3 text-caption leading-relaxed text-warning-700 dark:text-warning-300">
          {t("keyWarning")}
        </p>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setOpen(false);
            setName("");
            setAddress("");
            setBrand("");
            setRegion("");
            setTin("");
            setTanks([newTank(0)]);
            setDispensers([]);
            setCopied(false);
          }}
          className="mt-5 text-sm font-semibold text-primary-700 transition hover:text-primary-800 dark:text-sky-300"
        >
          {t("addAnother")}
        </button>
      </section>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-card border border-dashed border-gray-300 bg-white text-sm font-semibold text-navy transition hover:border-primary-600 hover:text-primary-700 dark:border-white/15 dark:bg-navy-900 dark:text-white"
      >
        <Plus className="h-4 w-4" aria-hidden />
        {t("open")}
      </button>
    );
  }

  return (
    <section className="mt-8 rounded-card border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-navy-900 sm:p-6">
      <p className="text-caption font-semibold uppercase tracking-[0.2em] text-gold-600 dark:text-gold-300">
        {t("eyebrow")}
      </p>
      <h2 className="mt-3 font-editorial text-[24px] font-semibold leading-[1.1] text-navy dark:text-white">
        {t("title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {t("subtitle")}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="onb-name">
            {t("name")}
          </label>
          <input
            id="onb-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputClass} mt-1.5 ${hasError("name") ? "border-warning-500" : ""}`}
            placeholder={t("namePlaceholder")}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="onb-brand">
            {t("brand")}
          </label>
          <input
            id="onb-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className={`${inputClass} mt-1.5`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="onb-address">
            {t("address")}
          </label>
          <input
            id="onb-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={`${inputClass} mt-1.5 ${hasError("address") ? "border-warning-500" : ""}`}
            placeholder={t("addressPlaceholder")}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="onb-region">
            {t("region")}
          </label>
          <input
            id="onb-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className={`${inputClass} mt-1.5`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="onb-tin">
            {t("tin")}
          </label>
          <input
            id="onb-tin"
            value={tin}
            inputMode="numeric"
            onChange={(e) => setTin(e.target.value)}
            className={`${inputClass} mt-1.5 ${hasError("tin") ? "border-warning-500" : ""}`}
            placeholder="301234567"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="onb-lat">
            {t("lat")}
          </label>
          <input
            id="onb-lat"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className={`${inputClass} mt-1.5 tabular-nums ${hasError("lat") ? "border-warning-500" : ""}`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="onb-lng">
            {t("lng")}
          </label>
          <input
            id="onb-lng"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className={`${inputClass} mt-1.5 tabular-nums ${hasError("lng") ? "border-warning-500" : ""}`}
          />
        </div>
      </div>

      {/* Резервуары: ядро продукта, поэтому минимум один и без вариантов. */}
      <div className="mt-7">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-editorial text-[18px] font-semibold text-navy dark:text-white">
            {t("tanksTitle")}
          </h3>
          <button
            type="button"
            onClick={() => setTanks((prev) => [...prev, newTank(prev.length)])}
            className="flex h-9 items-center gap-1.5 rounded-control border border-gray-200 px-3 text-xs font-semibold text-navy transition hover:border-primary-600 hover:text-primary-700 dark:border-white/15 dark:text-white"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t("addTank")}
          </button>
        </div>
        <p className="mt-1.5 text-caption text-gray-500 dark:text-gray-400">
          {t("tanksHint")}
        </p>
        <div className="mt-3 space-y-3">
          {tanks.map((tank, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-card border border-gray-200 p-3 dark:border-white/10 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
            >
              <input
                aria-label={t("tankLabel")}
                value={tank.label}
                onChange={(e) =>
                  setTanks((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, label: e.target.value } : row,
                    ),
                  )
                }
                className={inputClass}
                placeholder={t("tankLabel")}
              />
              <select
                aria-label={t("fuelType")}
                value={tank.fuelType}
                onChange={(e) =>
                  setTanks((prev) =>
                    prev.map((row, i) =>
                      i === index
                        ? {
                            ...row,
                            fuelType: e.target.value as StationFuelType,
                          }
                        : row,
                    ),
                  )
                }
                className={inputClass}
              >
                {STATION_FUEL_TYPES.map((fuel) => (
                  <option key={fuel} value={fuel}>
                    {FUEL_LABELS[fuel]}
                  </option>
                ))}
              </select>
              <input
                aria-label={t("capacity")}
                value={tank.capacityL}
                inputMode="numeric"
                onChange={(e) =>
                  setTanks((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, capacityL: e.target.value } : row,
                    ),
                  )
                }
                className={`${inputClass} tabular-nums`}
                placeholder={t("capacity")}
              />
              <input
                aria-label={t("sensorSerial")}
                value={tank.sensorSerial}
                onChange={(e) =>
                  setTanks((prev) =>
                    prev.map((row, i) =>
                      i === index
                        ? { ...row, sensorSerial: e.target.value }
                        : row,
                    ),
                  )
                }
                className={inputClass}
                placeholder={t("sensorSerial")}
              />
              <button
                type="button"
                disabled={tanks.length === 1}
                onClick={() =>
                  setTanks((prev) => prev.filter((_, i) => i !== index))
                }
                aria-label={t("remove")}
                className="flex h-11 w-11 items-center justify-center rounded-control text-gray-500 transition hover:bg-gray-100 hover:text-warning-700 disabled:opacity-40 dark:hover:bg-white/5"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Колонки: опция. Тарифицируется только колонка с идентификацией клиента. */}
      <div className="mt-7">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-editorial text-[18px] font-semibold text-navy dark:text-white">
            {t("dispensersTitle")}
          </h3>
          <button
            type="button"
            onClick={() =>
              setDispensers((prev) => [...prev, newDispenser(prev.length)])
            }
            className="flex h-9 items-center gap-1.5 rounded-control border border-gray-200 px-3 text-xs font-semibold text-navy transition hover:border-primary-600 hover:text-primary-700 dark:border-white/15 dark:text-white"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t("addDispenser")}
          </button>
        </div>
        <p className="mt-1.5 text-caption text-gray-500 dark:text-gray-400">
          {t("dispensersHint")}
        </p>
        <div className="mt-3 space-y-3">
          {dispensers.map((dispenser, index) => (
            <div
              key={index}
              className="rounded-card border border-gray-200 p-3 dark:border-white/10"
            >
              <div className="flex flex-wrap items-center gap-3">
                <input
                  aria-label={t("dispenserNumber")}
                  value={dispenser.number}
                  inputMode="numeric"
                  onChange={(e) =>
                    setDispensers((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, number: e.target.value } : row,
                      ),
                    )
                  }
                  className={`${inputClass} w-20 tabular-nums`}
                />
                <div className="flex flex-wrap gap-2">
                  {STATION_FUEL_TYPES.map((fuel) => {
                    const active = dispenser.fuelTypes.includes(fuel);
                    return (
                      <button
                        key={fuel}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setDispensers((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? {
                                    ...row,
                                    fuelTypes: active
                                      ? row.fuelTypes.filter((f) => f !== fuel)
                                      : [...row.fuelTypes, fuel],
                                  }
                                : row,
                            ),
                          )
                        }
                        className={
                          active
                            ? "h-9 rounded-control bg-primary-500 px-3 text-xs font-semibold text-primary-950"
                            : "h-9 rounded-control border border-gray-200 px-3 text-xs font-medium text-gray-600 transition hover:border-primary-600 dark:border-white/15 dark:text-gray-300"
                        }
                      >
                        {FUEL_LABELS[fuel]}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDispensers((prev) => prev.filter((_, i) => i !== index))
                  }
                  aria-label={t("remove")}
                  className="ml-auto flex h-11 w-11 items-center justify-center rounded-control text-gray-500 transition hover:bg-gray-100 hover:text-warning-700 dark:hover:bg-white/5"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={dispenser.billed}
                  onChange={(e) =>
                    setDispensers((prev) =>
                      prev.map((row, i) =>
                        i === index
                          ? { ...row, billed: e.target.checked }
                          : row,
                      ),
                    )
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary-700"
                />
                {t("billedDispenser")}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Сколько объект будет стоить: подписка, а не процент с оборота. */}
      <div className="mt-7 rounded-card bg-paper-100 p-4 dark:bg-navy-800">
        <p className={labelClass}>{t("costTitle")}</p>
        <p className="mt-2 font-display text-[22px] font-bold tabular-nums text-navy dark:text-white">
          {money(daily)}{" "}
          <span className="text-sm font-medium">{t("perDay")}</span>
        </p>
        <p className="mt-1 text-caption text-gray-600 dark:text-gray-400">
          {t("costHint", {
            monthly: money(monthly),
            days: BILLING_DAYS_PER_MONTH,
          })}
        </p>
      </div>

      {(errorFields.length > 0 || failed) && (
        <p className="mt-4 text-sm font-medium text-warning-700 dark:text-warning-300">
          {failed ? t("failed") : t("invalid")}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={sending}
          onClick={() => void submit()}
          className="flex h-12 items-center justify-center rounded-control bg-primary-500 px-6 text-sm font-semibold text-primary-950 transition hover:bg-primary-600 disabled:opacity-60"
        >
          {sending ? t("sending") : t("submit")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-12 items-center justify-center rounded-control px-4 text-sm font-semibold text-gray-600 transition hover:text-navy dark:text-gray-300 dark:hover:text-white"
        >
          {t("cancel")}
        </button>
      </div>
    </section>
  );
}
