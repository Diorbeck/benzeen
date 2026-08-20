import { StationsMapScreen } from '@/components/b2c/stations-map-screen';

// Экран «Карта» мобильного сценария заправки (Модули 1 и 3 ТЗ v2): карта во
// весь экран с точками подключённых АЗС, снизу — перетаскиваемая шторка со
// списком ближайших. Тап по точке раскрывает карточку АЗС с кнопкой
// «Заправиться».
export default async function StationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <StationsMapScreen locale={locale} />;
}
