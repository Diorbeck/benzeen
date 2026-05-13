'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Fuel, UserCheck, Truck, FileBarChart } from 'lucide-react';

const steps = [
  { icon: Fuel, titleKey: 'step1.title' as const, descKey: 'step1.desc' as const },
  { icon: UserCheck, titleKey: 'step2.title' as const, descKey: 'step2.desc' as const },
  { icon: Truck, titleKey: 'step3.title' as const, descKey: 'step3.desc' as const },
  { icon: FileBarChart, titleKey: 'step4.title' as const, descKey: 'step4.desc' as const },
];

export function HowItWorks() {
  const t = useTranslations('howItWorks');

  return (
    <section id="how-it-works" className="relative border-b border-gray-200 dark:border-white/5 py-24 transition-colors duration-300">
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

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.titleKey}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group relative rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.07] dark:hover:shadow-primary-500/5"
            >
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/20 text-primary-500 transition group-hover:bg-primary-500/30 dark:text-primary-400">
                <step.icon className="h-5 w-5" />
              </span>
              <span className="mb-2 block text-xs font-semibold text-primary-500 dark:text-primary-400">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">{t(step.titleKey)}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">{t(step.descKey)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
