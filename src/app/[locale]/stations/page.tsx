import { getTranslations } from 'next-intl/server';
import { B2CHeader } from '@/components/b2c/header';
import { StationsNearby } from '@/components/b2c/stations-nearby';

// Модуль 1 ТЗ v2: карта подключённых АЗС с остатками топлива по данным датчиков
// в резервуарах.
export default async function StationsPage() {
  const t = await getTranslations('stations');

  return (
    <div className="min-h-screen bg-gray-50 text-navy dark:bg-navy-950 dark:text-white">
      <B2CHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <h1 className="text-title text-navy dark:text-white">{t('title')}</h1>
        <p className="mt-3 text-base text-gray-600 dark:text-gray-300">{t('subtitle')}</p>
        <div className="mt-6">
          <StationsNearby />
        </div>
      </main>
    </div>
  );
}
