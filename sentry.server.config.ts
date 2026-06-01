// Sentry initialization for the Node.js server runtime.
// DSN is read from env; when unset, Sentry stays inert (no-op) so local/dev
// and unconfigured deploys never error.
import * as Sentry from '@sentry/nextjs';

import { scrubEvent } from '@/lib/sentry-scrub';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  // Keep traces light in prod; tune via env if needed.
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  // Never auto-attach IP / cookies / user data.
  sendDefaultPii: false,
  // Strip residual PII (emails, phones) and request identity before send.
  beforeSend: scrubEvent,
  enabled: Boolean(dsn),
});
