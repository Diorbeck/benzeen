'use client';

import { useEffect, useRef } from 'react';
import type { Map as MlMap, Marker } from 'maplibre-gl';
import { useTheme } from 'next-themes';
import { mapProvider } from './provider';
import 'maplibre-gl/dist/maplibre-gl.css';

type LatLng = { lat: number; lng: number };

// Read-only live map (M3): client destination pin + courier marker that eases
// to each new position. Provider-agnostic via mapProvider.
export function TrackingMap({
  destination,
  courier,
  className,
}: {
  destination: LatLng;
  courier: LatLng | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const destMarkerRef = useRef<Marker | null>(null);
  const courierMarkerRef = useRef<Marker | null>(null);
  const animRef = useRef<number | null>(null);
  const readyRef = useRef(false);
  // Read the theme at init time so MapTiler serves its dark basemap in dark mode.
  const { resolvedTheme } = useTheme();
  const darkRef = useRef(false);
  darkRef.current = resolvedTheme === 'dark';

  // Init once.
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: mapProvider.getStyle({ dark: darkRef.current }),
        center: [destination.lng, destination.lat],
        zoom: 13,
        attributionControl: { compact: true },
        interactive: true,
      });
      mapRef.current = map;

      // Can init while the order page is still laying out at 0 height; resize
      // whenever the container gains a real size so tiles actually load.
      ro = new ResizeObserver(() => map?.resize());
      ro.observe(containerRef.current);

      // Data-driven icon-image in the MapTiler style can evaluate to '' →
      // MapLibre warns "Image '' could not be loaded". We set no icon-image;
      // register a transparent placeholder to silence it.
      map.on('styleimagemissing', (e) => {
        const id = e.id ?? '';
        if (!map || map.hasImage(id)) return;
        try {
          map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
        } catch {
          /* empty/invalid image id — nothing to render, ignore */
        }
      });

      // Destination (client) — blue pin.
      destMarkerRef.current = new maplibregl.Marker({ color: '#2563eb' })
        .setLngLat([destination.lng, destination.lat])
        .addTo(map);

      // Courier — amber dot element.
      const el = document.createElement('div');
      el.style.cssText =
        'width:18px;height:18px;border-radius:9999px;background:#f59e0b;border:3px solid #fff;box-shadow:0 0 0 2px rgba(245,158,11,.4);';
      courierMarkerRef.current = new maplibregl.Marker({ element: el });

      map.on('load', () => {
        readyRef.current = true;
        if (courier) {
          courierMarkerRef.current!.setLngLat([courier.lng, courier.lat]).addTo(map!);
          fitBoth(map!, destination, courier);
        }
      });
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      if (animRef.current) cancelAnimationFrame(animRef.current);
      map?.remove();
      mapRef.current = null;
      destMarkerRef.current = null;
      courierMarkerRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ease the courier marker to each new position.
  useEffect(() => {
    const map = mapRef.current;
    const marker = courierMarkerRef.current;
    if (!map || !marker || !readyRef.current) return;

    if (!courier) {
      marker.remove();
      return;
    }

    const start = marker.getLngLat();
    const startOnMap = !!(start && (start.lng !== 0 || start.lat !== 0));
    if (!startOnMap) {
      marker.setLngLat([courier.lng, courier.lat]).addTo(map);
      fitBoth(map, destination, courier);
      return;
    }

    const from = { lng: start.lng, lat: start.lat };
    const to = { lng: courier.lng, lat: courier.lat };
    const durationMs = 900;
    let startTs: number | null = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / durationMs);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      marker.setLngLat([
        from.lng + (to.lng - from.lng) * ease,
        from.lat + (to.lat - from.lat) * ease,
      ]);
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courier?.lat, courier?.lng]);

  return (
    <div className={className}>
      <div className="relative h-[320px] w-full overflow-hidden rounded-card border border-gray-200/60 dark:border-white/10 md:h-[400px]">
        {/* h-full (not absolute inset-0): MapLibre forces position:relative on its
            container, which cancels `absolute` and collapses inset-0 to 0 height. */}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}

function fitBoth(map: MlMap, a: LatLng, b: LatLng) {
  const sw = { lng: Math.min(a.lng, b.lng), lat: Math.min(a.lat, b.lat) };
  const ne = { lng: Math.max(a.lng, b.lng), lat: Math.max(a.lat, b.lat) };
  map.fitBounds(
    [
      [sw.lng, sw.lat],
      [ne.lng, ne.lat],
    ],
    { padding: 70, maxZoom: 15, duration: 600 },
  );
}
