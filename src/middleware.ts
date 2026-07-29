import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { routing } from '@/i18n/routing';
import { checkAuthRateLimit, clientIpFromHeaders } from '@/lib/ratelimit';
import { B2B_ENABLED } from '@/lib/features';

// B2B surfaces hidden behind the feature flag. When B2B is OFF these paths
// (company registration, driver login, company/admin B2B management, invoices)
// redirect to the landing page. Courier and SUPER_ADMIN core routes are NOT
// listed here — they stay available in B2C.
const B2B_PATHS = [
  '/driver-login',
  '/signup',
  '/dashboard/companies',
  '/dashboard/cars',
  '/dashboard/drivers',
  '/dashboard/limits',
  '/dashboard/my-limit',
  '/dashboard/my-vehicle',
  '/dashboard/requests',
  '/dashboard/invoices',
  '/dashboard/history',
];

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rate-limit auth endpoints (brute-force protection). Only POSTs are limited
  // so normal session/csrf polling (GET) is never throttled.
  if (pathname.startsWith('/api/auth')) {
    if (request.method === 'POST') {
      const ip = clientIpFromHeaders(request.headers);
      const result = await checkAuthRateLimit(ip);
      if (result && !result.success) {
        const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
        return NextResponse.json(
          { error: 'Too many attempts. Please try again later.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(result.limit),
              'X-RateLimit-Remaining': String(result.remaining),
            },
          },
        );
      }
    }
    return NextResponse.next();
  }

  // Telegram Mini App lives outside i18n routing — never locale-redirect it.
  if (pathname === '/tg' || pathname.startsWith('/tg/')) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter(Boolean);
  const locale = segments[0] && ['ru', 'en', 'uz'].includes(segments[0]) ? segments[0] : 'ru';

  // Hide B2B surfaces when the flag is off — send visitors back to the landing.
  if (!B2B_ENABLED && B2B_PATHS.some((p) => pathname.includes(p))) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  const isProtected = pathname.includes('/dashboard');
  const isAccount = pathname.includes('/account');
  const isAuthPage =
    pathname.includes('/login') ||
    pathname.includes('/manager-login') ||
    pathname.includes('/driver-login') ||
    pathname.includes('/client-login') ||
    pathname.includes('/signup') ||
    pathname.includes('/forgot-password') ||
    pathname.includes('/reset-password');

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Client cabinet (/account): CLIENT role only.
  if (isAccount) {
    if (!token) {
      const loginUrl = new URL(`/${locale}/client-login`, request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if ((token as { role?: string }).role !== 'CLIENT') {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }
    return intlMiddleware(request);
  }

  if (isProtected && !token) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Clients never use the staff dashboard — route them to their cabinet.
  if (isProtected && token && (token as { role?: string }).role === 'CLIENT') {
    return NextResponse.redirect(new URL(`/${locale}/account`, request.url));
  }

  // Company cabinets (COMPANY_ADMIN / DRIVER) are part of B2B — off with the flag.
  if (!B2B_ENABLED && isProtected && token) {
    const r = (token as { role?: string }).role;
    if (r === 'COMPANY_ADMIN' || r === 'DRIVER') {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
  }

  const managerOnlyPaths = [
    '/dashboard/cars',
    '/dashboard/drivers',
    '/dashboard/limits',
    '/dashboard/requests',
    '/dashboard/invoices',
    '/dashboard/admin',
    '/dashboard/companies',
    '/dashboard/audit',
  ];
  const deliveriesPath = pathname.includes('/dashboard/deliveries');
  const driverOnlyPaths = ['/dashboard/my-vehicle', '/dashboard/my-limit'];
  const dispatcherOnlyPaths = ['/dashboard/dispatcher'];
  const role = (token as { role?: string })?.role;
  const isManagerRoute = managerOnlyPaths.some((p) => pathname.includes(p));
  const isDriverOnlyRoute = driverOnlyPaths.some((p) => pathname.includes(p));
  const isDispatcherRoute = dispatcherOnlyPaths.some((p) => pathname.includes(p));
  if (isProtected && token && role === 'DRIVER' && isManagerRoute) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }
  if (isProtected && token && role === 'DRIVER' && isDispatcherRoute) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }
  if (isProtected && token && role !== 'DRIVER' && role !== 'COURIER' && isDriverOnlyRoute) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }
  if (isProtected && token && role !== 'DISPATCHER' && role !== 'SUPER_ADMIN' && isDispatcherRoute) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }
  if (isProtected && token && role === 'DISPATCHER' && isManagerRoute) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }
  if (isProtected && token && role === 'COMPANY_ADMIN' && deliveriesPath) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  if (isAuthPage && token) {
    const dest =
      (token as { role?: string }).role === 'CLIENT'
        ? `/${locale}/account`
        : `/${locale}/dashboard`;
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|tg$|tg/|.*\\..*).*)',
    '/api/auth/:path*',
  ],
};
