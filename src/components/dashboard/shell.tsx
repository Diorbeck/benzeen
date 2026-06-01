'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fuel,
  LogOut,
  LayoutDashboard,
  Car,
  Users,
  Package,
  FileText,
  Settings,
  Menu,
  X,
  Building2,
  Gauge,
  ClipboardList,
  Truck,
  BarChart3,
  Bike,
  ScrollText,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { NotificationBell } from './notification-bell';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { cn } from '@/lib/utils';

type NavKey =
  | 'overview'
  | 'admin'
  | 'companies'
  | 'cars'
  | 'drivers'
  | 'orders'
  | 'limits'
  | 'requests'
  | 'deliveries'
  | 'reports'
  | 'invoices'
  | 'couriers'
  | 'audit'
  | 'settings'
  | 'myCars'
  | 'myVehicle'
  | 'createOrder'
  | 'myOrders'
  | 'myLimit'
  | 'notifications'
  | 'dispatcherNewOrders'
  | 'dispatcherAssign'
  | 'dispatcherActive'
  | 'dispatcherCompleted';

const navByRole: Record<
  string,
  { path: string; labelKey: NavKey; icon: React.ComponentType<{ className?: string }> }[]
> = {
  SUPER_ADMIN: [
    { path: '', labelKey: 'overview', icon: LayoutDashboard },
    { path: '/companies', labelKey: 'companies', icon: Building2 },
    { path: '/requests', labelKey: 'requests', icon: ClipboardList },
    { path: '/deliveries', labelKey: 'deliveries', icon: Truck },
    { path: '/invoices', labelKey: 'reports', icon: BarChart3 },
    { path: '/couriers', labelKey: 'couriers', icon: Bike },
    { path: '/audit', labelKey: 'audit', icon: ScrollText },
    { path: '/settings', labelKey: 'settings', icon: Settings },
  ],
  COMPANY_ADMIN: [
    { path: '', labelKey: 'overview', icon: LayoutDashboard },
    { path: '/cars', labelKey: 'cars', icon: Car },
    { path: '/drivers', labelKey: 'drivers', icon: Users },
    { path: '/limits', labelKey: 'limits', icon: Gauge },
    { path: '/orders', labelKey: 'orders', icon: Package },
    { path: '/settings', labelKey: 'settings', icon: Settings },
  ],
  DISPATCHER: [
    { path: '', labelKey: 'dispatcherNewOrders', icon: Package },
    { path: '/dispatcher/assign', labelKey: 'dispatcherAssign', icon: Users },
    { path: '/dispatcher/active', labelKey: 'dispatcherActive', icon: Truck },
    { path: '/dispatcher/completed', labelKey: 'dispatcherCompleted', icon: FileText },
    { path: '/settings', labelKey: 'settings', icon: Settings },
  ],
  DRIVER: [
    { path: '', labelKey: 'overview', icon: LayoutDashboard },
    { path: '/my-vehicle', labelKey: 'myVehicle', icon: Car },
    { path: '/orders/new', labelKey: 'createOrder', icon: Package },
    { path: '/orders', labelKey: 'myOrders', icon: ClipboardList },
    { path: '/my-limit', labelKey: 'myLimit', icon: Gauge },
    { path: '/notifications', labelKey: 'notifications', icon: FileText },
    { path: '/settings', labelKey: 'settings', icon: Settings },
  ],
  COURIER: [
    { path: '', labelKey: 'overview', icon: LayoutDashboard },
    { path: '/orders', labelKey: 'orders', icon: Package },
    { path: '/settings', labelKey: 'settings', icon: Settings },
  ],
};

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null; role?: string };
}) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const pathname = usePathname() ?? '';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const locale = pathname.split('/')[1] || 'ru';
  const base = `/${locale}/dashboard`;
  const navItems = navByRole[user.role || ''] || navByRole.COMPANY_ADMIN;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white dark:border-white/5 dark:bg-gray-900/95 dark:backdrop-blur-md">
        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href={base} className="flex items-center gap-2 transition-opacity hover:opacity-90">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600">
                <Fuel className="h-5 w-5 text-white" aria-hidden />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">{tCommon('appName')}</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="hidden sm:block" />
            <ThemeToggle className="hidden sm:flex" />
            <NotificationBell />
            <span className="hidden max-w-[140px] truncate text-sm text-gray-500 dark:text-gray-400 sm:block">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `/${locale}` })}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/20 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <div className="flex flex-1">
        <aside
          className={cn(
            'flex-shrink-0 w-56 border-r border-gray-200 bg-white dark:border-white/5 dark:bg-gray-900/50',
            mobileMenuOpen ? 'fixed inset-y-0 left-0 z-40 md:relative' : 'hidden md:block',
          )}
        >
          <nav className="space-y-0.5 p-4 pt-20 md:pt-4" aria-label="Dashboard navigation">
            {navItems.map((item) => {
              const href = `${base}${item.path}`;
              const isActive =
                pathname === href || (item.path !== '' && pathname?.startsWith(href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5',
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {t(`nav.${item.labelKey}`)}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-gray-200 px-4 py-3 dark:border-white/5 md:hidden">
            <LanguageSwitcher />
            <div className="mt-2">
              <ThemeToggle />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
