"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Map as MlMap, Marker } from "maplibre-gl";
import { motion, useReducedMotion } from "framer-motion";
import {
  Crosshair,
  MapPin,
  Navigation,
  RefreshCw,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  mapProvider,
  localizeMapLabels,
  TASHKENT_CENTER,
  loadMapLibre,
} from "@/components/map/provider";
import { useHtmlDark } from "@/components/map/use-html-dark";
import { formatMoney } from "@/lib/format";
import { duration, easeOut } from "@/lib/motion";
import { Ticker } from "@/components/motion/ticker";
import { STATION_FUELING_WEB_ENABLED } from "@/lib/features";
import {
  DEFAULT_RADIUS_KM,
  fillPercent,
  type HomeStations,
  type LatLng,
  type Station,
} from "./use-home-stations";
import "maplibre-gl/dist/maplibre-gl.css";

// Карта Узбекистана с подключёнными АЗС на главной — Модуль 1 ТЗ v2.
//
// Блок крупный, но не на весь экран: главное действие (заказ топлива) остаётся
// выше и не уезжает за пределы первого экрана. По клику на точку открывается
// карточка АЗС с остатками, которые приходят с датчиков в резервуарах — это
// то, чего нет ни у кого в стране, поэтому цифра подаётся крупно.

export function HomeStationsMap({
  locale,
  data,
}: {
  locale: string;
  data: HomeStations;
}) {
  const t = useTranslations("homeMap");
  const tStations = useTranslations("stations");
  const {
    visible,
    stations,
    state,
    reload,
    center,
    located,
    expanded,
    expand,
    locate,
  } = data;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => stations.find((s) => s.id === selectedId) ?? null,
    [stations, selectedId],
  );
  const online = visible.filter((s) => s.online).length;
  // Адрес известен (геолокация) — рисуем маршрут курьера от ближайшей АЗС на
  // связи до машины клиента: на ней курьер заправляется перед выездом.
  // Зависимости — примитивы: фоновое обновление остатков раз в 30 с не должно
  // перерисовывать маршрут заново.
  const routeFrom = located ? (visible.find((s) => s.online) ?? null) : null;
  const fromLat = routeFrom?.lat;
  const fromLng = routeFrom?.lng;
  const route = useMemo(
    () =>
      fromLat !== undefined && fromLng !== undefined
        ? {
            from: { lat: fromLat, lng: fromLng },
            to: { lat: center.lat, lng: center.lng },
          }
        : null,
    [fromLat, fromLng, center.lat, center.lng],
  );

  return (
    <section
      id="map"
      className="flex scroll-mt-20 flex-col overflow-hidden rounded-[28px] bg-white dark:bg-navy-800"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-5 sm:p-8 sm:pb-6">
        <div className="min-w-0">
          <h2 className="max-w-[20ch] font-sans text-[26px] font-semibold leading-tight tracking-[-0.025em] text-navy dark:text-white sm:text-[30px]">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={locate}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-mist-100 px-4 text-[13px] font-medium text-navy transition-[background-color,transform] duration-150 hover:bg-mist-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 active:scale-[0.97] dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            <Crosshair className="h-3.5 w-3.5" aria-hidden />
            {t("myLocation")}
          </button>
          {state === "ready" && (
            <p className="text-right text-[12px] text-gray-500 dark:text-gray-400">
              {t("counter", { online, total: visible.length })}
              <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
              {expanded
                ? t("scopeAll")
                : t("scopeRadius", { km: DEFAULT_RADIUS_KM })}
              {!expanded && stations.length > visible.length && (
                <button
                  type="button"
                  onClick={expand}
                  className="ml-2 font-semibold text-primary-800 underline-offset-2 hover:underline dark:text-sky-300"
                >
                  {t("scopeShowAll", { n: stations.length })}
                </button>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="relative flex-1 bg-mist-100 dark:bg-navy-950">
        <div className="h-[340px] sm:h-[400px] lg:h-[460px]">
          <StationsMapCanvas
            stations={visible}
            selectedId={selectedId}
            onSelect={setSelectedId}
            center={center}
            radiusKm={DEFAULT_RADIUS_KM}
            showRadius={!expanded}
            onUserMove={expand}
            route={route}
          />
        </div>

        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 backdrop-blur dark:bg-navy-950/85">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {tStations("error")}
            </p>
            <Button variant="secondary" size="sm" onClick={reload}>
              <RefreshCw className="h-4 w-4" /> {tStations("retry")}
            </Button>
          </div>
        )}

        {/* Карточка выбранной АЗС: на телефоне — снизу, на десктопе — панелью слева. */}
        {selected && (
          <div className="absolute inset-x-3 bottom-3 z-10 sm:inset-auto sm:bottom-4 sm:left-4 sm:w-[340px]">
            <StationCard
              station={selected}
              locale={locale}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}

        {!selected && state === "ready" && (
          <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/75 px-4 py-2 text-[13px] font-medium text-navy shadow-[0_2px_12px_rgba(7,24,21,0.12)] backdrop-blur-xl backdrop-saturate-150 dark:bg-navy-900/75 dark:text-white">
            {t("hint")}
          </p>
        )}
      </div>
    </section>
  );
}

function StationCard({
  station,
  locale,
  onClose,
}: {
  station: Station;
  locale: string;
  onClose: () => void;
}) {
  const t = useTranslations("homeMap");
  const tStations = useTranslations("stations");
  const reduce = useReducedMotion();

  return (
    <div className="rounded-3xl bg-white/90 p-5 shadow-[0_12px_40px_-8px_rgba(7,24,21,0.28)] backdrop-blur-xl backdrop-saturate-150 dark:bg-navy-900/90">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-subheading text-navy dark:text-white">
              {station.name}
            </h3>
            {station.isDemo && (
              <span className="shrink-0 rounded-md bg-gold-500/15 px-2 py-0.5 text-xs font-medium text-gold-700 dark:text-gold-300">
                {tStations("demo")}
              </span>
            )}
          </div>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{station.address}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-gray-100 hover:text-navy dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {!station.online && (
        <p className="mt-3 flex items-center gap-1.5 rounded-control bg-warning-500/10 px-2.5 py-1.5 text-caption font-medium text-warning-600">
          <WifiOff className="h-3.5 w-3.5" aria-hidden /> {tStations("offline")}
        </p>
      )}

      <p className="mt-3 text-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t("stocksLabel")}
      </p>
      <ul className="mt-2 space-y-1.5">
        {station.stocks.length === 0 && (
          <li className="text-sm text-gray-500 dark:text-gray-400">
            {t("noStocks")}
          </li>
        )}
        {station.stocks.map((s) => {
          const fill = fillPercent(s);
          const fresh = s.dataFresh && station.online;
          return (
            <li
              key={s.fuelType}
              className="rounded-control bg-mist-50 px-3 py-2.5 dark:bg-white/5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-navy dark:text-white">
                  {tStations(`fuel.${s.fuelType}`)}
                </span>
                <span className="text-base font-bold tabular-nums text-navy dark:text-white">
                  {s.priceUzs !== null ? formatMoney(s.priceUzs, locale) : "—"}
                  <span className="ml-1 text-caption font-medium text-gray-500 dark:text-gray-400">
                    {tStations("perLiter")}
                  </span>
                </span>
              </div>
              {fresh && fill !== null ? (
                <>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="text-caption font-medium text-gray-500 dark:text-gray-400">
                      {tStations("tankLabel")}
                    </span>
                    <Ticker
                      value={fill}
                      format={(n) => tStations("tankPercent", { n })}
                      className="text-sm font-semibold tabular-nums text-navy dark:text-white"
                    />
                  </div>
                  <div
                    className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-mist-200 dark:bg-white/10"
                    role="presentation"
                  >
                    <motion.div
                      className="h-full origin-left bg-primary-500"
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: fill / 100 }}
                      transition={{ duration: duration.ticker, ease: easeOut }}
                    />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-caption font-medium text-gray-400 dark:text-gray-500">
                  {tStations("noData")}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center gap-2">
        {/* Старт заправки из браузера выключен — кнопка появляется только с
            включённым флагом (отладка на пилотной АЗС). */}
        {STATION_FUELING_WEB_ENABLED ? (
          <Button size="sm" asChild>
            <Link href={`/${locale}/fueling/start?station=${station.id}`}>
              {t("cardCta")}
            </Link>
          </Button>
        ) : (
          <p className="flex-1 text-caption font-medium leading-snug text-gray-500 dark:text-gray-400">
            {t("cardAppOnly")}
          </p>
        )}
        <Button variant="secondary" size="sm" asChild>
          <a
            href={`https://yandex.uz/maps/?rtext=~${station.lat},${station.lng}`}
            target="_blank"
            rel="noreferrer"
            aria-label={tStations("openInMaps")}
          >
            <Navigation className="h-4 w-4" aria-hidden />
          </a>
        </Button>
      </div>
    </div>
  );
}

function StationsMapCanvas({
  stations,
  selectedId,
  onSelect,
  center,
  radiusKm,
  showRadius,
  onUserMove,
  route,
}: {
  stations: readonly Station[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  center: LatLng;
  radiusKm: number;
  showRadius: boolean;
  onUserMove: () => void;
  route: Route | null;
}) {
  // Тему читаем прямо с <html>: next-themes ставит класс до первой отрисовки,
  // а resolvedTheme на клиенте может отстать на один кадр — карта не должна
  // мигать светлой подложкой в тёмном интерфейсе.
  const dark = useHtmlDark();
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const carRef = useRef<Marker | null>(null);
  const routeRef = useRef(route);
  routeRef.current = route;
  const reduceRef = useRef(false);
  reduceRef.current = useReducedMotion() ?? false;
  const routeAnim = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const moveRef = useRef(onUserMove);
  moveRef.current = onUserMove;
  const centerRef = useRef(center);
  centerRef.current = center;
  const radiusRef = useRef(radiusKm);
  radiusRef.current = radiusKm;
  const showRadiusRef = useRef(showRadius);
  showRadiusRef.current = showRadius;

  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      const maplibregl = await loadMapLibre();
      if (cancelled || !ref.current) return;

      map = new maplibregl.Map({
        container: ref.current,
        style: mapProvider.getStyle({
          dark: document.documentElement.classList.contains("dark"),
        }),
        center: [centerRef.current.lng, centerRef.current.lat],
        zoom: zoomForRadius(radiusRef.current),
        attributionControl: { compact: true },
      });
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      ro = new ResizeObserver(() => map?.resize());
      ro.observe(ref.current);
      map.on("load", () => {
        localizeMapLabels(map!, document.documentElement.lang || "ru");
        drawRadius(map!, centerRef.current, radiusRef.current);
        setReady(true);
      });
      // Ручной жест пользователя (перетаскивание, зум, скролл) снимает
      // ограничение радиусом — дальше он смотрит карту сам.
      const release = (e: { originalEvent?: unknown }) => {
        if (e.originalEvent) moveRef.current();
      };
      map.on("dragstart", release);
      map.on("zoomstart", release);
      mapRef.current = map;
    })();

    const markers = markersRef.current;
    return () => {
      cancelled = true;
      ro?.disconnect();
      markers.forEach((m) => m.remove());
      markers.clear();
      carRef.current?.remove();
      carRef.current = null;
      if (routeAnim.current !== null) cancelAnimationFrame(routeAnim.current);
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Геолокация приходит асинхронно: пока радиус активен, карта переезжает к
  // пользователю и перерисовывает круг под новый центр.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showRadius) return;
    map.easeTo({
      center: [center.lng, center.lat],
      zoom: zoomForRadius(radiusKm),
      duration: 600,
    });
    drawRadius(map, center, radiusKm);
  }, [center.lat, center.lng, radiusKm, showRadius, center]);

  // Пользователь раскрыл всю страну — убираем круг и вписываем все точки в
  // кадр, иначе часть АЗС остаётся за пределами видимой области.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || showRadius) return;
    clearRadius(map);
    if (stations.length === 0) return;
    const lats = stations.map((s) => s.lat);
    const lngs = stations.map((s) => s.lng);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 72, maxZoom: 12, duration: 700 },
    );
  }, [showRadius, stations]);

  // Смена темы меняет подложку карты: светлая карта в тёмном интерфейсе
  // выглядит как чужой вставленный кусок.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(mapProvider.getStyle({ dark }));
    // setStyle сбрасывает слои — круг радиуса возвращаем после загрузки нового стиля.
    map.once("styledata", () => {
      if (showRadiusRef.current)
        drawRadius(map, centerRef.current, radiusRef.current);
      // Маршрут после смены темы возвращается сразу целиком, без прорисовки.
      if (routeRef.current) drawRoute(map, routeRef.current, 1, true);
    });
  }, [dark]);

  // Маркеры живут, пока АЗС в списке: при фоновом обновлении остатков и при
  // выборе точки меняются только data-атрибуты и --fill, поэтому мини-шкала
  // «наливается» CSS-переходом, а дыхание точки не сбрасывается.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = await loadMapLibre();
      const map = mapRef.current;
      if (cancelled || !map) return;

      const markers = markersRef.current;
      const ids = new Set(stations.map((s) => s.id));
      markers.forEach((m, id) => {
        if (!ids.has(id)) {
          m.remove();
          markers.delete(id);
        }
      });
      stations.forEach((s, i) => {
        let marker = markers.get(s.id);
        if (!marker) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "benzeen-pin";
          el.innerHTML =
            '<span class="benzeen-pin-dot"></span><span class="benzeen-pin-gauge"></span>';
          // Своя фаза дыхания у каждой точки — карта не мигает в такт.
          el.style.setProperty("--pulse-delay", `${-((i * 0.83) % 2.6)}s`);
          el.addEventListener("click", (event) => {
            event.stopPropagation();
            selectRef.current(s.id);
          });
          marker = new maplibregl.Marker({ element: el })
            .setLngLat([s.lng, s.lat])
            .addTo(map);
          markers.set(s.id, marker);
        } else {
          marker.setLngLat([s.lng, s.lat]);
        }
        const el = marker.getElement();
        // MapLibre ставит на элемент свой aria-label — возвращаем название АЗС,
        // иначе скринридер читает одинаковые «Map marker».
        el.setAttribute("aria-label", s.name);
        el.dataset.online = String(s.online);
        const main = s.stocks[0];
        const fill = main && main.dataFresh && s.online ? fillPercent(main) : null;
        const gauge = el.querySelector<HTMLElement>(".benzeen-pin-gauge");
        if (gauge) gauge.hidden = fill === null;
        el.style.setProperty("--fill", String((fill ?? 0) / 100));
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [stations, ready]);

  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      m.getElement().dataset.active = String(id === selectedId);
    });
  }, [selectedId, stations, ready]);

  // Линия маршрута до машины: прорисовывается от АЗС к клиенту за ~0.9 с
  // (градиент по line-progress — это canvas карты, не DOM-лейаут). При
  // reduced-motion — сразу целиком.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (routeAnim.current !== null) cancelAnimationFrame(routeAnim.current);
    routeAnim.current = null;
    if (!route) {
      clearRoute(map);
      carRef.current?.remove();
      carRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const maplibregl = await loadMapLibre();
      if (cancelled) return;
      if (!carRef.current) {
        const el = document.createElement("div");
        el.className = "benzeen-car";
        el.setAttribute("aria-hidden", "true");
        carRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([route.to.lng, route.to.lat])
          .addTo(map);
      } else {
        carRef.current.setLngLat([route.to.lng, route.to.lat]);
      }
      if (reduceRef.current) {
        drawRoute(map, route, 1, true);
        return;
      }
      drawRoute(map, route, 0, true);
      const start = performance.now();
      const total = duration.route * 1000;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / total);
        // ease-out cubic: линия «выстреливает» и мягко доходит до машины.
        drawRoute(map, route, 1 - Math.pow(1 - t, 3));
        routeAnim.current = t < 1 ? requestAnimationFrame(tick) : null;
      };
      routeAnim.current = requestAnimationFrame(tick);
    })();
    return () => {
      cancelled = true;
    };
  }, [route, ready]);

  // На растровом фолбэке (локально, без ключа MapTiler) тёмного стиля нет,
  // поэтому подложка приглушается фильтром — иначе в тёмной теме карта светит.
  const fallbackDamp =
    dark && mapProvider.id === "osm" ? "benzeen-map-damp" : "";
  return <div ref={ref} className={`h-full w-full ${fallbackDamp}`} />;
}

