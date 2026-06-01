// Sentry initialization for the browser. Only the public DSN is exposed here.
import * as Sentry from '@sentry/nextjs';

import { scrubEvent } from '@/lib/sentry-scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  tracesSampleRate: Number(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1',
  ),
  // No session replay / PII by default.
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  enabled: Boolean(dsn),
});

// Lets Sentry instrument client-side navigations (App Router).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
