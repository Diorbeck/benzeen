// Edge-safe rate limiting for auth endpoints.
// Uses Upstash Redis + sliding window (5 requests / 60s per IP).
// Graceful degradation: if env is not configured, limiting is disabled
// (a one-time warning is logged) and requests are always allowed.
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms when the window resets
};

let limiter: Ratelimit | null = null;
let warned = false;

function getLimiter(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (!warned) {
      warned = true;
      console.warn(
        '[ratelimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — auth rate limiting is DISABLED.',
      );
    }
    return null;
  }

  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(5, '60 s'),
      prefix: 'benzeen:auth',
      analytics: false,
    });
  }
  return limiter;
}

/**
 * Checks the auth rate limit for the given identifier (usually client IP).
 * Returns null when limiting is disabled (no env) — callers should allow.
 */
export async function checkAuthRateLimit(
  identifier: string,
): Promise<LimitResult | null> {
  const rl = getLimiter();
  if (!rl) return null;
  try {
    const res = await rl.limit(identifier);
    return {
      success: res.success,
      limit: res.limit,
      remaining: res.remaining,
      reset: res.reset,
    };
  } catch (e) {
    // Never block auth because the limiter backend is down.
    console.error('[ratelimit] backend error, allowing request:', e);
    return null;
  }
}

/** Best-effort client IP extraction behind Cloudflare + Railway. */
export function clientIpFromHeaders(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}
