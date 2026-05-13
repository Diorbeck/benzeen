'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Car, Fuel, TrendingUp } from 'lucide-react';

export function Hero() {
  const t = useTranslations('hero');
  const pathname = usePathname() ?? '';
  const locale = pathname.startsWith('/en') ? 'en' : pathname.startsWith('/uz') ? 'uz' : 'ru';

  return (
    <section
      id="hero-start"
      className="relative min-h-[92vh] overflow-hidden border-b border-gray-200 bg-transparent pt-24 pb-16 sm:pb-24 dark:border-white/5 dark:bg-transparent transition-colors duration-300"
    >
      <div className="absolute inset-0 bg-[linear-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.08),transparent)] dark:bg-[linear-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.15),transparent)]" />
      <div className="absolute inset-0 bg-grid opacity-20 dark:opacity-40" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.45fr_0.55fr] lg:gap-16 lg:items-center">
          <div className="min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-1.5 text-sm font-medium text-primary-600 dark:border-primary-500/20 dark:text-primary-400"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
              </span>
              {t('badge')}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white transition-colors duration-300"
            >
              {t('headline')}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-6 max-w-xl text-lg text-gray-600 dark:text-gray-400 transition-colors duration-300"
            >
              {t('subtext')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <Button
                variant="secondary"
                size="lg"
                className="rounded-xl border-white/10 bg-white/5 px-6 py-6 text-base font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10"
                asChild
              >
                <Link href="#dashboard-preview">{t('cta.secondary')}</Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-12 flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-500"
            >
              <span>{t('highlights.fuels')}</span>
              <span>{t('highlights.payment')}</span>
              <span>{t('highlights.limits')}</span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden min-w-0 lg:block"
          >
            {/* Floating activity cards */}
            <div className="absolute -left-4 top-8 z-10 hidden xl:block">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 }}
                className="rounded-xl border border-emerald-500/30 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:bg-gray-900/95 transition-colors duration-300"
              >
                <span className="text-emerald-500 dark:text-emerald-400">●</span>{' '}
                <span className="text-gray-900 dark:text-white">{t('notificationApproved')}</span>
              </motion.div>
            </div>
            <div className="absolute -right-2 top-24 z-10 hidden xl:block">
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 }}
                className="rounded-xl border border-primary-500/30 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:bg-gray-900/95 transition-colors duration-300"
              >
                <span className="text-primary-500 dark:text-primary-400">●</span>{' '}
                <span className="text-gray-900 dark:text-white">{t('notificationScheduled')}</span>
              </motion.div>
            </div>
            <div className="absolute bottom-20 -right-4 z-10 hidden xl:block">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4 }}
                className="rounded-xl border border-amber-500/30 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:bg-gray-900/95 transition-colors duration-300"
              >
                <span className="text-amber-500 dark:text-amber-400">●</span>{' '}
                <span className="text-gray-900 dark:text-white">{t('notificationLimitUpdated')}</span>
              </motion.div>
            </div>
            <div className="relative rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-2xl shadow-gray-200/50 backdrop-blur dark:border-white/10 dark:bg-gray-900/80 dark:shadow-black/40 transition-colors duration-300">
              <div className="mb-3 flex items-center gap-2 border-b border-gray-200 pb-3 dark:border-white/5">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="ml-2 text-xs text-gray-500">Dashboard</span>
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Remaining', value: '1,240 L', icon: Fuel },
                    { label: 'Active', value: '12', icon: Car },
                    { label: 'Pending', value: '3', icon: TrendingUp },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.08 }}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/5 dark:bg-white/5"
                    >
                      <item.icon className="mb-1 h-4 w-4 text-primary-500 dark:text-primary-400" />
                      <p className="text-[10px] font-medium text-gray-500">{item.label}</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.value}</p>
                    </motion.div>
                  ))}
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/5 dark:bg-white/5">
                  <p className="mb-2 text-[10px] font-medium text-gray-500">Fleet overview</p>
                  <div className="space-y-1.5">
                    {['TRK-102 · 45L / 165L', 'TRK-215 · 32L / 112L', 'TRK-088 · 78L / 200L'].map(
                      (row, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-gray-100 px-2 py-1.5 text-xs text-gray-700 dark:bg-white/5 dark:text-gray-300"
                        >
                          <span>{row.split(' · ')[0]}</span>
                          <span className="text-gray-500">{row.split(' · ')[1]}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
                <div className="h-16 rounded-xl border border-gray-100 bg-gray-50 p-2 dark:border-white/5 dark:bg-white/5">
                  <div className="flex h-full items-end gap-1">
                    {[40, 65, 35, 80, 55, 70].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: 0.6 + i * 0.05, duration: 0.4 }}
                        className="flex-1 rounded bg-primary-500/60"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -inset-1 -z-10 rounded-3xl bg-primary-500/10 blur-2xl" />
          </motion.div>
        </div>
      </div>

    </section>
  );
}
