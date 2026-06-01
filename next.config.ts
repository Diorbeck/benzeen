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
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // API / telemetry endpoints the app talks to:
  "connect-src 'self' https://*.upstash.io https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  // To ENFORCE later, rename this header to 'Content-Security-Policy'.
  { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
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
