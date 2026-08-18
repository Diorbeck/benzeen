'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Map as MlMap, Marker } from 'maplibre-gl';
import { Gauge, MapPin, Navigation, RefreshCw, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mapProvider, localizeMapLabels, TASHKENT_CENTER } from '@/components/map/provider';
import { formatMoney } from '@/lib/format';
import { haversineKm } from '@/lib/geo';
import 'maplibre-gl/dist/maplibre-gl.css';

// Карта Узбекистана с подключёнными АЗС на главной — Модуль 1 ТЗ v2.
//
// Блок крупный, но не на весь экран: главное действие (заказ топлива) остаётся
// выше и не уезжает за пределы первого экрана. По клику на точку открывается
// карточка АЗС с остатками, которые приходят с датчиков в резервуарах — это
// то, чего нет ни у кого в стране, поэтому цифра подаётся крупно.

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
  status: 'ACTIVE' | 'PAUSED';
  online: boolean;
  lastSeenAt: string | null;
  stocks: Stock[];
};

// По умолчанию карта показывает только 5 км вокруг пользователя: человек ищет,
// где заправиться сейчас, а не изучает страну. Как только он сам подвинул или
// отмасштабировал карту — ограничение снимается и видно все подключённые АЗС.
const DEFAULT_RADIUS_KM = 5;
const REFRESH_MS = 30_000;

type LatLng = { lat: number; lng: number };