const RADIUS_SOURCE = "benzeen-radius";
const RADIUS_FILL = "benzeen-radius-fill";
const RADIUS_LINE = "benzeen-radius-line";

/** Зум, при котором в кадр по вертикали попадает круг заданного радиуса. */
function zoomForRadius(radiusKm: number): number {
  // Диаметр в километрах на экран высотой ~520px: подобрано так, чтобы круг
  // занимал кадр с воздухом по краям и работало на всех широтах Узбекистана.
  if (radiusKm <= 2) return 13.4;
  if (radiusKm <= 5) return 12.2;
  if (radiusKm <= 10) return 11.2;
  return 10;
}

/** Полигон-аппроксимация круга: MapLibre не умеет метрические круги из коробки. */
function circlePolygon(
  center: LatLng,
  radiusKm: number,
  steps = 72,
): number[][] {
  const latDeg = radiusKm / 110.574;
  const lngDeg = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  const ring: number[][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([
      center.lng + lngDeg * Math.cos(a),
      center.lat + latDeg * Math.sin(a),
    ]);
  }
  return ring;
}

type RadiusMap = MlMap & {
  getSource: (id: string) => unknown;
  getLayer: (id: string) => unknown;
};

function drawRadius(map: MlMap, center: LatLng, radiusKm: number): void {
  const m = map as RadiusMap;
  const data = {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [circlePolygon(center, radiusKm)],
    },
  };
  try {
    const existing = m.getSource(RADIUS_SOURCE) as
      { setData?: (d: unknown) => void } | undefined;
    if (existing?.setData) {
      existing.setData(data);
      return;
    }
    map.addSource(RADIUS_SOURCE, { type: "geojson", data });
    map.addLayer({
      id: RADIUS_FILL,
      type: "fill",
      source: RADIUS_SOURCE,
      paint: { "fill-color": "#0ABAB5", "fill-opacity": 0.08 },
    });
    map.addLayer({
      id: RADIUS_LINE,
      type: "line",
      source: RADIUS_SOURCE,
      paint: {
        "line-color": "#0ABAB5",
        "line-width": 1.5,
        "line-dasharray": [2, 2],
        "line-opacity": 0.6,
      },
    });
  } catch {
    /* стиль ещё не готов или уже уничтожен — круг не критичен для работы карты */
  }
}

