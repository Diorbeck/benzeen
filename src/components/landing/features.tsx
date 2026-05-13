'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Gauge, UserPlus, MapPin, FileText, BarChart3 } from 'lucide-react';

const features = [
  { icon: Gauge, titleKey: 'limits.title' as const, descKey: 'limits.desc' as const },
  {
    icon: UserPlus,
    titleKey: 'driverOrdering.title' as const,
    descKey: 'driverOrdering.desc' as const,
  },
  { icon: MapPin, titleKey: 'delivery.title' as const, descKey: 'delivery.desc' as const },
  { icon: FileText, titleKey: 'invoices.title' as const, descKey: 'invoices.desc' as const },
  { icon: BarChart3, titleKey: 'analytics.title' as const, descKey: 'analytics.desc' as const },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function Features() {
  const t = useTranslations('features');

  return (
    <section id="features" className="relative border-b border-gray-200 dark:border-white/5 py-24 transition-colors duration-300">
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
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.slice(0, 3).map(({ icon: Icon, titleKey, descKey }) => (
            <motion.div
              key={titleKey}
              variants={item}
              className="group rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.07] dark:hover:shadow-primary-500/5"
            >
              <div className="mb-4 inline-flex rounded-xl bg-primary-500/20 p-3 text-primary-500 transition group-hover:bg-primary-500/30 dark:text-primary-400">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">{t(titleKey)}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">{t(descKey)}</p>
            </motion.div>
          ))}
          {features.slice(3).map(({ icon: Icon, titleKey, descKey }) => (
            <motion.div
              key={titleKey}
              variants={item}
              className="group rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.07] dark:hover:shadow-primary-500/5"
            >
              <div className="mb-4 inline-flex rounded-xl bg-primary-500/20 p-3 text-primary-500 transition group-hover:bg-primary-500/30 dark:text-primary-400">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">{t(titleKey)}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">{t(descKey)}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
