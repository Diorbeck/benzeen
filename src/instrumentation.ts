import * as Sentry from '@sentry/nextjs';

// Next.js calls register() once per server runtime on startup. We load the
// matching Sentry config so both the Node.js and Edge runtimes are covered.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// Captures errors thrown inside React Server Components / route handlers.
export const onRequestError = Sentry.captureRequestError;
