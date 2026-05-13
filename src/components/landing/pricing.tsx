'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

const plans = ['starter', 'business', 'enterprise'] as const;

export function Pricing() {
  const t = useTranslations('pricing');
  const pathname = usePathname() ?? '';
  const locale = pathname.startsWith('/en') ? 'en' : pathname.startsWith('/uz') ? 'uz' : 'ru';

  return (
    <section id="pricing" className="relative border-b border-gray-200 dark:border-white/5 py-24 transition-colors duration-300">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl transition-colors duration-300">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
            {t('intro')}
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={`relative flex flex-col rounded-2xl border p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl ${
                plan === 'business'
                  ? 'border-primary-500/40 bg-primary-500/10 shadow-lg shadow-primary-500/10 hover:shadow-primary-500/20'
                  : 'border-gray-200 bg-white/80 dark:border-white/10 dark:bg-white/5 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-lg'
              }`}
            >
              {plan === 'business' && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-500 px-3 py-0.5 text-xs font-semibold text-white">
                  {t('popular')}
                </span>
              )}
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-300">{t(`${plan}.name`)}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">{t(`${plan}.desc`)}</p>
              <p className="mt-4 text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-300">{t(`${plan}.price`)}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {t(`${plan}.features`)
                  .split('\n')
                  .map((line, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" />
                      {line}
                    </li>
                  ))}
              </ul>
              <Button
                variant={plan === 'business' ? 'primary' : 'secondary'}
                className="mt-6 w-full border-gray-200 bg-gray-100 py-6 font-semibold text-gray-900 hover:bg-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 transition-colors duration-300"
                asChild
              >
                <Link href={`#contact`}>{t('cta')}</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