function clearRadius(map: MlMap): void {
  const m = map as RadiusMap;
  try {
    if (m.getLayer(RADIUS_LINE)) map.removeLayer(RADIUS_LINE);
    if (m.getLayer(RADIUS_FILL)) map.removeLayer(RADIUS_FILL);
    if (m.getSource(RADIUS_SOURCE)) map.removeSource(RADIUS_SOURCE);
  } catch {
    /* нечего убирать */
  }
}

type Route = { from: LatLng; to: LatLng };

const ROUTE_SOURCE = "benzeen-route";
const ROUTE_LINE = "benzeen-route-line";
const ROUTE_COLOR = "#0ABAB5";

/** Дуга между АЗС и машиной: прямая читается как «линейка», дуга — как путь. */
function routeArc(route: Route, steps = 48): number[][] {
  const { from, to } = route;
  const dx = to.lng - from.lng;
  const dy = to.lat - from.lat;
  // Контрольная точка смещена перпендикулярно на 18% длины.
  const cx = (from.lng + to.lng) / 2 - dy * 0.18;
  const cy = (from.lat + to.lat) / 2 + dx * 0.18;
  const pts: number[][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    pts.push([
      a * from.lng + b * cx + c * to.lng,
      a * from.lat + b * cy + c * to.lat,
    ]);
  }
  return pts;
}

