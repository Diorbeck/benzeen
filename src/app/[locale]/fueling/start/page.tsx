import { FuelingStart } from '@/components/b2c/fueling-start';
import { StationFuelingAppOnly } from '@/components/b2c/app-only-notice';
import { STATION_FUELING_WEB_ENABLED } from '@/lib/features';

// Пошаговое подтверждение заправки: колонка → топливо → объём → оплата
// (Модули 3 и 4). Экран мобильный, со своей шапкой «назад» — без общего хедера.
export default async function FuelingStartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return STATION_FUELING_WEB_ENABLED ? (
    <FuelingStart />
  ) : (
    <div className="min-h-screen bg-canvas text-navy dark:bg-navy-950 dark:text-white">
      <StationFuelingAppOnly locale={locale} />
    </div>
  );
}
