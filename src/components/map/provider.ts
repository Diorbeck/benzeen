// Map provider abstraction (M2). The rest of the app depends only on this
// module, so switching from OSM/MapLibre to another provider (Yandex, Mapbox,
// a self-hosted tile server, …) is a single-file change — see TZ §12.

import type { StyleSpecification } from 'maplibre-gl';

/** Options a consumer can pass when asking for a style. */
export interface StyleOptions {
  /** Render a dark basemap when the app is in dark mode (if the provider has one). */
  dark?: boolean;
}

export interface MapProvider {
  id: string;
  /**
   * A MapLibre GL style. Either a full style spec (raster/vector) or a URL
   * string pointing at a hosted style.json — MapLibre's `style` option accepts
   * both, so providers can return whichever is natural for their backend.
   */
  getStyle(opts?: StyleOptions): string | StyleSpecification;
}

// Fallback: OpenStreetMap raster tiles (free, no API key). Kept as the graceful
// fallback for local/preview environments without a MapTiler key. NOTE: the OSM
// public tile server is throttled/blocked for production use under the OSM Tile
// Usage Policy — do not rely on it in production; that is why MapTiler is the
// default whenever NEXT_PUBLIC_MAPTILER_KEY is set.
const osmProvider: MapProvider = {
  id: 'osm',
  getStyle: () => ({
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        // Apex host (has no subdomains). The CSP connect-src/img-src entries
        // must list this exact host — a `*.tile.openstreetmap.org` wildcard
        // does NOT match the apex.
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
        maxzoom: 19,
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  }),
};

// The client-exposed MapTiler key (set in Vercel Production + Preview). Read at
// module load; `undefined` in envs without a key, in which case we fall back to
// OSM so the map is never blank.
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

// MapTiler style IDs, single source of truth for every map surface (/benzin
// picker, order tracking, and the future /propan picker). We use the "dataviz"
// pair — a deliberately muted, low-chroma basemap — instead of streets-v2, whose
// bright road/POI colouring clashed with the app's minimalist look. If dataviz
// is ever unavailable on our MapTiler plan, swap this pair for the equally muted
// basic-v2 / basic-v2-dark (both are on the free tier):
//   const MAPTILER_STYLE = { light: 'basic-v2', dark: 'basic-v2-dark' } as const;
const MAPTILER_STYLE = {
  light: 'dataviz-light',
  dark: 'dataviz-dark',
} as const;

// Production provider: MapTiler vector tiles via a hosted style.json URL. Its
// style, vector tiles, glyphs and sprites are fetched from api.maptiler.com
// (needs CSP connect-src + img-src).
const maptilerProvider: MapProvider = {
  id: 'maptiler',
  getStyle: (opts) => {
    const style = opts?.dark ? MAPTILER_STYLE.dark : MAPTILER_STYLE.light;
    return `https://api.maptiler.com/maps/${style}/style.json?key=${MAPTILER_KEY}`;
  },
};

// The active provider. MapTiler when a key is present, otherwise OSM so
// preview/local without a key still render a map (never a blank map).
export const mapProvider: MapProvider = MAPTILER_KEY ? maptilerProvider : osmProvider;

// Tashkent center — sensible default when the user hasn't shared a location yet.
export const TASHKENT_CENTER = { lat: 41.3111, lng: 69.2797 };

/**
 * Бонус-пул: локализация подписей карты (TODO из #29). MapTiler-стили несут
 * OSM-атрибуты name:ru / name:uz — переключаем text-field всех symbol-слоёв
 * на язык интерфейса с фолбэком на name. На OSM-растре (нет векторных слоёв)
 * тихо не делает ничего. Вызывать на событии map 'load'.
 */
export function localizeMapLabels(
  map: { getStyle: () => { layers?: { id: string; type: string }[] } | undefined; getLayoutProperty: (id: string, prop: string) => unknown; setLayoutProperty: (id: string, prop: string, value: unknown) => void },
  locale: string,
): void {
  const lang = locale === 'uz' ? 'uz' : locale === 'en' ? 'en' : 'ru';
  try {
    const layers = map.getStyle()?.layers ?? [];
    for (const layer of layers) {
      if (layer.type !== 'symbol') continue;
      if (!map.getLayoutProperty(layer.id, 'text-field')) continue;
      map.setLayoutProperty(layer.id, 'text-field', [
        'coalesce',
        ['get', `name:${lang}`],
        ['get', 'name'],
      ]);
    }
  } catch {
    /* растровый фолбэк или чужой стиль — подписи остаются дефолтными */
  }
}