function routeGradient(progress: number): unknown[] {
  const p = Math.max(0.001, Math.min(1, progress));
  // Стопы interpolate должны строго возрастать: у самого конца рисуем целиком.
  if (p >= 0.999) {
    return ["interpolate", ["linear"], ["line-progress"], 0, ROUTE_COLOR, 1, ROUTE_COLOR];
  }
  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    0,
    ROUTE_COLOR,
    p,
    ROUTE_COLOR,
    p + 0.0001,
    "rgba(10,186,181,0)",
    1,
    "rgba(10,186,181,0)",
  ];
}

/**
 * Рисует маршрут: progress 0..1 — какая часть линии уже прорисована.
 * withGeometry — заново выставить геометрию (новый маршрут или новый стиль).
 */
function drawRoute(
  map: MlMap,
  route: Route,
  progress: number,
  withGeometry = false,
): void {
  const m = map as RadiusMap;
  const data = {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: routeArc(route) },
  };
  try {
    const source = m.getSource(ROUTE_SOURCE) as
      | { setData?: (d: unknown) => void }
      | undefined;
    if (!source) {
      map.addSource(ROUTE_SOURCE, { type: "geojson", lineMetrics: true, data });
      map.addLayer({
        id: ROUTE_LINE,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-width": 4,
          "line-gradient": routeGradient(progress) as never,
        },
      });
      return;
    }
    if (withGeometry) source.setData?.(data);
    map.setPaintProperty(
      ROUTE_LINE,
      "line-gradient",
      routeGradient(progress) as never,
    );
  } catch {
    /* стиль ещё не готов или уже уничтожен — маршрут не критичен */
  }
}

function clearRoute(map: MlMap): void {
  const m = map as RadiusMap;
  try {
    if (m.getLayer(ROUTE_LINE)) map.removeLayer(ROUTE_LINE);
    if (m.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);
  } catch {
    /* нечего убирать */
  }
}
