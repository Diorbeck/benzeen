import { B2CHeader } from '@/components/b2c/header';
import { FuelingLive } from '@/components/b2c/fueling-live';

// Живой экран заправки: литры и сумма с колонки в реальном времени (Модуль 2).
export default async function FuelingLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-gray-50 text-navy dark:bg-navy-950 dark:text-white">
      <B2CHeader />
      <main>
        <FuelingLive sessionId={id} />
      </main>
    </div>
  );
}
