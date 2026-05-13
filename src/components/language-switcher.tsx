'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ChevronDown, Languages } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

const LOCALES = [
  { code: 'ru' as const, label: 'RU' },
  { code: 'en' as const, label: 'EN' },
  { code: 'uz' as const, label: 'UZ' },
] as const;

const LOCALE_COOKIE = 'NEXT_LOCALE';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function setLocaleCookie(locale: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations('common');
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const segment = pathname.split('/').filter(Boolean)[0];
  const currentLocale = segment && (segment === 'ru' || segment === 'en' || segment === 'uz') ? segment : 'ru';
  const pathWithoutLocale = pathname.replace(/^\/(ru|en|uz)/, '') || '';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border border-gray-200/80 bg-white/80 px-3 py-2 text-sm font-medium',
          'text-gray-700 transition-colors hover:border-primary-500/40 hover:bg-primary-500/5 hover:text-primary-700',
          'dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-primary-400/30 dark:hover:bg-primary-500/10 dark:hover:text-primary-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language')}
      >
        <Languages className="h-4 w-4 opacity-70" aria-hidden />
        <span>{currentLocale.toUpperCase()}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <motion.ul
          role="listbox"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'absolute right-0 top-full z-50 mt-1.5 min-w-[7rem] rounded-xl border border-gray-200/80 bg-white py-1 shadow-lg',
            'dark:border-white/10 dark:bg-gray-900 dark:shadow-xl'
          )}
        >
          {LOCALES.map(({ code, label }) => {
            const isActive = currentLocale === code;
            const href = `/${code}${pathWithoutLocale}`;
            return (
              <li key={code} role="option" aria-selected={isActive}>
                <Link
                  href={href}
                  onClick={() => {
                    setLocaleCookie(code);
                    setOpen(false);
                  }}
                  className={cn(
                    'block px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary-500/10 font-medium text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  )}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
