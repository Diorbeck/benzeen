import { FuelingLive } from '@/components/b2c/fueling-live';
import { StationFuelingAppOnly } from '@/components/b2c/app-only-notice';
import { STATION_FUELING_WEB_ENABLED } from '@/lib/features';

// Живой экран заправки: литры и сумма с колонки в реальном времени (Модуль 2).
// Мобильный экран со своей шапкой «назад» — без общего хедера.
export default async function FuelingLivePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  return STATION_FUELING_WEB_ENABLED ? (
    <FuelingLive sessionId={id} />
  ) : (
    <div className="min-h-screen bg-canvas text-navy dark:bg-navy-950 dark:text-white">
      <StationFuelingAppOnly locale={locale} />
    </div>
  );
}
