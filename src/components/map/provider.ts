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

// Production provider: MapTiler vector tiles via a hosted style.json URL. Its
// style, vector tiles, glyphs and sprites are fetched from api.maptiler.com
// (needs CSP connect-src + img-src). streets-v2 for light, streets-v2-dark for
// dark mode.
const maptilerProvider: MapProvider = {
  id: 'maptiler',
  getStyle: (opts) => {
    const style = opts?.dark ? 'streets-v2-dark' : 'streets-v2';
    return `https://api.maptiler.com/maps/${style}/style.json?key=${MAPTILER_KEY}`;
  },
};

// The active provider. MapTiler when a key is present, otherwise OSM so
// preview/local without a key still render a map (never a blank map).
export const mapProvider: MapProvider = MAPTILER_KEY ? maptilerProvider : osmProvider;

// Tashkent center — sensible default when the user hasn't shared a location yet.
export const TASHKENT_CENTER = { lat: 41.3111, lng: 69.2797 };
