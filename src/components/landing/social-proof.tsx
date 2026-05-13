'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Truck, Car, Package, HardHat } from 'lucide-react';

const companies = [
  { key: 'logistics' as const, icon: Truck },
  { key: 'taxi' as const, icon: Car },
  { key: 'delivery' as const, icon: Package },
  { key: 'construction' as const, icon: HardHat },
];

export function SocialProof() {
  const t = useTranslations('socialProof');

  return (
    <section className="relative border-b border-gray-200 dark:border-white/5 py-24 transition-colors duration-300">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center text-xl font-medium text-gray-600 dark:text-gray-400 sm:text-2xl transition-colors duration-300"
        >
          {t('title')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 lg:gap-16"
        >
          {companies.map(({ key, icon: Icon }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-8 py-6 transition duration-300 hover:border-white/20 hover:bg-white/[0.07] hover:shadow-lg"
            >
              <Icon className="h-8 w-8 text-gray-500 grayscale transition duration-300 hover:grayscale-0" aria-hidden />
              <span className="text-sm font-medium text-gray-500">{t(key)}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
