import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const segments = pathname.split('/').filter(Boolean);
  const locale = segments[0] && ['ru', 'en', 'uz'].includes(segments[0]) ? segments[0] : 'ru';
  const isProtected = pathname.includes('/dashboard');
  const isAuthPage =
    pathname.includes('/login') ||
    pathname.includes('/manager-login') ||
    pathname.includes('/driver-login') ||
    pathname.includes('/signup') ||
    pathname.includes('/forgot-password') ||
    pathname.includes('/reset-password');

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (isProtected && !token) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const managerOnlyPaths = [
    '/dashboard/cars',
    '/dashboard/drivers',
    '/dashboard/limits',
    '/dashboard/requests',
    '/dashboard/invoices',
    '/dashboard/admin',
    '/dashboard/companies',
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
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
