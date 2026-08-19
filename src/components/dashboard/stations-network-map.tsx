'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MlMap, Marker } from 'maplibre-gl';
import { MapPin, WifiOff, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { mapProvider, localizeMapLabels, TASHKENT_CENTER } from '@/components/map/provider';
import { useHtmlDark } from '@/components/map/use-html-dark';
import 'maplibre-gl/dist/maplibre-gl.css';

// Модуль 7 ТЗ v2: общая карта всех подключённых АЗС по стране для админа
// Benzeen. Отличие от клиентской карты — здесь нет радиуса и геолокации: нужен
// охват страны целиком и видно, где потеряна связь с контроллером.

export type NetworkStock = {
  fuelType: string;
  litersAvailable: number;
  dataFresh: boolean;
};

export type NetworkStation = {
  id: string;
  name: string;
  address: string;
  tin: string | null;
  lat: number;
  lng: number;
  online: boolean;
  tanks: number;
  dispensers: number;
  stocks: NetworkStock[];
};

export function StationsNetworkMap({ stations }: { stations: readonly NetworkStation[] }) {
  const t = useTranslations('adminStations');
  const tStations = useTranslations('stations');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => stations.find((s) => s.id === selectedId) ?? null,
    [stations, selectedId],
  );

  return (
    <section className="mt-8 overflow-hidden rounded-card border border-gray-200 bg-white dark:border-white/10 dark:bg-navy-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2 p-5 pb-4">
        <h2 className="font-editorial text-[21px] font-semibold text-navy dark:text-white">
          {t('mapTitle')}
        </h2>
        <p className="text-caption text-gray-500 dark:text-gray-400">{t('mapHint')}</p>
      </div>
      <div className="relative h-[420px] border-t border-gray-200 dark:border-white/10">
        <NetworkMapCanvas
          stations={stations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        {selected && (
          <div className="absolute inset-x-3 bottom-3 z-10 sm:inset-auto sm:bottom-4 sm:left-4 sm:w-[320px]">
            <div className="rounded-card border border-gray-200 bg-white p-4 shadow-xl dark:border-navy-700 dark:bg-navy-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-subheading text-navy dark:text-white">
                    {selected.name}
                  </h3>
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="line-clamp-2">{selected.address}</span>
                  </p>
                  <p className="mt-1 text-caption tabular-nums text-gray-500 dark:text-gray-400">
                    {selected.tin ? `${t('tin')} ${selected.tin}` : t('tinMissing')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label={t('close')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-gray-100 hover:text-navy dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {!selected.online && (
                <p className="mt-3 flex items-center gap-1.5 rounded-control bg-warning-500/10 px-2.5 py-1.5 text-caption font-medium text-warning-600">
                  <WifiOff className="h-3.5 w-3.5" aria-hidden /> {t('offline')}
                </p>
              )}

              <ul className="mt-3 space-y-1.5">
                {selected.stocks.length === 0 && (
                  <li className="text-sm text-gray-500 dark:text-gray-400">{t('noStocks')}</li>
                )}
                {selected.stocks.map((s) => (
                  <li
                    key={s.fuelType}
                    className="flex items-baseline justify-between gap-3 rounded-control bg-gray-50 px-3 py-2 dark:bg-white/5"
                  >
                    <span className="text-sm font-medium text-navy dark:text-white">
                      {tStations(`fuel.${s.fuelType}`)}
                    </span>
                    <span className="text-base font-bold tabular-nums text-navy dark:text-white">
                      {s.dataFresh
                        ? `${Math.round(s.litersAvailable).toLocaleString('ru-RU')} ${t('liters')}`
                        : '—'}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-caption text-gray-500 dark:text-gray-400">
                {t('tanks')}: <span className="tabular-nums">{selected.tanks}</span>
                <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
                {t('dispensers')}: <span className="tabular-nums">{selected.dispensers}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function NetworkMapCanvas({
  stations,
  selectedId,
  onSelect,
}: {
  stations: readonly NetworkStation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const dark = useHtmlDark();
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
        center: [TASHKENT_CENTER.lng, TASHKENT_CENTER.lat],
        // Стартовый зум — вся страна: админ смотрит сеть, а не один город.
        zoom: 5.2,
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(mapProvider.getStyle({ dark }));
  }, [dark]);

  // Все точки должны попасть в кадр: объекты стоят в разных регионах, и
  // фиксированный центр оставил бы часть сети за пределами карты.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || stations.length === 0) return;
    if (stations.length === 1) {
      map.easeTo({ center: [stations[0].lng, stations[0].lat], zoom: 11, duration: 600 });
      return;
    }
    const lats = stations.map((s) => s.lat);
    const lngs = stations.map((s) => s.lng);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 72, maxZoom: 11, duration: 700 },
    );
  }, [stations]);

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
        marker.getElement().setAttribute('aria-label', s.name);
        return marker;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [stations, selectedId]);

  const fallbackDamp = dark && mapProvider.id === 'osm' ? 'benzeen-map-damp' : '';
  return <div ref={ref} className={`h-full w-full ${fallbackDamp}`} />;
}
