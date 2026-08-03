'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tri-state theme toggle: system → light → dark → system. Default is system
// (prefers-color-scheme); the choice persists (next-themes localStorage) and is
// applied before first paint (next-themes injects the no-FOUC script).
const ORDER = ['system', 'light', 'dark'] as const;
type Mode = (typeof ORDER)[number];

export function B2CThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('common');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current: Mode = mounted && (ORDER as readonly string[]).includes(theme ?? '') ? (theme as Mode) : 'system';
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === 'dark' ? Moon : current === 'light' ? Sun : Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={t('theme')}
      title={t('theme')}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-control border border-gray-200 bg-white text-gray-600 transition-colors',
        'hover:border-primary-500/40 hover:text-primary-600',
        'dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:text-primary-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        className,
      )}
    >
      {mounted ? <Icon className="h-4 w-4" aria-hidden /> : <span className="h-4 w-4" />}
    </button>
  );
}
