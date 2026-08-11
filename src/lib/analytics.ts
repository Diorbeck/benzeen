// Provider-agnostic analytics (design-pass). No vendor lock-in: register a
// provider (GA/Amplitude/PostHog/…) later via setAnalyticsProvider. Never pass
// PII (phone, exact address, name) in event props — only coarse, safe values.

export type AnalyticsEvent =
  | 'home_viewed'
  | 'gasoline_order_clicked'
  | 'propane_points_clicked'
  | 'order_started'
  | 'order_repeat_last'
  | 'order_new_after_fork'
  | 'vehicle_selected'
  | 'fuel_selected'
  | 'volume_selected'
  | 'address_selected'
  | 'order_price_calculated'
  | 'order_submitted'
  | 'order_failed'
  | 'login_clicked'
  | 'language_changed'
  | 'propane_slot_booked'
  | 'propane_booking_cancelled';

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsProvider {
  track(event: AnalyticsEvent, props?: AnalyticsProps): void;
}

const noopProvider: AnalyticsProvider = { track() {} };
let provider: AnalyticsProvider = noopProvider;

export function setAnalyticsProvider(p: AnalyticsProvider): void {
  provider = p;
}

/** Fire an event. Safe: swallows provider errors; logs in dev. */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  try {
    provider.track(event, props);
  } catch {
    /* analytics must never break the app */
  }
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, props ?? {});
  }
}
