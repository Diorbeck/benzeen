'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fuel, Menu, X, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

const navLinks = [
  { href: '#features', key: 'features' as const },
  { href: '#how-it-works', key: 'howItWorks' as const },
  { href: '#interactive-demo', key: 'demo' as const },
  { href: '#contact', key: 'contact' as const },
] as const;

export function Header() {
  const t = useTranslations('common');
  const tNav = useTranslations('common.nav');
  const pathname = usePathname() ?? '';
  const locale = pathname.startsWith('/en') ? 'en' : pathname.startsWith('/uz') ? 'uz' : 'ru';
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur-xl dark:border-white/5 dark:bg-gray-950/80 transition-colors duration-300"
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950 rounded-lg"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500">
            <Fuel className="h-5 w-5 text-white" aria-hidden />
          </div>
          <span className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
            {t('appName')}
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map(({ href, key }) => (
            <Link
              key={key}
              href={href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              {tNav(key)}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:block" />
          <ThemeToggle className="hidden sm:flex" />
          <a
            href="tel:+998970808880"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:text-primary-600 lg:inline-flex dark:text-gray-300 dark:hover:text-primary-400"
          >
            <Phone className="h-4 w-4" aria-hidden />
            +998 97 080 88 80
          </a>
          <Button variant="secondary" size="sm" className="hidden border-gray-200 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 sm:inline-flex" asChild>
            <Link href={`/${locale}/login`}>{t('cta.signIn')}</Link>
          </Button>
          <Button size="sm" className="hidden bg-primary-500 font-semibold text-white hover:bg-primary-400 sm:inline-flex" asChild>
            <Link href="#contact">{t('cta.getStarted')}</Link>
          </Button>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white md:hidden transition-colors"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-200 dark:border-white/5 md:hidden"
          >
            <div className="flex flex-col gap-1 bg-white px-4 py-4 dark:bg-gray-950 transition-colors duration-300">
              {navLinks.map(({ href, key }) => (
                <Link
                  key={key}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
                >
                  {tNav(key)}
                </Link>
              ))}
              <div className="mt-2 flex items-center gap-2 border-t border-gray-200 dark:border-white/5 pt-3">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              <a
                href="tel:+998970808880"
                onClick={() => setMobileOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 transition-colors"
              >
                <Phone className="h-4 w-4" aria-hidden />
                +998 97 080 88 80
              </a>
              <Button variant="secondary" className="mt-2 w-full border-gray-200 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10" asChild>
                <Link href={`/${locale}/login`} onClick={() => setMobileOpen(false)}>
                  {t('cta.signIn')}
                </Link>
              </Button>
              <Button className="mt-2 w-full bg-primary-500 font-semibold text-white hover:bg-primary-400" asChild>
                <Link href="#contact" onClick={() => setMobileOpen(false)}>
                  {t('cta.getStarted')}
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
