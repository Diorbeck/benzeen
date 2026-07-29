// Map provider abstraction (M2). The rest of the app depends only on this
// module, so switching from OSM/MapLibre to another provider (Yandex, Mapbox,
// a self-hosted tile server, …) is a single-file change — see TZ §12.

import type { StyleSpecification } from 'maplibre-gl';

export interface MapProvider {
  id: string;
  /** A MapLibre GL style spec (raster or vector). */
  getStyle(): StyleSpecification;
}

// Default: OpenStreetMap raster tiles (free, good Tashkent coverage). No API key.
const osmProvider: MapProvider = {
  id: 'osm',
  getStyle: () => ({
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
        maxzoom: 19,
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  }),
};

// The active provider. Swap this to change the map backend everywhere.
export const mapProvider: MapProvider = osmProvider;

// Tashkent center — sensible default when the user hasn't shared a location yet.
export const TASHKENT_CENTER = { lat: 41.3111, lng: 69.2797 };
