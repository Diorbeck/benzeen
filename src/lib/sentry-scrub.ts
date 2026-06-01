import type { ErrorEvent, EventHint } from '@sentry/nextjs';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// E.164-ish / local phone numbers (7+ digits, optional +, spaces, dashes).
const PHONE_RE = /\+?\d[\d\s()-]{6,}\d/g;

function redact(value: string): string {
  return value.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[phone]');
}

/**
 * Strips PII (emails, phone numbers) and request identity data from Sentry
 * events before they leave the process. Used by all runtimes.
 */
export function scrubEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent {
  // Never attach user identity.
  delete event.user;

  // Drop request cookies / headers (may carry tokens, IPs, identifiers).
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = redact(event.request.query_string);
    }
    if (typeof event.request.data === 'string') {
      event.request.data = redact(event.request.data);
    }
  }

  // Redact PII inside exception messages.
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = redact(ex.value);
    }
  }
  if (typeof event.message === 'string') {
    event.message = redact(event.message);
  }

  return event;
}
