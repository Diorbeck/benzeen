import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Content-Security-Policy shipped in REPORT-ONLY mode first: the browser only
// *reports* violations to the console and never blocks anything, so it cannot
// break production. Tighten it while watching the console, then switch to
// enforcing (see header name swap below).
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  // Next.js injects inline bootstrap/hydration scripts; 'unsafe-inline' keeps
  // report-only quiet. Upgrade path: switch to nonce-based (see notes).
  // telegram.org serves the Mini App SDK (telegram-web-app.js).
  // blob: allows the MapLibre GL web worker (created from a blob URL).
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://telegram.org",
  "style-src 'self' 'unsafe-inline'",
  // MapLibre raster/vector tiles may be drawn as images. img-src already allows
  // https: broadly; MapTiler (sprites/tile images) and the OSM apex host are
  // listed explicitly for clarity.
  "img-src 'self' data: blob: https: https://api.maptiler.com https://tile.openstreetmap.org",
  "font-src 'self' data:",
  // API / telemetry + map tile fetches (MapLibre loads style.json, vector
  // tiles, glyphs and sprites via fetch/XHR — those go through connect-src).
  // MapTiler = api.maptiler.com; OSM fallback uses the apex host (a
  // *.tile.openstreetmap.org wildcard does NOT match the apex).
  "connect-src 'self' https://api.maptiler.com https://tile.openstreetmap.org https://*.upstash.io https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  "worker-src 'self' blob:",
  // Some browsers consult child-src for workers instead of worker-src.
  "child-src 'self' blob:",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
  // To ENFORCE later, rename this header to 'Content-Security-Policy'.
  { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
];

// The Telegram Mini App must be embeddable in Telegram's iframe (Telegram
// Web/Desktop). X-Frame-Options can't express "allow only telegram.org"
// reliably (ALLOW-FROM is dead), so we drop it on /tg and instead rely on
// frame-ancestors below — security for /tg comes from server-side initData
// validation, not from blocking embedding.
const tgFrameAncestors =
  "frame-ancestors 'self' https://telegram.org https://*.telegram.org https://web.telegram.org";

const tgCsp = cspReportOnly
  .split('; ')
  .map((d) => (d.startsWith('frame-ancestors') ? tgFrameAncestors : d))
  .join('; ');

const tgHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
  { key: 'Content-Security-Policy-Report-Only', value: tgCsp },
];

// Canonical host: the Vercel-assigned domain (benzeen-murex.vercel.app) issues
// a permanent (308) redirect to https://benzeen.uz for every path, so there is
// a single indexable origin and social/OG crawlers never see the *.vercel.app
// URL. Config redirects run before middleware and cover ALL paths, including
// /api and metadata routes that the i18n middleware matcher skips. Preview
// deployments (hashed *.vercel.app URLs) are unaffected — only the exact
// production alias matches.
const CANONICAL_HOST = 'benzeen.uz';
const VERCEL_HOST = 'benzeen-murex.vercel.app';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    // Car photos are stored on Vercel Blob (public bucket).
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: VERCEL_HOST }],
        destination: `https://${CANONICAL_HOST}/:path*`,
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      // Mini App routes: framing allowed for Telegram (no X-Frame-Options).
      {
        source: '/tg/:path*',
        headers: tgHeaders,
      },
      {
        source: '/tg',
        headers: tgHeaders,
      },
      // Everything else except /tg gets the strict headers (incl. XFO).
      {
        source: '/((?!tg$|tg/).*)',
        headers: securityHeaders,
      },
    ];
  },
};

const withSentry = (config: NextConfig): NextConfig =>
  withSentryConfig(config, {
    silent: !process.env.CI,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Upload source maps only when an auth token is present (i.e. prod CI).
    sourcemaps: {
      disable: !process.env.SENTRY_AUTH_TOKEN,
    },
    widenClientFileUpload: true,
    disableLogger: true,
  });

export default withSentry(withNextIntl(nextConfig));
