import { Package } from 'lucide-react';

type Row = {
  id: string;
  company: string;
  plateNumber: string;
  fuelType: string;
  volume: number;
  status: string;
  address: string | null;
  createdAt: string;
  createdBy: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  CREATED: 'В ожидании',
  RECEIVED: 'Принят',
  COURIER_ASSIGNED: 'Назначен курьер',
  IN_DELIVERY: 'В пути',
};

const STATUS_CLASS: Record<string, string> = {
  CREATED: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  RECEIVED: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  COURIER_ASSIGNED: 'bg-primary-500/10 text-primary-600 dark:text-primary-400',
  IN_DELIVERY: 'bg-primary-500/10 text-primary-600 dark:text-primary-400',
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export function RequestsTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="card-premium flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-2xl bg-primary-500/10 p-4">
          <Package className="h-10 w-10 text-primary-600 dark:text-primary-400" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Активных заявок нет.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Активных заявок: <span className="font-semibold text-gray-900 dark:text-white">{rows.length}</span>
      </p>
      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200/60 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-white/[0.07] dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Компания</th>
                <th className="px-4 py-3">Машина</th>
                <th className="px-4 py-3">Топливо</th>
                <th className="px-4 py-3 text-right">Литры</th>
                <th className="px-4 py-3">Адрес</th>
                <th className="px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100/80 last:border-0 hover:bg-gray-50/80 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.company}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{r.plateNumber}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.fuelType.replace('_', '-')}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{r.volume}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs text-gray-500 dark:text-gray-400" title={r.address ?? undefined}>
                    {r.address ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[r.status] ?? 'bg-gray-500/15 text-gray-600 dark:text-gray-400'}`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
