'use client';

import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('common');
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200/80 bg-white/80 dark:border-white/10 dark:bg-white/5',
          className
        )}
        aria-hidden
      >
        <span className="h-4 w-4" />
      </div>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200/80 bg-white/80 transition-colors',
        'hover:border-primary-500/40 hover:bg-primary-500/5 hover:text-primary-600',
        'dark:border-white/10 dark:bg-white/5 dark:hover:border-primary-400/30 dark:hover:bg-primary-500/10 dark:hover:text-primary-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900',
        className
      )}
      aria-label={isDark ? t('light') : t('dark')}
    >
      <motion.span
        initial={false}
        animate={{ rotate: isDark ? 0 : 180 }}
        transition={{ duration: 0.2 }}
      >
        {isDark ? (
          <Sun className="h-4 w-4" aria-hidden />
        ) : (
          <Moon className="h-4 w-4" aria-hidden />
        )}
      </motion.span>
    </button>
  );
}
