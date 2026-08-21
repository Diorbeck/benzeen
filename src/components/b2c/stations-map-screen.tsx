"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronLeft, Crosshair, Fuel, WifiOff } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { haversineKm } from "@/lib/geo";
import { STATION_FUELING_WEB_ENABLED } from "@/lib/features";
import { StationsMapCanvas } from "./home-stations-map";
import { Tabbar } from "./tabbar";
import {
  DEFAULT_RADIUS_KM,
  fillPercent,
  useHomeStations,
  type Station,
  type Stock,
} from "./use-home-stations";

// Экран «Карта» мобильного сценария заправки: карта во весь экран, поверх неё —
// перетаскиваемая нижняя шторка со списком ближайших АЗС. Тап по точке или по
// строке раскрывает шторку карточкой АЗС с топливом, ценами и остатками.

/** Точка меркнет: АЗС не работает или молчит дольше получаса — ехать бессмысленно. */
const PIN_STALE_MS = 30 * 60_000;

/** Ниже этой доли резервуара топливо «заканчивается». */
const LOW_STOCK_PERCENT = 15;

/** Видимая часть шторки в сложенном состоянии, px. */
const PEEK_PX = 248;

/** Порог жеста: насколько нужно потянуть, чтобы шторка перещёлкнулась. */
const SNAP_PX = 72;

function isDimmed(s: Station): boolean {
  if (s.status !== "ACTIVE") return true;
  if (!s.lastSeenAt) return true;
  return Date.now() - Date.parse(s.lastSeenAt) > PIN_STALE_MS;
}