export function HomeStationsMap({ locale }: { locale: string }) {
  const t = useTranslations('homeMap');
  const tStations = useTranslations('stations');
  const [stations, setStations] = useState<Station[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Пока карту не тронули — показываем радиус 5 км вокруг пользователя.
  const [center, setCenter] = useState<LatLng>(TASHKENT_CENTER);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      // Отказ в геолокации — не ошибка: остаёмся на центре Ташкента.
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
    );
  }, []);

  const load = useCallback((silent = false) => {
    if (!silent) setState('loading');
    fetch('/api/stations')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('request failed'))))
      .then((d: { stations: Station[] }) => {
        setStations(d.stations);
        setState('ready');
      })
      // Молчаливое обновление не стирает уже показанные данные: одна неудачная
      // попытка на плохой связи — не причина обнулять карту.
      .catch(() => setState((prev) => (silent && prev === 'ready' ? prev : 'error')));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const visible = useMemo(
    () =>
      expanded
        ? stations
        : stations.filter((s) => haversineKm(center, { lat: s.lat, lng: s.lng }) <= DEFAULT_RADIUS_KM),
    [stations, center, expanded],
  );

  const selected = useMemo(
    () => stations.find((s) => s.id === selectedId) ?? null,
    [stations, selectedId],
  );

  const online = visible.filter((s) => s.online).length;

  return (
    <section id="map" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary-600/10 px-2.5 py-1 text-caption font-semibold uppercase tracking-wide text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
            <Gauge className="h-3.5 w-3.5" aria-hidden />
            {t('badge')}
          </span>
          <h2 className="mt-3 text-heading text-navy dark:text-white">{t('title')}</h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {t('subtitle')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {state === 'ready' ? t('counter', { online, total: visible.length }) : '\u00A0'}
          </p>
          {state === 'ready' && (
            <p className="mt-1 text-caption text-gray-500 dark:text-gray-400">
              {expanded
                ? t('scopeAll')
                : t('scopeRadius', { km: DEFAULT_RADIUS_KM })}
              {!expanded && stations.length > visible.length && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="ml-2 font-semibold text-primary-600 underline-offset-2 hover:underline dark:text-primary-300"
                >
                  {t('scopeShowAll', { n: stations.length })}
                </button>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-card border border-gray-200 bg-gray-100 dark:border-navy-700 dark:bg-navy-900">
        <div className="h-[380px] sm:h-[460px] lg:h-[520px]">
          <StationsMapCanvas
            stations={visible}
            selectedId={selectedId}
            onSelect={setSelectedId}
            center={center}
            radiusKm={DEFAULT_RADIUS_KM}
            showRadius={!expanded}
            onUserMove={() => setExpanded(true)}
          />
        </div>

        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 backdrop-blur dark:bg-navy-950/85">
            <p className="text-sm text-gray-600 dark:text-gray-300">{tStations('error')}</p>
            <Button variant="secondary" size="sm" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" /> {tStations('retry')}
            </Button>
          </div>
        )}

        {/* Карточка выбранной АЗС: на телефоне — снизу, на десктопе — панелью слева. */}
        {selected && (
          <div className="absolute inset-x-3 bottom-3 z-10 sm:inset-auto sm:bottom-4 sm:left-4 sm:w-[360px]">
            <StationCard
              station={selected}
              locale={locale}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}

        {!selected && state === 'ready' && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-control bg-white/90 px-3 py-1.5 text-caption font-medium text-navy shadow-sm backdrop-blur dark:bg-navy-900/90 dark:text-white">
            {t('hint')}
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
  const t = useTranslations('homeMap');
  const tStations = useTranslations('stations');

  return (
    <div className="rounded-card border border-gray-200 bg-white p-4 shadow-xl dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-subheading text-navy dark:text-white">{station.name}</h3>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{station.address}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-gray-100 hover:text-navy dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {!station.online && (
        <p className="mt-3 flex items-center gap-1.5 rounded-control bg-warning-500/10 px-2.5 py-1.5 text-caption font-medium text-warning-600">
          <WifiOff className="h-3.5 w-3.5" aria-hidden /> {tStations('offline')}
        </p>
      )}

      <p className="mt-3 text-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('stocksLabel')}
      </p>
      <ul className="mt-2 space-y-1.5">
        {station.stocks.length === 0 && (
          <li className="text-sm text-gray-500 dark:text-gray-400">{t('noStocks')}</li>
        )}
        {station.stocks.map((s) => (
          <li
            key={s.fuelType}
            className="flex items-baseline justify-between gap-3 rounded-control bg-gray-50 px-3 py-2 dark:bg-white/5"
          >
            <span className="text-sm font-medium text-navy dark:text-white">
              {tStations(`fuel.${s.fuelType}`)}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-base font-bold tabular-nums text-navy dark:text-white">
                {Math.round(s.litersAvailable).toLocaleString('ru-RU')}
                <span className="ml-1 text-caption font-medium text-gray-500 dark:text-gray-400">
                  {t('litersShort')}
                </span>
              </span>
              {s.priceUzs !== null && (
                <span className="text-caption tabular-nums text-gray-500 dark:text-gray-400">
                  {formatMoney(s.priceUzs, locale)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" asChild>
          <Link href={`/${locale}/fueling/start?station=${station.id}`}>{t('cardCta')}</Link>
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <a
            href={`https://yandex.uz/maps/?rtext=~${station.lat},${station.lng}`}
            target="_blank"
            rel="noreferrer"
            aria-label={tStations('openInMaps')}
          >
            <Navigation className="h-4 w-4" aria-hidden />
          </a>
        </Button>
      </div>
    </div>
  );
}

/** Следит за классом `dark` на <html> — источник правды о текущей теме. */
function useHtmlDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function StationsMapCanvas({
  stations,
  selectedId,
  onSelect,
  center,
  radiusKm,
  showRadius,
  onUserMove,
}: {
  stations: readonly Station[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  center: LatLng;
  radiusKm: number;
  showRadius: boolean;
  onUserMove: () => void;
}) {
  // Тему читаем прямо с <html>: next-themes ставит класс до первой отрисовки,
  // а resolvedTheme на клиенте может отстать на один кадр — карта не должна
  // мигать светлой подложкой в тёмном интерфейсе.
  const dark = useHtmlDark();
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
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
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !ref.current) return;

      map = new maplibregl.Map({
        container: ref.current,
        style: mapProvider.getStyle({ dark: document.documentElement.classList.contains('dark') }),
        center: [centerRef.current.lng, centerRef.current.lat],
        zoom: zoomForRadius(radiusRef.current),
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      ro = new ResizeObserver(() => map?.resize());
      ro.observe(ref.current);
      map.on('load', () => {
        localizeMapLabels(map!, document.documentElement.lang || 'ru');
        drawRadius(map!, centerRef.current, radiusRef.current);
      });
      // Ручной жест пользователя (перетаскивание, зум, скролл) снимает
      // ограничение радиусом — дальше он смотрит карту сам.
      const release = (e: { originalEvent?: unknown }) => {
        if (e.originalEvent) moveRef.current();
      };
      map.on('dragstart', release);
      map.on('zoomstart', release);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Геолокация приходит асинхронно: пока радиус активен, карта переезжает к
  // пользователю и перерисовывает круг под новый центр.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showRadius) return;
    map.easeTo({ center: [center.lng, center.lat], zoom: zoomForRadius(radiusKm), duration: 600 });
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
    map.once('styledata', () => {
      if (showRadiusRef.current) drawRadius(map, centerRef.current, radiusRef.current);
    });
  }, [dark]);

  // Маркеры перерисовываются при обновлении остатков: точка «на связи» зелёная,
  // потерявшая связь — серая, чтобы по карте было видно, куда ехать бессмысленно.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      const map = mapRef.current;
      if (cancelled || !map) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = stations.map((s) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.setAttribute('aria-label', s.name);
        el.className = 'benzeen-pin';
        el.dataset.online = String(s.online);
        el.dataset.active = String(s.id === selectedId);
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          selectRef.current(s.id);
        });
        const marker = new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map);
        // MapLibre ставит на элемент свой aria-label — возвращаем название АЗС,
        // иначе скринридер читает три одинаковых «Map marker».
        marker.getElement().setAttribute('aria-label', s.name);
        return marker;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [stations, selectedId]);

  // На растровом фолбэке (локально, без ключа MapTiler) тёмного стиля нет,
  // поэтому подложка приглушается фильтром — иначе в тёмной теме карта светит.
  const fallbackDamp = dark && mapProvider.id === 'osm' ? 'benzeen-map-damp' : '';
  return <div ref={ref} className={`h-full w-full ${fallbackDamp}`} />;
}

const RADIUS_SOURCE = 'benzeen-radius';
const RADIUS_FILL = 'benzeen-radius-fill';
const RADIUS_LINE = 'benzeen-radius-line';

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
function circlePolygon(center: LatLng, radiusKm: number, steps = 72): number[][] {
  const latDeg = radiusKm / 110.574;
  const lngDeg = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  const ring: number[][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([center.lng + lngDeg * Math.cos(a), center.lat + latDeg * Math.sin(a)]);
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
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [circlePolygon(center, radiusKm)] },
  };
  try {
    const existing = m.getSource(RADIUS_SOURCE) as { setData?: (d: unknown) => void } | undefined;
    if (existing?.setData) {
      existing.setData(data);
      return;
    }
    map.addSource(RADIUS_SOURCE, { type: 'geojson', data });
    map.addLayer({
      id: RADIUS_FILL,
      type: 'fill',
      source: RADIUS_SOURCE,
      paint: { 'fill-color': '#2E5BFF', 'fill-opacity': 0.08 },
    });
    map.addLayer({
      id: RADIUS_LINE,
      type: 'line',
      source: RADIUS_SOURCE,
      paint: { 'line-color': '#2E5BFF', 'line-width': 1.5, 'line-dasharray': [2, 2], 'line-opacity': 0.6 },
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
