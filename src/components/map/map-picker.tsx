'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MlMap, Marker } from 'maplibre-gl';
import { LocateFixed } from 'lucide-react';
import { useTheme } from 'next-themes';
import { mapProvider, TASHKENT_CENTER } from './provider';
import 'maplibre-gl/dist/maplibre-gl.css';

export type LatLng = { lat: number; lng: number };

/**
 * Full-width interactive map for picking a delivery point (M2). Tap the map to
 * move the pin, or press the locate button to use the browser geolocation.
 * Provider-agnostic: rendering backend comes from `mapProvider`.
 */
export function MapPicker({
  value,
  onChange,
  className,
  locateLabel = 'Locate me',
}: {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  className?: string;
  locateLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [locating, setLocating] = useState(false);
  // Read the theme at init time so MapTiler serves its dark basemap in dark mode.
  const { resolvedTheme } = useTheme();
  const darkRef = useRef(false);
  darkRef.current = resolvedTheme === 'dark';

  // Initialize the map once (dynamic import keeps maplibre out of the SSR bundle).
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;

      const start = value ?? TASHKENT_CENTER;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: mapProvider.getStyle({ dark: darkRef.current }),
        center: [start.lng, start.lat],
        zoom: value ? 15 : 12,
        attributionControl: { compact: true },
      });
      mapRef.current = map;

      const marker = new maplibregl.Marker({ color: '#2563eb', draggable: true })
        .setLngLat([start.lng, start.lat])
        .addTo(map);
      markerRef.current = marker;

      marker.on('dragend', () => {
        const { lat, lng } = marker.getLngLat();
        onChangeRef.current({ lat, lng });
      });

      map.on('click', (e) => {
        marker.setLngLat(e.lngLat);
        onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Init once; external `value` changes are reflected via the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker/camera in sync when the parent sets a value externally.
  useEffect(() => {
    if (!value || !markerRef.current || !mapRef.current) return;
    markerRef.current.setLngLat([value.lng, value.lat]);
  }, [value]);

  const locateMe = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const v = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChangeRef.current(v);
        mapRef.current?.flyTo({ center: [v.lng, v.lat], zoom: 16 });
        markerRef.current?.setLngLat([v.lng, v.lat]);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className={className}>
      <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 sm:h-80">
        <div ref={containerRef} className="absolute inset-0" />
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg bg-white/95 dark:bg-navy-900/95 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-md backdrop-blur transition hover:text-primary-600 disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" aria-hidden />
          {locating ? '…' : locateLabel}
        </button>
      </div>
    </div>
  );
}
