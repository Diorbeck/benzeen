"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { STATION_FUELING_WEB_ENABLED } from "@/lib/features";
import type { Map as MlMap, Marker } from "maplibre-gl";
import { Fuel, Navigation, RefreshCw, Search, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mapProvider, localizeMapLabels } from "@/components/map/provider";
import { formatMoney } from "@/lib/format";
import { distanceKm, STATION_FUEL_TYPES } from "@/lib/stations";
import "maplibre-gl/dist/maplibre-gl.css";

// Карта подключённых АЗС с остатками с датчиков — Модуль 1 ТЗ v2.
//
// Остатки живые, поэтому список сам обновляется: клиент, стоящий перед выбором
// «ехать или не ехать», не должен догадываться, что цифра на экране устарела.

type Stock = {
  fuelType: string;
  litersAvailable: number;
  capacityL: number;
  dataFresh: boolean;
  tanksCount: number;
  priceUzs: number | null;
};

type Station = {
  id: string;
  name: string;
  brand: string | null;
  address: string;
  region: string | null;
  lat: number;
  lng: number;
  status: "ACTIVE" | "PAUSED";
  online: boolean;
  isDemo?: boolean;
  lastSeenAt: string | null;
  stocks: Stock[];
};

type State = "loading" | "ready" | "error";
type SortBy = "distance" | "price";

const TASHKENT: [number, number] = [69.2401, 41.2995];
const REFRESH_MS = 30_000;

