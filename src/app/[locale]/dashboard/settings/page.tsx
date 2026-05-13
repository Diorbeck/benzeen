import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SettingsPanel } from '@/components/dashboard/settings-panel';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Настройки
      </h1>
      <SettingsPanel user={session?.user} />
    </div>
  );
}
