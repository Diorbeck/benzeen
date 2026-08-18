'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import type { Map as MlMap, Marker } from 'maplibre-gl';
import { Gauge, MapPin, Navigation, RefreshCw, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mapProvider, localizeMapLabels } from '@/components/map/provider';
import { formatMoney } from '@/lib/format';
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

// Центр и зум выбраны так, чтобы в кадр попала вся страна: продукт национальный,
// и первое впечатление должно быть «карта Узбекистана», а не «карта Ташкента».
const UZBEKISTAN_CENTER: [number, number] = [64.6, 41.5];
const UZBEKISTAN_ZOOM = 5.1;
const REFRESH_MS = 30_000;

export function HomeStationsMap({ locale }: { locale: string }) {
  const t = useTranslations('homeMap');
  const tStations = useTranslations('stations');
  const [stations, setStations] = useState<Station[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selected = useMemo(
    () => stations.find((s) => s.id === selectedId) ?? null,
    [stations, selectedId],
  );

  const online = stations.filter((s) => s.online).length;

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
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {state === 'ready' ? t('counter', { online, total: stations.length }) : '\u00A0'}
        </p>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-card border border-gray-200 bg-gray-100 dark:border-navy-700 dark:bg-navy-900">
        <div className="h-[380px] sm:h-[460px] lg:h-[520px]">
          <StationsMapCanvas
            stations={stations}
            selectedId={selectedId}
            onSelect={setSelectedId}
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

function StationsMapCanvas({
  stations,
  selectedId,
  onSelect,
}: {
  stations: readonly Station[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

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
        center: UZBEKISTAN_CENTER,
        zoom: UZBEKISTAN_ZOOM,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      ro = new ResizeObserver(() => map?.resize());
      ro.observe(ref.current);
      map.on('load', () => localizeMapLabels(map!, document.documentElement.lang || 'ru'));
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

  // Смена темы меняет подложку карты: светлая карта в тёмном интерфейсе
  // выглядит как чужой вставленный кусок.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(mapProvider.getStyle({ dark }));
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
        return new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map);
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