export function StationsNearby() {
  const t = useTranslations("stations");
  const pathname = usePathname() ?? "";
  const seg = pathname.split("/").filter(Boolean)[0];
  const locale = seg === "ru" || seg === "en" || seg === "uz" ? seg : "ru";

  const [state, setState] = useState<State>("loading");
  const [stations, setStations] = useState<Station[]>([]);
  const [query, setQuery] = useState("");
  const [fuel, setFuel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("distance");
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setState("loading");
    fetch("/api/stations")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("request failed")),
      )
      .then((d: { stations: Station[] }) => {
        setStations(d.stations);
        setState("ready");
      })
      // Молчаливое обновление не должно ронять уже показанный список в ошибку:
      // одна неудачная попытка на плохой связи — не причина стирать данные.
      .catch(() =>
        setState((prev) => (silent && prev === "ready" ? prev : "error")),
      );
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      // Отказ в геолокации — нормальный сценарий: тогда список сортируется по
      // цене, а не пустует.
      () => setMe(null),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const withDistance = stations
      .filter((s) =>
        fuel ? s.stocks.some((st) => st.fuelType === fuel) : true,
      )
      .filter((s) =>
        q
          ? `${s.name} ${s.brand ?? ""} ${s.address}`.toLowerCase().includes(q)
          : true,
      )
      .map((s) => ({
        ...s,
        distance: me ? distanceKm(me, { lat: s.lat, lng: s.lng }) : null,
        // Цена для сортировки: по выбранному топливу, иначе минимальная на АЗС.
        sortPrice: (() => {
          const prices = s.stocks
            .filter((st) => (fuel ? st.fuelType === fuel : true))
            .map((st) => st.priceUzs)
            .filter((p): p is number => p !== null);
          return prices.length > 0 ? Math.min(...prices) : null;
        })(),
      }));

    return withDistance.sort((a, b) => {
      // АЗС на связи всегда выше: остаток офлайн-точки нельзя проверить, и
      // отправлять к ней человека первым делом нечестно.
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (sortBy === "price") {
        if (a.sortPrice === null) return 1;
        if (b.sortPrice === null) return -1;
        return a.sortPrice - b.sortPrice;
      }
      if (a.distance === null || b.distance === null)
        return a.name.localeCompare(b.name);
      return a.distance - b.distance;
    });
  }, [stations, query, fuel, me, sortBy]);

  const fuelLabel = (type: string) => t(`fuel.${type}`);

  return (
    <div>
      {/* Карта — первое, что видит клиент: экран открывается сразу на ней. */}
      <section className="relative h-[calc(100vh-4rem)] min-h-[420px] w-full overflow-hidden">
        <StationsMap stations={visible} />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-2.5 p-3 sm:p-4">
          <div className="pointer-events-auto relative mx-auto max-w-2xl">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              aria-hidden
            />
            <input
              className="h-12 w-full rounded-control border border-gray-200 bg-white/95 py-3 pl-10 pr-4 text-navy shadow-lg backdrop-blur placeholder-gray-500 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-600 dark:border-white/10 dark:bg-navy-900/95 dark:text-white dark:placeholder-gray-500 dark:focus:ring-white/60"
              placeholder={t("searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="pointer-events-auto mx-auto flex max-w-2xl gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip active={fuel === null} onClick={() => setFuel(null)}>
              {t("allFuels")}
            </FilterChip>
            {STATION_FUEL_TYPES.map((type) => (
              <FilterChip
                key={type}
                active={fuel === type}
                onClick={() => setFuel(type)}
              >
                {fuelLabel(type)}
              </FilterChip>
            ))}
            <span className="ml-auto flex shrink-0 items-center gap-2">
              <FilterChip
                active={sortBy === "distance"}
                onClick={() => setSortBy("distance")}
              >
                {t("sortDistance")}
              </FilterChip>
              <FilterChip
                active={sortBy === "price"}
                onClick={() => setSortBy("price")}
              >
                {t("sortPrice")}
              </FilterChip>
            </span>
          </div>
        </div>
      </section>

      {/* Раздел со списком заправок — ниже карты, отдельным блоком. */}
      <section className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-6 lg:py-12">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-sky-300">
            {t("listEyebrow")}
          </p>
          <h2 className="mt-3 font-editorial text-[32px] font-semibold leading-[1.05] tracking-[-0.01em] text-navy dark:text-white sm:text-[38px]">
            {t("listTitle")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {t("subtitle")}
          </p>
        </div>

        {!me && state === "ready" && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("noGeo")}
          </p>
        )}

        {state === "loading" && (
          <div className="space-y-3" aria-busy>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="skeleton-shimmer relative h-28 overflow-hidden rounded-card border border-gray-100 bg-white dark:border-white/10 dark:bg-navy-900"
              />
            ))}
          </div>
        )}

        {state === "error" && (
          <div className="rounded-card border border-gray-200 bg-white p-8 text-center dark:border-white/10 dark:bg-navy-900">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t("error")}
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" /> {t("retry")}
            </Button>
          </div>
        )}

        {state === "ready" && visible.length === 0 && (
          <div className="rounded-card border border-gray-200 bg-white p-10 text-center dark:border-white/10 dark:bg-navy-900">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500">
              <Fuel className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="mt-4 text-subheading text-navy dark:text-white">
              {t("emptyTitle")}
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-gray-600 dark:text-gray-300">
              {t("emptyDesc")}
            </p>
          </div>
        )}

        {state === "ready" && visible.length > 0 && (
          <ul className="space-y-3">
            {visible.map((s) => (
              <li
                key={s.id}
                className="rounded-card border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-navy-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-subheading text-navy dark:text-white">
                        {s.name}
                      </p>
                      {s.online ? (
                        <span className="shrink-0 rounded-md bg-success-500/10 px-2.5 py-0.5 text-xs font-medium text-success-600 dark:text-success-500">
                          {t("online")}
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
                          <WifiOff className="h-3 w-3" aria-hidden />{" "}
                          {t("offline")}
                        </span>
                      )}
                      {s.isDemo && (
                        <span className="shrink-0 rounded-md bg-gold-500/15 px-2.5 py-0.5 text-xs font-medium text-gold-700 dark:text-gold-300">
                          {t("demo")}
                        </span>
                      )}
                      {s.status === "PAUSED" && (
                        <span className="shrink-0 rounded-md bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
                          {t("paused")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {s.brand ? `${s.brand} · ` : ""}
                      {s.address}
                    </p>
                    {s.distance !== null && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {t("kmAway", { km: s.distance.toFixed(1) })}
                      </p>
                    )}
                  </div>
                  <a
                    href={`https://maps.google.com/?q=${s.lat},${s.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-gray-100 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                    aria-label={t("openInMaps")}
                  >
                    <Navigation className="h-5 w-5" aria-hidden />
                  </a>
                </div>

                <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {s.stocks
                    .filter((st) => (fuel ? st.fuelType === fuel : true))
                    .map((st) => (
                      <li
                        key={st.fuelType}
                        className="rounded-control bg-gray-50 px-3 py-2 dark:bg-white/5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            {fuelLabel(st.fuelType)}
                          </span>
                          <span className="text-sm font-bold tabular-nums text-navy dark:text-white">
                            {st.priceUzs !== null
                              ? formatMoney(st.priceUzs, locale)
                              : "—"}
                          </span>
                        </div>
                        {/* Устаревшие данные показываются как «нет данных», а не
                          нулём: ноль литров и молчащий датчик — разные вещи. */}
                        {st.dataFresh && s.online ? (
                          <>
                            <p className="mt-1 flex items-baseline justify-between gap-2">
                              <span className="text-caption font-medium text-gray-500 dark:text-gray-400">
                                {t("tankLabelShort")}
                              </span>
                              <span className="text-sm font-semibold tabular-nums text-navy dark:text-white">
                                {t("tankPercent", {
                                  n: Math.min(
                                    100,
                                    Math.round(
                                      (st.litersAvailable /
                                        Math.max(1, st.capacityL)) *
                                        100,
                                    ),
                                  ),
                                })}
                              </span>
                            </p>
                            <div
                              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
                              role="presentation"
                            >
                              <div
                                className="h-full rounded-full bg-primary-500 dark:bg-primary-500"
                                style={{
                                  width: `${Math.min(100, Math.round((st.litersAvailable / Math.max(1, st.capacityL)) * 100))}%`,
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <p className="mt-1 text-sm font-medium text-gray-400 dark:text-gray-500">
                            {t("noData")}
                          </p>
                        )}
                      </li>
                    ))}
                </ul>

                {/* Вход в сценарий заправки. Для АЗС без связи кнопки нет: резерв
                  на молчащем объекте означал бы замороженные деньги без топлива. */}
                {s.online &&
                  s.status === "ACTIVE" &&
                  STATION_FUELING_WEB_ENABLED && (
                    <a
                      href={`/${locale}/fueling/start?station=${s.id}`}
                      className="mt-4 flex h-11 w-full items-center justify-center rounded-control bg-primary-500 text-sm font-semibold text-primary-950 transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60"
                    >
                      {t("startFueling")}
                    </a>
                  )}
                {/* Без флага вместо кнопки — честная подпись: заливка идёт из приложения. */}
                {!STATION_FUELING_WEB_ENABLED && (
                  <p className="mt-4 rounded-control bg-canvas px-3 py-2.5 text-caption font-medium leading-snug text-gray-600 dark:bg-navy-800 dark:text-gray-400">
                    {t("appOnly")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "shrink-0 whitespace-nowrap rounded-control bg-primary-500 px-3 py-1.5 text-xs font-medium text-primary-950 shadow-sm dark:bg-primary-500 dark:text-primary-950"
          : "shrink-0 whitespace-nowrap rounded-control bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm backdrop-blur transition hover:bg-white dark:bg-navy-900/95 dark:text-gray-300 dark:hover:bg-navy-900"
      }
    >
      {children}
    </button>
  );
}

/** Карта АЗС: зелёная метка — на связи, серая — связь потеряна. */
function StationsMap({ stations }: { stations: readonly Station[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    let ro: ResizeObserver | null = null;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: mapProvider.getStyle({
          dark: document.documentElement.classList.contains("dark"),
        }),
        center: TASHKENT,
        zoom: 10,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.on("load", () =>
        localizeMapLabels(map!, document.documentElement.lang || "ru"),
      );
      ro = new ResizeObserver(() => map?.resize());
      ro.observe(containerRef.current);
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let disposed = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (disposed || !mapRef.current) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = stations.map((s) => {
        const marker = new maplibregl.Marker({
          color: s.online ? "#0ABAB5" : "#9ca3af",
        })
          .setLngLat([s.lng, s.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setText(s.name))
          .addTo(mapRef.current!);
        marker.getElement().style.cursor = "pointer";
        return marker;
      });
      if (stations.length > 0) {
        const lats = stations.map((s) => s.lat);
        const lngs = stations.map((s) => s.lng);
        mapRef.current!.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 60, maxZoom: 13, duration: 600 },
        );
      }
    })();
    return () => {
      disposed = true;
    };
  }, [stations]);

  return (
    <div className="absolute inset-0 h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
