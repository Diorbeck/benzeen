'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Shield, Eye, FileText, Truck } from 'lucide-react';

const benefits = [
  { icon: Shield, key: 'costControl' as const },
  { icon: Eye, key: 'visibility' as const },
  { icon: FileText, key: 'reports' as const },
  { icon: Truck, key: 'delivery' as const },
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

export function Benefits() {
  const t = useTranslations('benefits');

  return (
    <section className="relative border-b border-gray-200 dark:border-white/5 py-24 transition-colors duration-300">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl transition-colors duration-300"
        >
          {t('title')}
        </motion.h2>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {benefits.map(({ icon: Icon, key }) => (
            <motion.div
              key={key}
              variants={item}
              className="group rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary-500/20 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.07] dark:hover:shadow-primary-500/5"
            >
              <div className="mb-4 inline-flex rounded-xl bg-primary-500/20 p-3 text-primary-500 transition duration-300 group-hover:bg-primary-500/30 group-hover:shadow-lg group-hover:shadow-primary-500/20 dark:text-primary-400">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">{t(`${key}.title`)}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">{t(`${key}.desc`)}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