export function StationsMapScreen({ locale }: { locale: string }) {
  const t = useTranslations("stations");
  const tFueling = useTranslations("fueling");
  const tHomeMap = useTranslations("homeMap");
  const data = useHomeStations();
  const { stations, state, center, locate } = data;
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startY: number } | null>(null);

  // Список всегда по расстоянию от клиента (или от центра Ташкента до ответа
  // геолокации) — без ограничения радиусом: на этом экране ищут, куда ехать.
  const sorted = useMemo(
    () =>
      stations
        .map((s) => ({
          ...s,
          distanceKm: haversineKm(center, { lat: s.lat, lng: s.lng }),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm),
    [stations, center],
  );

  // Пины на карте: приглушаем неработающие и молчащие дольше 30 минут.
  const pins = useMemo(
    () => sorted.map((s) => ({ ...s, online: !isDimmed(s) })),
    [sorted],
  );

  const selected = useMemo(
    () => sorted.find((s) => s.id === selectedId) ?? null,
    [sorted, selectedId],
  );

  const pick = (id: string) => {
    setSelectedId(id);
    setOpen(true);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const delta = e.clientY - dragRef.current.startY;
    // В раскрытом состоянии тянуть можно только вниз, в сложенном — вверх.
    setDragY(open ? Math.max(0, delta) : Math.min(0, delta));
  };
  const onPointerUp = () => {
    if (!dragRef.current) return;
    if (Math.abs(dragY) > SNAP_PX) setOpen(!open);
    dragRef.current = null;
    setDragY(0);
    setDragging(false);
  };

  const sheetTransform = open
    ? `translateY(${dragY}px)`
    : `translateY(calc(100% - ${PEEK_PX}px + ${dragY}px))`;

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-canvas text-navy dark:bg-navy-950 dark:text-white">
      <div className="absolute inset-0">
        <StationsMapCanvas
          stations={pins}
          selectedId={selectedId}
          onSelect={pick}
          center={center}
          radiusKm={DEFAULT_RADIUS_KM}
          showRadius={false}
          onUserMove={() => {}}
        />
      </div>

      {/* Плавающая шапка: назад — единственное действие сверху. */}
      <div className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20">
        <button
          type="button"
          onClick={() => router.push(`/${locale}`)}
          aria-label={tFueling("backAria")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-navy shadow-md transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 dark:bg-navy-900 dark:text-white dark:hover:bg-navy-800"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {!open && (
      <div
        className="absolute right-3 z-20"
        style={{ bottom: `calc(${PEEK_PX + 12}px + 3.5rem + env(safe-area-inset-bottom))` }}
      >
        <button
          type="button"
          onClick={locate}
          aria-label={tHomeMap("myLocation")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-navy shadow-md transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 dark:bg-navy-900 dark:text-white dark:hover:bg-navy-800"
        >
          <Crosshair className="h-5 w-5" aria-hidden />
        </button>
      </div>
      )}

      {/* Нижняя шторка: список ближайших или карточка выбранной АЗС. */}
      <section
        aria-label={t("sheetAria")}
        className={`absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex h-[80dvh] flex-col rounded-t-card border-t border-paper-300 bg-white shadow-[0_-8px_30px_rgba(11,14,20,0.15)] dark:border-navy-700 dark:bg-navy-900 ${
          dragging ? "" : "transition-transform duration-300 ease-out"
        }`}
        style={{ transform: sheetTransform }}
      >
        <div
          className="shrink-0 cursor-grab touch-none px-4 pb-2 pt-3 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={() => {
            if (Math.abs(dragY) < 4) setOpen(!open);
          }}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300 dark:bg-white/20" />
          <div className="mt-3 flex items-center gap-2">
            {selected ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(null);
                  }}
                  aria-label={t("nearbyTitle")}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-gray-100 hover:text-navy dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <h2 className="min-w-0 truncate font-display text-lg font-semibold">
                  {selected.name}
                </h2>
                {selected.isDemo && (
                  <span className="shrink-0 rounded-md bg-gold-500/15 px-2 py-0.5 text-xs font-medium text-gold-700 dark:text-gold-300">
                    {t("demo")}
                  </span>
                )}
              </>
            ) : (
              <h2 className="font-display text-lg font-semibold">
                {t("nearbyTitle")}
              </h2>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {state === "error" && (
            <p className="py-6 text-sm text-gray-600 dark:text-gray-300">
              {t("error")}
            </p>
          )}
          {state === "loading" && sorted.length === 0 && (
            <p className="py-6 text-sm text-gray-500 dark:text-gray-400">
              {t("title")}…
            </p>
          )}

          {selected ? (
            <StationSheetCard station={selected} locale={locale} />
          ) : (
            <ul className="space-y-2">
              {sorted.map((s) => {
                const dim = isDimmed(s);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => pick(s.id)}
                      className={`w-full rounded-card border border-gray-200 bg-white px-4 py-3 text-left transition-[transform,border-color] hover:border-primary-500 active:scale-[0.99] dark:border-white/10 dark:bg-navy-900 dark:hover:border-primary-500 ${
                        dim ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {s.name}
                          </span>
                          {s.isDemo && (
                            <span className="shrink-0 rounded-md bg-gold-500/15 px-1.5 py-0.5 text-[11px] font-medium text-gold-700 dark:text-gold-300">
                              {t("demo")}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                          {t("kmAway", { km: s.distanceKm.toFixed(1) })}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                        {s.address}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {dim && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-600">
                            <WifiOff className="h-3 w-3" aria-hidden />
                            {s.status !== "ACTIVE" ? t("paused") : t("offline")}
                          </span>
                        )}
                        {s.stocks
                          .filter((f) => f.priceUzs !== null)
                          .map((f) => (
                            <span
                              key={f.fuelType}
                              className="text-xs tabular-nums text-gray-600 dark:text-gray-300"
                            >
                              <span className="font-medium text-navy dark:text-white">
                                {t(`fuel.${f.fuelType}`)}
                              </span>{" "}
                              {formatMoney(f.priceUzs ?? 0, locale)}
                            </span>
                          ))}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Экран «Заправка»: главная кнопка закреплена внизу шторки. */}
        {selected && (
          <div className="shrink-0 border-t border-paper-300 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-navy-700">
            {STATION_FUELING_WEB_ENABLED &&
            selected.online &&
            selected.status === "ACTIVE" ? (
              <Link
                href={`/${locale}/fueling/start?station=${selected.id}`}
                className="flex h-14 w-full items-center justify-center rounded-control bg-primary-500 text-base font-semibold text-primary-950 transition-colors hover:bg-primary-600 active:bg-primary-700"
              >
                {t("startFueling")}
              </Link>
            ) : (
              <p className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">
                {!selected.online || selected.status !== "ACTIVE"
                  ? t("offline")
                  : t("appOnly")}
              </p>
            )}
          </div>
        )}
      </section>

      <Tabbar locale={locale} />
    </div>
  );
}

function StationSheetCard({
  station,
  locale,
}: {
  station: Station & { distanceKm: number };
  locale: string;
}) {
  const t = useTranslations("stations");
  // Время в пути — грубая оценка по городской скорости ~28 км/ч: клиенту нужен
  // порядок величины «ехать 5 минут или 25», а не навигация.
  const driveMinutes = Math.max(1, Math.round((station.distanceKm / 28) * 60));

  return (
    <div>
      {/* Место под фото заправки: появится вместе с фотографиями объектов. */}
      <div className="flex h-36 items-center justify-center rounded-card bg-gray-100 dark:bg-white/5">
        <Fuel className="h-10 w-10 text-gray-300 dark:text-white/15" aria-hidden />
      </div>

      <p className="mt-3 font-display text-lg font-bold tabular-nums">
        {t("kmShort", { km: station.distanceKm.toFixed(1) })}
        <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
        {t("driveTime", { n: driveMinutes })}
      </p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {station.address}
      </p>

      {!station.online && (
        <p className="mt-3 flex items-center gap-1.5 rounded-control bg-warning-500/10 px-3 py-2 text-sm font-medium text-warning-600">
          <WifiOff className="h-4 w-4" aria-hidden /> {t("offline")}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {station.stocks.map((f) => (
          <FuelRow key={f.fuelType} stock={f} locale={locale} online={station.online} />
        ))}
      </ul>
    </div>
  );
}

function FuelRow({
  stock,
  locale,
  online,
}: {
  stock: Stock;
  locale: string;
  online: boolean;
}) {
  const t = useTranslations("stations");
  const fill = fillPercent(stock);
  const fresh = stock.dataFresh && online && fill !== null;
  const low = fresh && fill !== null && fill < LOW_STOCK_PERCENT;

  return (
    <li className="rounded-card border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-navy-900">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-semibold">{t(`fuel.${stock.fuelType}`)}</span>
        <span className="text-base font-bold tabular-nums">
          {stock.priceUzs !== null ? formatMoney(stock.priceUzs, locale) : "—"}
          <span className="ml-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("perLiter")}
          </span>
        </span>
      </div>
      {fresh ? (
        <>
          <div
            className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
            role="presentation"
          >
            <div
              className={`h-full rounded-full ${low ? "bg-warning-500" : "bg-primary-500"}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          {low && (
            <p className="mt-1.5 text-xs font-medium text-warning-600">
              {t("lowStock")}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs font-medium text-gray-400 dark:text-gray-500">
          {t("noData")}
        </p>
      )}
    </li>
  );
}
