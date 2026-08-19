"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  Car,
  Check,
  Fuel,
  Gift,
  MapPin,
  Plus,
  RotateCcw,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { spring } from "@/lib/motion";
import { MapPicker, type LatLng } from "@/components/map/map-picker";
import { calcOrderPrice, type FuelType } from "@/lib/pricing";
import { computeBonusUsed, computeTotal } from "@/lib/bonus";
import { formatMoney } from "@/lib/format";
import {
  FUEL_TYPES,
  VOLUME_PRESETS,
  resolveLiters,
  submitBlockReason,
} from "@/lib/order-form";
import {
  SCHEDULE_MIN_LEAD_MS,
  SCHEDULE_MAX_AHEAD_MS,
  SCHEDULE_STEP_MINUTES,
} from "@/lib/constants";
import {
  loadDraft,
  saveDraft,
  clearDraft,
  type OrderDraft,
} from "@/lib/order-draft";
import { track } from "@/lib/analytics";
import { formatPlate, normalizePhone } from "@/lib/input-format";
import { getStoredRef, clearStoredRef } from "@/lib/referral-client";

const FUEL_LABEL: Record<FuelType, string> = {
  AI_92: "АИ-92",
  AI_95: "АИ-95",
  AI_100: "АИ-100",
};

export type ExistingCar = {
  id: string;
  plate: string;
  model: string | null;
  tankCapacity: number | null;
  // PR-A car profile: the car's usual fuel — preselected on the fuel step.
  fuelType: FuelType | null;
  brand: string | null;
};
export type SavedLocationT = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};
// Most recent order — powers the "Repeat last order" fork shown on entry.
export type LastOrderT = {
  fuelType: FuelType;
  volume: number;
  isFullTank: boolean;
  address: string | null;
  lat: number | null;
  lng: number | null;
  clientCarId: string | null;
  carPlate: string | null;
  carModel: string | null;
  // Цена литра на момент прошлого заказа — для плашки «цена изменилась».
  pricePerLiter: number | null;
};

/** Compare two plates ignoring case/spacing so "01A123BC" == "01 A 123 BC". */
function plateKey(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

const inputCls =
  "w-full rounded-control border border-transparent bg-gray-100 px-4 py-3 text-navy placeholder-gray-500 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy dark:bg-white/10 dark:text-white dark:placeholder-gray-500 dark:focus:bg-white/15 dark:focus:ring-white/60";

export function FuelOrderFlow({
  locale,
  prices,
  cars,
  isLoggedIn,
  paymeAvailable = false,
  initialFuel,
  initialVolume,
  initialCarId,
  initialScheduleOpen = false,
  bonusBalance = 0,
  savedLocations = [],
  defaultLocationId = null,
  lastOrder = null,
  hasPrefill = false,
}: {
  locale: string;
  prices: Record<string, number>;
  cars: ExistingCar[];
  isLoggedIn: boolean;
  paymeAvailable?: boolean;
  // "Repeat order" prefill (from /account → Повторить). Address is chosen anew.
  initialFuel?: FuelType;
  initialVolume?: number;
  initialCarId?: string;
  // Open the "When" step in schedule mode (from /account → Запланировать заказ).
  initialScheduleOpen?: boolean;
  bonusBalance?: number;
  savedLocations?: SavedLocationT[];
  // Этап 2: адрес по умолчанию — предвыбирается на шаге адреса в чистом флоу.
  defaultLocationId?: string | null;
  // Most recent order (logged-in clients only) — the "Repeat last order" fork.
  lastOrder?: LastOrderT | null;
  // True when the URL already pins a specific order (fuel/volume/carId/schedule),
  // so we skip the fork and honor that prefill directly.
  hasPrefill?: boolean;
}) {
  const t = useTranslations("benzin");
  const router = useRouter();
  const { status } = useSession();
  const loggedIn = isLoggedIn || status === "authenticated";
  const isRepeat = Boolean(initialFuel || initialVolume || initialCarId);
  const initialCarValid =
    initialCarId && cars.some((c) => c.id === initialCarId)
      ? initialCarId
      : null;
  const initialCarObj =
    cars.find((c) => c.id === (initialCarValid ?? cars[0]?.id)) ?? null;

  // Show the "Repeat last order / New order" fork only when a logged-in client
  // has a past order AND the URL didn't already pin a specific order.
  const canFork = Boolean(lastOrder) && !hasPrefill;
  const [showFork, setShowFork] = useState(canFork);

  // «Цена изменилась»: литр в прошлом заказе vs актуальная цена того же топлива.
  const priceChanged =
    lastOrder != null &&
    lastOrder.pricePerLiter != null &&
    prices[lastOrder.fuelType] != null &&
    prices[lastOrder.fuelType] !== lastOrder.pricePerLiter
      ? { old: lastOrder.pricePerLiter, new: prices[lastOrder.fuelType] }
      : null;
  // Префилл «Повторить» из кабинета: то же предупреждение над шагами.
  const prefillPriceChanged =
    hasPrefill && initialFuel && lastOrder?.fuelType === initialFuel
      ? priceChanged
      : null;

  // --- order state ---
  const [carId, setCarId] = useState<string | null>(
    initialCarValid ?? cars[0]?.id ?? null,
  );
  const [addingCar, setAddingCar] = useState(
    !initialCarValid && cars.length === 0,
  );
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [tankCapacity, setTankCapacity] = useState("");
  // Fuel: explicit URL prefill wins, else the selected car's usual fuel, else AI_92.
  const [fuelType, setFuelType] = useState<FuelType>(
    initialFuel ?? initialCarObj?.fuelType ?? "AI_92",
  );
  const [volume, setVolume] = useState<number>(
    initialVolume ?? VOLUME_PRESETS[0],
  );
  const [isFullTank, setIsFullTank] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [address, setAddress] = useState("");
  const [when, setWhen] = useState<"asap" | "schedule">(
    initialScheduleOpen ? "schedule" : "asap",
  );
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [scheduleBounds, setScheduleBounds] = useState<{
    min: string;
    max: string;
  }>({ min: "", max: "" });
  const [payment, setPayment] = useState<"COURIER_POS" | "PAYME">(
    "COURIER_POS",
  );
  const [useBonus, setUseBonus] = useState(false);
  const [locations, setLocations] = useState<SavedLocationT[]>(savedLocations);
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrName, setAddrName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const hydrated = useRef(false);

  // Restore a guest draft once, on mount.
  useEffect(() => {
    track("order_started");
    // Repeat-order prefill (URL) or the entry fork wins over any saved guest draft.
    if (isRepeat || canFork) {
      hydrated.current = true;
      return;
    }
    const d = loadDraft();
    if (d) {
      if (d.fuelType) setFuelType(d.fuelType);
      if (typeof d.volume === "number") setVolume(d.volume);
      if (d.isFullTank) setIsFullTank(true);
      if (typeof d.lat === "number" && typeof d.lng === "number")
        setPoint({ lat: d.lat, lng: d.lng });
      if (d.address) setAddress(d.address);
      if (d.car?.plate) {
        setAddingCar(true);
        setCarId(null);
        setPlate(d.car.plate);
        if (d.car.model) setModel(d.car.model);
        if (d.car.tankCapacity) setTankCapacity(String(d.car.tankCapacity));
      }
      setDraftRestored(true);
    } else if (defaultLocationId) {
      // Чистый флоу без драфта: предвыбираем адрес по умолчанию.
      const loc = savedLocations.find((l) => l.id === defaultLocationId);
      if (loc) {
        setPoint({ lat: loc.lat, lng: loc.lng });
        setAddress(loc.name);
        track("address_selected", { source: "saved" });
      }
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schedule bounds computed client-side (avoids SSR/hydration time mismatch).
  useEffect(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setScheduleBounds({
      min: fmt(new Date(Date.now() + SCHEDULE_MIN_LEAD_MS)),
      max: fmt(new Date(Date.now() + SCHEDULE_MAX_AHEAD_MS)),
    });
  }, []);

  const usingNewCar = addingCar || !carId;
  const selectedCar = cars.find((c) => c.id === carId) ?? null;
  const knownTankCapacity = usingNewCar
    ? tankCapacity
      ? Number(tankCapacity)
      : null
    : (selectedCar?.tankCapacity ?? null);

  // Pick a saved car: select it and (task 3) preselect its usual fuel if known.
  const selectCar = (c: ExistingCar) => {
    setCarId(c.id);
    setAddingCar(false);
    if (c.fuelType) setFuelType(c.fuelType);
    track("vehicle_selected", { saved: true });
  };

  // Plate autocomplete (task 2): while adding a car, if what the user typed
  // matches one of their saved cars, offer to autofill the whole car.
  const plateMatch =
    usingNewCar && plate.trim().length >= 3
      ? (cars.find((c) => plateKey(c.plate) === plateKey(plate)) ?? null)
      : null;

  // "Repeat last order": prefill everything from the most recent order and drop
  // the user straight into the ready-to-confirm flow.
  const repeatLastOrder = () => {
    if (!lastOrder) return;
    const savedCar = lastOrder.clientCarId
      ? (cars.find((c) => c.id === lastOrder.clientCarId) ?? null)
      : null;
    if (savedCar) {
      setCarId(savedCar.id);
      setAddingCar(false);
    } else if (lastOrder.carPlate) {
      // Car was deleted — fall back to a new-car entry prefilled from the order.
      setAddingCar(true);
      setCarId(null);
      setPlate(lastOrder.carPlate);
      setModel(lastOrder.carModel ?? "");
    }
    setFuelType(lastOrder.fuelType);
    if (lastOrder.isFullTank) {
      setIsFullTank(true);
    } else {
      setIsFullTank(false);
      setVolume(lastOrder.volume);
    }
    if (
      typeof lastOrder.lat === "number" &&
      typeof lastOrder.lng === "number"
    ) {
      setPoint({ lat: lastOrder.lat, lng: lastOrder.lng });
    }
    if (lastOrder.address) setAddress(lastOrder.address);
    setShowFork(false);
    track("order_repeat_last");
  };

  // Persist the draft as the guest builds (skip the initial hydration render).
  useEffect(() => {
    if (!hydrated.current) return;
    const d: OrderDraft = {
      fuelType,
      volume,
      isFullTank,
      lat: point?.lat,
      lng: point?.lng,
      address: address || undefined,
      car:
        usingNewCar && plate
          ? {
              plate,
              model: model || undefined,
              tankCapacity: tankCapacity ? Number(tankCapacity) : undefined,
            }
          : undefined,
    };
    saveDraft(d);
  }, [
    fuelType,
    volume,
    isFullTank,
    point,
    address,
    usingNewCar,
    plate,
    model,
    tankCapacity,
  ]);

  const pricePerLiter = prices[fuelType] ?? 0;
  const liters = resolveLiters({ isFullTank, volume, knownTankCapacity });
  const { total: grossTotal } = useMemo(
    () => calcOrderPrice({ pricePerLiter, volume: liters }),
    [pricePerLiter, liters],
  );
  // Bonus liters (server re-computes authoritatively; this is the shown estimate).
  const bonusUsable = computeBonusUsed(bonusBalance, liters);
  const bonusApplied = useBonus ? bonusUsable : 0;
  const total = computeTotal(liters, bonusApplied, pricePerLiter);

  const baseBlock = submitBlockReason({
    point,
    hasExistingCar: !usingNewCar && !!selectedCar,
    newPlate: plate,
    fuelType,
    volume,
    isFullTank,
    knownTankCapacity,
  });
  const scheduleInvalid = when === "schedule" && !scheduledLocal;
  const block: string | null =
    baseBlock ?? (scheduleInvalid ? "no_time" : null);
  const showPayme = paymeAvailable && when === "asap";

  // --- inline login ---
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginStep, setLoginStep] = useState<"phone" | "code">("phone");
  const [loginPhone, setLoginPhone] = useState("+998");
  const [loginCode, setLoginCode] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginInfo, setLoginInfo] = useState("");
  const [loginError, setLoginError] = useState("");

  const placeOrder = async () => {
    setError("");
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        fuelType,
        lat: point!.lat,
        lng: point!.lng,
        address: address.trim() || undefined,
        isFullTank,
        volume: isFullTank ? undefined : volume,
        paymentMethod: showPayme ? payment : "COURIER_POS",
        scheduledFor:
          when === "schedule" && scheduledLocal
            ? new Date(scheduledLocal).toISOString()
            : undefined,
        useBonus: useBonus || undefined,
      };
      if (!usingNewCar && selectedCar) body.clientCarId = selectedCar.id;
      else
        body.newCar = {
          plate: plate.trim(),
          model: model.trim() || undefined,
          tankCapacity: tankCapacity ? Number(tankCapacity) : undefined,
        };

      const res = await fetch("/api/orders/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        track("order_failed", {
          reason: String(data?.error ?? "http_" + res.status),
        });
        setError(mapError(t, data?.error));
        return;
      }
      track("order_submitted", {
        fuel: fuelType,
        liters,
        online: !!data?.checkoutUrl,
      });
      clearDraft();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }
      router.push(`/${locale}/account/orders/${data.id}`);
    } catch {
      track("order_failed", { reason: "network" });
      setError(t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  };

  const saveLocation = async () => {
    if (!point || !addrName.trim()) return;
    try {
      const res = await fetch("/api/account/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addrName.trim(),
          lat: point.lat,
          lng: point.lng,
        }),
      });
      if (res.ok) {
        const loc = (await res.json()) as SavedLocationT;
        setLocations((prev) => [...prev, loc]);
        setSavingAddr(false);
        setAddrName("");
      }
    } catch {
      /* ignore — non-critical */
    }
  };

  const onSubmit = async () => {
    if (block) return;
    track("order_price_calculated", { fuel: fuelType, liters, total });
    if (loggedIn) {
      await placeOrder();
    } else {
      track("login_clicked", { where: "order" });
      setLoginOpen(true);
      setLoginStep("phone");
    }
  };

  const sendCode = async () => {
    setLoginError("");
    setLoginInfo("");
    const phone = normalizePhone(loginPhone);
    if (!/^\+998\d{9}$/.test(phone)) {
      setLoginError(t("login.invalidPhone"));
      return;
    }
    setLoginBusy(true);
    try {
      const res = await fetch("/api/auth/client/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        // Rate limited by the auth middleware → distinct "slow down" message.
        if (res.status === 429) {
          setLoginError(t("login.rateLimited"));
          return;
        }
        const d = await res.json().catch(() => null);
        setLoginError(
          d?.error === "invalid_phone"
            ? t("login.invalidPhone")
            : t("login.smsUnavailable"),
        );
        return;
      }
      setLoginPhone(phone);
      setLoginStep("code");
      setLoginInfo(t("login.devHint"));
    } catch {
      setLoginError(t("login.smsUnavailable"));
    } finally {
      setLoginBusy(false);
    }
  };

  const verifyAndOrder = async () => {
    setLoginError("");
    const code = loginCode.replace(/\D/g, "");
    if (code.length !== 6) {
      setLoginError(t("login.invalidCode"));
      return;
    }
    setLoginBusy(true);
    try {
      const res = await signIn("credentials", {
        identifier: normalizePhone(loginPhone),
        password: code,
        mode: "client",
        ref: getStoredRef(),
        redirect: false,
      });
      if (res?.error) {
        setLoginError(t("login.invalidCode"));
        return;
      }
      clearStoredRef();
      setLoginOpen(false);
      await placeOrder();
    } catch {
      setLoginError(t("login.invalidCode"));
    } finally {
      setLoginBusy(false);
    }
  };

  // Entry fork: repeat the last order in one tap, or start a fresh flow.
  if (showFork && lastOrder) {
    const repeatLiters = lastOrder.isFullTank ? null : lastOrder.volume;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.default}
      >
        <RepeatFork
          t={t}
          locale={locale}
          priceChanged={priceChanged}
          fuelLabel={FUEL_LABEL[lastOrder.fuelType]}
          liters={repeatLiters}
          carLabel={
            [lastOrder.carPlate, lastOrder.carModel]
              .filter(Boolean)
              .join(" · ") || null
          }
          address={lastOrder.address}
          onRepeat={repeatLastOrder}
          onNew={() => {
            setShowFork(false);
            track("order_new_after_fork");
          }}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      // Deeper into the flow → enter from the right (spatial consistency with the fork).
      initial={canFork ? { opacity: 0, x: 24 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={spring.default}
      className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8"
    >
      {/* Steps */}
      <div className="space-y-5 pb-40 lg:pb-8">
        {prefillPriceChanged && (
          <p className="rounded-control bg-warning-500/10 px-4 py-3 text-xs font-medium text-warning-600 dark:text-warning-500">
            {t("priceChanged", {
              old: formatMoney(prefillPriceChanged.old, locale),
              new: formatMoney(prefillPriceChanged.new, locale),
            })}
          </p>
        )}
        {draftRestored && (
          <div className="flex items-center justify-between gap-3 rounded-control bg-gray-100 dark:bg-white/10 px-4 py-3 text-sm text-navy dark:text-white">
            <span>{t("draftRestored")}</span>
            <button
              type="button"
              onClick={() => {
                clearDraft();
                setDraftRestored(false);
                window.location.reload();
              }}
              className="shrink-0 font-medium text-primary-600 dark:text-primary-400 underline-offset-2 hover:underline"
            >
              {t("draftClear")}
            </button>
          </div>
        )}

        {/* 1. Car */}
        <StepCard step={1} title={t("steps.car")} icon={Car}>
          {cars.length > 0 && (
            <div className="mb-3 space-y-2">
              {cars.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCar(c)}
                  className={`flex w-full items-center justify-between rounded-control border-2 px-4 py-3 text-left transition active:scale-[0.99] motion-reduce:active:scale-100 ${
                    !usingNewCar && carId === c.id
                      ? "border-primary-600 bg-white dark:bg-white/10"
                      : "border-transparent bg-gray-100 dark:bg-white/5 hover:bg-gray-200/70 dark:hover:bg-white/10"
                  }`}
                >
                  <span className="min-w-0 truncate text-sm font-medium text-navy dark:text-white">
                    {c.plate}
                    {c.model ? ` · ${c.model}` : ""}
                  </span>
                  {!usingNewCar && carId === c.id && (
                    <Check className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setAddingCar(true);
                  setCarId(null);
                }}
                className={`flex w-full items-center gap-2 rounded-control border-2 px-4 py-3 text-left text-sm font-medium transition ${
                  usingNewCar
                    ? "border-primary-600 bg-white dark:bg-white/10 text-navy dark:text-white"
                    : "border-dashed border-gray-300 dark:border-white/15 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-white/30"
                }`}
              >
                <Plus className="h-4 w-4" /> {t("addCar")}
              </button>
            </div>
          )}
          {usingNewCar && (
            <div className="space-y-3">
              <Field label={t("plateLabel")}>
                <input
                  className={inputCls}
                  value={plate}
                  onChange={(e) => setPlate(formatPlate(e.target.value))}
                  placeholder={t("platePlaceholder")}
                  onBlur={() =>
                    plate.trim() && track("vehicle_selected", { saved: false })
                  }
                  maxLength={12}
                  inputMode="text"
                  autoCapitalize="characters"
                />
                {plateMatch && (
                  <button
                    type="button"
                    onClick={() => selectCar(plateMatch)}
                    className="mt-2 flex w-full items-center gap-2 rounded-control bg-gray-100 dark:bg-white/10 px-3 py-2.5 text-left text-sm text-navy dark:text-white transition hover:bg-gray-200/70 dark:hover:bg-white/15"
                  >
                    <Car
                      className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400"
                      aria-hidden
                    />
                    <span>
                      {t("plateMatch")}{" "}
                      <span className="font-semibold">
                        {plateMatch.plate}
                        {plateMatch.brand || plateMatch.model
                          ? ` · ${[plateMatch.brand, plateMatch.model].filter(Boolean).join(" ")}`
                          : ""}
                      </span>
                    </span>
                  </button>
                )}
              </Field>
              <Field
                label={t("modelLabel")}
                optional
                optionalText={t("optional")}
              >
                <input
                  className={inputCls}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={t("modelPlaceholder")}
                  maxLength={60}
                />
              </Field>
              <Field
                label={t("tankLabel")}
                optional
                optionalText={t("optional")}
              >
                <input
                  className={inputCls}
                  value={tankCapacity}
                  onChange={(e) =>
                    setTankCapacity(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder={t("tankPlaceholder")}
                  inputMode="numeric"
                  maxLength={3}
                />
              </Field>
            </div>
          )}
        </StepCard>

        {/* 2. Fuel & volume */}
        <StepCard step={2} title={t("steps.fuel")} icon={Fuel}>
          <div className="grid grid-cols-3 gap-2.5">
            {FUEL_TYPES.map((f) => {
              const active = fuelType === f;
              const p = prices[f];
              return (
                <button
                  key={f}
                  type="button"
                  disabled={!p}
                  onClick={() => {
                    setFuelType(f);
                    track("fuel_selected", { fuel: f });
                  }}
                  className={`rounded-control border-2 p-3 text-left transition active:scale-[0.98] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? "border-primary-600 bg-white dark:bg-white/10"
                      : "border-transparent bg-gray-100 dark:bg-white/5 hover:bg-gray-200/70 dark:hover:bg-white/10"
                  }`}
                >
                  <span className="block text-sm font-semibold text-navy dark:text-white">
                    {FUEL_LABEL[f]}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {p ? `${formatMoney(p, locale)} ${t("perLiter")}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {VOLUME_PRESETS.map((v) => {
              const active = !isFullTank && volume === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setIsFullTank(false);
                    setVolume(v);
                    track("volume_selected", { liters: v });
                  }}
                  className={`min-h-[44px] rounded-control border-2 px-5 text-sm font-medium transition active:scale-[0.97] motion-reduce:active:scale-100 ${
                    active
                      ? "border-primary-600 bg-white dark:bg-white/10 text-navy dark:text-white"
                      : "border-transparent bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-200/70 dark:hover:bg-white/10"
                  }`}
                >
                  {v} {t("liters")}
                </button>
              );
            })}
            {knownTankCapacity ? (
              <button
                type="button"
                onClick={() => {
                  setIsFullTank(true);
                  track("volume_selected", { fullTank: true });
                }}
                className={`min-h-[44px] rounded-control border-2 px-5 text-sm font-medium transition active:scale-[0.97] motion-reduce:active:scale-100 ${
                  isFullTank
                    ? "border-primary-600 bg-white dark:bg-white/10 text-navy dark:text-white"
                    : "border-transparent bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-200/70 dark:hover:bg-white/10"
                }`}
              >
                {t("fullTank")}
              </button>
            ) : null}
          </div>

          {isFullTank ? (
            <p className="mt-3 rounded-control bg-warning-500/10 px-3 py-2 text-xs text-warning-600 dark:text-warning-500">
              {t("fullTankNote", { max: knownTankCapacity ?? 0 })}
            </p>
          ) : (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("customVolume")}
              </label>
              <input
                className={`${inputCls} max-w-[10rem]`}
                inputMode="numeric"
                value={String(volume)}
                onChange={(e) =>
                  setVolume(Number(e.target.value.replace(/\D/g, "")) || 0)
                }
              />
              {/* Persistent minimum-order hint (client UX only; server validates 30L). */}
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {t("minOrderHint", { min: 30 })}
              </p>
              {/* Clear message when the entered amount is below the minimum. */}
              {volume > 0 && volume < 30 && (
                <p className="mt-1.5 rounded-control bg-warning-500/10 px-3 py-2 text-xs font-medium text-warning-600 dark:text-warning-500">
                  {t("belowMin", { min: 30 })}
                </p>
              )}
            </div>
          )}
        </StepCard>

        {/* 3. Address */}
        <StepCard step={3} title={t("steps.address")} icon={MapPin}>
          {locations.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {locations.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setPoint({ lat: l.lat, lng: l.lng });
                    setAddress(l.name);
                    track("address_selected", { source: "saved" });
                  }}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-control bg-gray-100 dark:bg-white/10 px-4 py-2 text-sm text-navy dark:text-white transition hover:bg-gray-200/70 dark:hover:bg-white/15"
                >
                  <Star
                    className={`h-3.5 w-3.5 shrink-0 text-primary-600 dark:text-primary-400 ${
                      l.id === defaultLocationId ? "fill-current" : ""
                    }`}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">{l.name}</span>
                </button>
              ))}
            </div>
          )}
          <MapPicker
            value={point}
            onChange={(v) => {
              setPoint(v);
              track("address_selected", { source: "map" });
            }}
            locateLabel={t("locateMe")}
          />
          <input
            className={`${inputCls} mt-3`}
            placeholder={t("addressPlaceholder")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
          />
          {loggedIn &&
            point &&
            locations.length < 3 &&
            (savingAddr ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  className={`${inputCls} max-w-[12rem]`}
                  placeholder={t("saveAddressName")}
                  value={addrName}
                  onChange={(e) => setAddrName(e.target.value)}
                  maxLength={40}
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={saveLocation}
                  disabled={!addrName.trim()}
                >
                  {t("saveAddressConfirm")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSavingAddr(false);
                    setAddrName("");
                  }}
                >
                  {t("saveAddressCancel")}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSavingAddr(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700"
              >
                <Star className="h-4 w-4" aria-hidden />
                {t("saveAddress")}
              </button>
            ))}
        </StepCard>

        {/* 4. When */}
        <StepCard step={4} title={t("when.title")} icon={CalendarClock}>
          <div className="space-y-2">
            {(["asap", "schedule"] as const).map((w) => (
              <label
                key={w}
                className="flex cursor-pointer items-center gap-2.5 text-sm text-navy dark:text-white"
              >
                <input
                  type="radio"
                  name="when"
                  checked={when === w}
                  onChange={() => setWhen(w)}
                  className="h-4 w-4 accent-primary-600"
                />
                {t(`when.${w}`)}
              </label>
            ))}
          </div>
          {when === "schedule" && (
            <div className="mt-3">
              <input
                type="datetime-local"
                className={`${inputCls} max-w-xs`}
                min={scheduleBounds.min}
                max={scheduleBounds.max}
                step={SCHEDULE_STEP_MINUTES * 60}
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("when.hint")}
              </p>
            </div>
          )}
        </StepCard>

        {/* Mobile summary (bonus + payment live here on mobile; the bottom bar is a quick CTA) */}
        <div className="lg:hidden">
          <Summary
            t={t}
            locale={locale}
            fuelLabel={FUEL_LABEL[fuelType]}
            liters={liters}
            pricePerLiter={pricePerLiter}
            grossTotal={grossTotal}
            total={total}
            bonusUsable={bonusUsable}
            useBonus={useBonus}
            setUseBonus={setUseBonus}
            plate={usingNewCar ? plate : (selectedCar?.plate ?? "")}
            address={address}
            paymeAvailable={showPayme}
            payment={payment}
            setPayment={setPayment}
            block={block}
            submitting={submitting}
            error={error}
            onSubmit={onSubmit}
          />
        </div>
      </div>

      {/* Summary — sticky on desktop */}
      <div className="hidden lg:block">
        <div className="sticky top-24">
          <Summary
            t={t}
            locale={locale}
            fuelLabel={FUEL_LABEL[fuelType]}
            liters={liters}
            pricePerLiter={pricePerLiter}
            grossTotal={grossTotal}
            total={total}
            bonusUsable={bonusUsable}
            useBonus={useBonus}
            setUseBonus={setUseBonus}
            plate={usingNewCar ? plate : (selectedCar?.plate ?? "")}
            address={address}
            paymeAvailable={showPayme}
            payment={payment}
            setPayment={setPayment}
            block={block}
            submitting={submitting}
            error={error}
            onSubmit={onSubmit}
          />
        </div>
      </div>

      {/* Mobile fixed bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-header border-t border-gray-200/60 bg-white p-3 dark:border-white/10 dark:bg-navy-900 lg:hidden">
        {block && (
          <p className="mb-2 text-center text-xs text-warning-600 dark:text-warning-500">
            {t(`disabled.${block}`)}
          </p>
        )}
        {error && (
          <p className="mb-2 text-center text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="mb-2 flex items-center justify-between px-1 text-sm">
          <span className="text-gray-500 dark:text-gray-400">{t("total")}</span>
          <span className="text-lg font-bold tabular-nums text-navy dark:text-white">
            {formatMoney(total, locale)} {t("sum")}
          </span>
        </div>
        <Button
          onClick={onSubmit}
          disabled={!!block || submitting}
          className="w-full"
          size="lg"
        >
          {submitting ? t("submitting") : t("order")}
        </Button>
      </div>

      <AnimatePresence>
        {loginOpen && (
          <InlineLogin
            t={t}
            step={loginStep}
            phone={loginPhone}
            code={loginCode}
            busy={loginBusy}
            info={loginInfo}
            error={loginError}
            setPhone={setLoginPhone}
            setCode={setLoginCode}
            onClose={() => setLoginOpen(false)}
            onSend={sendCode}
            onVerify={verifyAndOrder}
            onBack={() => {
              setLoginStep("phone");
              setLoginCode("");
              setLoginError("");
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RepeatFork({
  t,
  locale,
  priceChanged,
  fuelLabel,
  liters,
  carLabel,
  address,
  onRepeat,
  onNew,
}: {
  t: TFn;
  locale: string;
  // Цена литра изменилась с прошлого заказа — предупреждаем до повтора.
  priceChanged: { old: number; new: number } | null;
  fuelLabel: string;
  liters: number | null;
  carLabel: string | null;
  address: string | null;
  onRepeat: () => void;
  onNew: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t("repeat.intro")}
      </p>

      {/* Repeat last order card */}
      <button
        type="button"
        onClick={onRepeat}
        className="group flex w-full flex-col gap-3 rounded-card border-2 border-primary-600 bg-white dark:bg-white/10 p-5 text-left transition hover:bg-gray-50 dark:hover:bg-white/15"
      >
        <span className="flex items-center gap-2 text-base font-semibold text-navy dark:text-white">
          <RotateCcw
            className="h-5 w-5 text-primary-600 dark:text-primary-400"
            aria-hidden
          />
          {t("repeat.repeatTitle")}
        </span>
        <dl className="space-y-1.5 text-sm">
          {carLabel && (
            <div className="flex items-center gap-2 text-navy dark:text-white">
              <Car
                className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500"
                aria-hidden
              />
              <span className="font-medium">{carLabel}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-navy dark:text-white">
            <Fuel
              className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500"
              aria-hidden
            />
            <span className="font-medium">
              {fuelLabel}
              {liters != null
                ? ` · ${liters} ${t("liters")}`
                : ` · ${t("fullTank")}`}
            </span>
          </div>
          {address && (
            <div className="flex items-center gap-2 text-navy dark:text-white">
              <MapPin
                className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500"
                aria-hidden
              />
              <span className="truncate font-medium">{address}</span>
            </div>
          )}
        </dl>
        {priceChanged && (
          <span className="rounded-control bg-warning-500/10 px-3 py-2 text-xs font-medium text-warning-600 dark:text-warning-500">
            {t("priceChanged", {
              old: formatMoney(priceChanged.old, locale),
              new: formatMoney(priceChanged.new, locale),
            })}
          </span>
        )}
        <span className="mt-1 inline-flex items-center justify-center rounded-control bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition group-hover:bg-primary-700">
          {t("repeat.repeatCta")}
        </span>
      </button>

      {/* New order */}
      <button
        type="button"
        onClick={onNew}
        className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-gray-300 dark:border-white/15 bg-white dark:bg-navy-900 px-4 py-4 text-sm font-medium text-gray-600 dark:text-gray-300 transition hover:border-gray-400 dark:hover:border-white/30 hover:text-navy dark:hover:text-white"
      >
        <Plus className="h-4 w-4" aria-hidden />
        {t("repeat.newCta")}
      </button>
    </div>
  );
}

function StepCard({
  step,
  title,
  icon: Icon,
  children,
}: {
  step: number;
  title: string;
  icon: typeof Car;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-gray-200 dark:border-white/10 bg-white dark:bg-navy-900 p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <Icon
          className="h-5 w-5 text-gray-500 dark:text-gray-400"
          aria-hidden
        />
        {/* Нумерация шагов в том же издательском ключе, что и блоки на главной:
            номер акцентным синим через слеш, заголовок акцидентным начертанием. */}
        <h2 className="font-editorial text-[21px] font-semibold leading-tight tracking-[-0.01em] text-navy dark:text-white sm:text-[22px]">
          <span className="mr-2 tabular-nums text-primary-600 dark:text-sky-300">
            {String(step).padStart(2, "0")} /
          </span>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  optional,
  optionalText,
  children,
}: {
  label: string;
  optional?: boolean;
  optionalText?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
        {optional && optionalText ? (
          <span className="ml-1 text-gray-400 dark:text-gray-500">
            · {optionalText}
          </span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

type TFn = ReturnType<typeof useTranslations>;

function Summary({
  t,
  locale,
  fuelLabel,
  liters,
  pricePerLiter,
  grossTotal,
  total,
  bonusUsable,
  useBonus,
  setUseBonus,
  plate,
  address,
  paymeAvailable,
  payment,
  setPayment,
  block,
  submitting,
  error,
  onSubmit,
}: {
  t: TFn;
  locale: string;
  fuelLabel: string;
  liters: number;
  pricePerLiter: number;
  grossTotal: number;
  total: number;
  bonusUsable: number;
  useBonus: boolean;
  setUseBonus: (v: boolean) => void;
  plate: string;
  address: string;
  paymeAvailable: boolean;
  payment: "COURIER_POS" | "PAYME";
  setPayment: (p: "COURIER_POS" | "PAYME") => void;
  block: string | null;
  submitting: boolean;
  error: string;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-card border border-gray-200 dark:border-white/10 bg-white dark:bg-navy-900 p-5">
      <h2 className="text-base font-semibold text-navy dark:text-white">
        {t("summaryTitle")}
      </h2>
      <dl className="mt-4 space-y-2 text-sm">
        {plate && <SummaryRow label={t("steps.car")} value={plate} />}
        <SummaryRow label={t("fuelTitle")} value={fuelLabel} />
        <SummaryRow
          label={t("volumeTitle")}
          value={`${liters} ${t("liters")}`}
        />
        <SummaryRow
          label={t("pricePerLiterLabel")}
          value={`${formatMoney(pricePerLiter, locale)} ${t("sum")}`}
        />
        {address && <SummaryRow label={t("steps.address")} value={address} />}
        <div className="flex items-center justify-between pt-1">
          <dt className="text-gray-500 dark:text-gray-400">{t("delivery")}</dt>
          <dd className="font-medium text-success-600 dark:text-success-500">
            {t("deliveryFree")}
          </dd>
        </div>
        {useBonus && bonusUsable > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-gray-500 dark:text-gray-400">
              {t("bonus.applied")}
            </dt>
            <dd className="font-medium text-success-600 dark:text-success-500">
              −{formatMoney(bonusUsable * pricePerLiter, locale)} {t("sum")}
            </dd>
          </div>
        )}
      </dl>

      {/* Bonus toggle */}
      {bonusUsable > 0 && (
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-control bg-gray-100 dark:bg-white/10 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={useBonus}
            onChange={(e) => setUseBonus(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary-600"
          />
          <span className="text-navy dark:text-white">
            <span className="flex items-center gap-1.5 font-medium">
              <Gift
                className="h-4 w-4 text-primary-600 dark:text-primary-400"
                aria-hidden
              />
              {t("bonus.use", { liters: bonusUsable })}
            </span>
          </span>
        </label>
      )}

      <div className="mt-4 flex items-baseline justify-between border-t border-gray-100 dark:border-white/10 pt-4">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {t("total")}
        </span>
        <span className="text-2xl font-bold tabular-nums text-navy dark:text-white">
          {useBonus && bonusUsable > 0 && (
            <span className="mr-2 text-base font-normal text-gray-400 line-through dark:text-gray-500">
              {formatMoney(grossTotal, locale)}
            </span>
          )}
          {formatMoney(total, locale)} {t("sum")}
        </span>
      </div>

      {/* Payment */}
      <div className="mt-4 space-y-2">
        {paymeAvailable ? (
          (["COURIER_POS", "PAYME"] as const).map((m) => (
            <label
              key={m}
              className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-700 dark:text-gray-200"
            >
              <input
                type="radio"
                name="pay"
                checked={payment === m}
                onChange={() => setPayment(m)}
                className="h-4 w-4 accent-primary-600"
              />
              {m === "COURIER_POS" ? t("payCourier") : t("payOnline")}
            </label>
          ))
        ) : (
          <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Fuel
              className="h-4 w-4 text-primary-600 dark:text-primary-400"
              aria-hidden
            />
            {t("payCourier")}
          </p>
        )}
      </div>

      {block && (
        <p className="mt-3 text-sm text-warning-600 dark:text-warning-500">
          {t(`disabled.${block}`)}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-control bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <Button
        onClick={onSubmit}
        disabled={!!block || submitting}
        className="mt-5 w-full"
        size="lg"
      >
        {submitting ? t("submitting") : t("order")}
      </Button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-navy dark:text-white">
        {value}
      </dd>
    </div>
  );
}

function InlineLogin({
  t,
  step,
  phone,
  code,
  busy,
  info,
  error,
  setPhone,
  setCode,
  onClose,
  onSend,
  onVerify,
  onBack,
}: {
  t: TFn;
  step: "phone" | "code";
  phone: string;
  code: string;
  busy: boolean;
  info: string;
  error: string;
  setPhone: (v: string) => void;
  setCode: (v: string) => void;
  onClose: () => void;
  onSend: () => void;
  onVerify: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-modal flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0.5 }}
        transition={spring.sheet}
        className="w-full max-w-md rounded-t-sheet bg-white p-6 shadow-soft-lg dark:bg-navy-900 sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-navy dark:text-white">
              {t("login.title")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {step === "phone"
                ? t("login.subtitle")
                : t("login.subtitleCode", { phone })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control p-2 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10"
            aria-label={t("login.cancel")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p
            className="mb-3 rounded-control bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}
        {info && !error && (
          <p className="mb-3 rounded-control bg-gray-100 dark:bg-white/10 px-3 py-2 text-sm text-navy dark:text-white">
            {info}
          </p>
        )}

        {step === "phone" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
            className="space-y-3"
          >
            <input
              className={inputCls}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 000 00 00"
              autoFocus
            />
            <Button type="submit" disabled={busy} size="lg" className="w-full">
              {busy ? t("login.sending") : t("login.send")}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onVerify();
            }}
            className="space-y-3"
          >
            <input
              className={`${inputCls} text-center text-lg tracking-[0.5em]`}
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              autoComplete="one-time-code"
              autoFocus
            />
            <Button type="submit" disabled={busy} size="lg" className="w-full">
              {busy ? t("login.verifying") : t("login.verifyAndOrder")}
            </Button>
            <button
              type="button"
              onClick={onBack}
              disabled={busy}
              className="w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600"
            >
              {t("login.changePhone")}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}

function mapError(t: TFn, code?: string): string {
  switch (code) {
    case "min_volume":
      return t("errors.minVolumeErr", { min: 30 });
    case "tank_capacity_unknown":
      return t("errors.tankUnknown");
    case "car_required":
      return t("errors.carRequired");
    default:
      return t("errors.generic");
  }
}
