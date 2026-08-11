import Link from 'next/link';
import Image from 'next/image';
import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bonusBalanceFrom } from '@/lib/bonus';
import { evaluateReferrerFlags, type FirstOrderSignal } from '@/lib/fraud';
import { BonusAdminActions } from '@/components/dashboard/bonus-admin-actions';
import { ClientDelete } from '@/components/dashboard/client-delete';
import { ArrowLeft, AlertTriangle, Car, MapPin, Package, Gift } from 'lucide-react';

const dtf = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

export default async function ClientCardPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);
  const { role } = session.user as { role?: string };
  if (role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('adminBonus');

  const client = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      lastName: true,
      phone: true,
      bonusFrozen: true,
      deletedAt: true,
      clientCars: {
        select: {
          id: true,
          plate: true,
          brand: true,
          model: true,
          color: true,
          fuelType: true,
          oilType: true,
          tankCapacity: true,
          photoUrl: true,
        },
      },
      savedLocations: { select: { id: true, name: true, lat: true, lng: true } },
      clientOrders: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, fuelType: true, volume: true, status: true, totalAmount: true, createdAt: true },
      },
      bonusLedger: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, liters: true, reason: true, status: true, adminComment: true, createdAt: true },
      },
      referredBy: { select: { id: true, name: true, phone: true } },
      referrals: {
        select: {
          id: true,
          name: true,
          phone: true,
          clientOrders: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: {
              status: true,
              lat: true,
              lng: true,
              assignedToId: true,
              createdAt: true,
              deliveredAt: true,
              clientCar: { select: { plate: true } },
            },
          },
        },
      },
    },
  });

  if (!client) notFound();

  const balance = bonusBalanceFrom(client.bonusLedger);

  // Anti-fraud signals over this referrer's referred-friend FIRST orders. TAKE
  // timestamps are not persisted, so createdAt→deliveredAt is used as the
  // close-time proxy. Flags HIGHLIGHT only — nothing is auto-blocked.
  const signals: FirstOrderSignal[] = client.referrals
    .map((r) => r.clientOrders[0])
    .filter((o): o is NonNullable<typeof o> => !!o)
    .map((o) => ({
      clientId: id,
      lat: o.lat,
      lng: o.lng,
      plate: o.clientCar?.plate ?? null,
      courierId: o.assignedToId,
      closeMs: o.deliveredAt ? o.deliveredAt.getTime() - o.createdAt.getTime() : null,
    }));
  const flags = evaluateReferrerFlags(signals);
  const activeFlags = [
    flags.sharedAddress && t('flagAddress'),
    flags.sharedPlate && t('flagPlate'),
    flags.sharedCourier && t('flagCourier'),
    flags.fastCourierCloses && t('flagFastClose'),
  ].filter(Boolean) as string[];

  const fullName = [client.name, client.lastName].filter(Boolean).join(' ') || '—';

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/dashboard/clients`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400"
      >
        <ArrowLeft className="h-4 w-4" /> {t('back')}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{fullName}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('phone')}: {client.phone ?? '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {balance} <span className="text-base font-medium">{t('liters')}</span>
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">{t('balance')}</p>
        </div>
      </div>

      {activeFlags.length > 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" /> {t('fraudTitle')}
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-600/90 dark:text-red-400/90">
            {activeFlags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Admin actions */}
        <BonusAdminActions userId={client.id} frozen={client.bonusFrozen} />

        {/* Referrals */}
        <div className="card-premium space-y-3 p-5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('whoReferred')}:{' '}
            <span className="font-normal text-gray-600 dark:text-gray-300">
              {client.referredBy ? client.referredBy.name || client.referredBy.phone : t('none')}
            </span>
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('whoTheyReferred')}</p>
          {client.referrals.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('none')}</p>
          ) : (
            <ul className="space-y-1.5">
              {client.referrals.map((r) => {
                const first = r.clientOrders[0];
                const delivered = first?.status === 'DELIVERED';
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-gray-700 dark:text-gray-200">
                      {r.name || r.phone || '—'}
                    </span>
                    <span
                      className={
                        delivered
                          ? 'shrink-0 text-xs text-emerald-600 dark:text-emerald-400'
                          : 'shrink-0 text-xs text-gray-400 dark:text-gray-500'
                      }
                    >
                      {delivered ? t('firstOrderDelivered') : t('firstOrderPending')}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Cars */}
        <div className="card-premium space-y-3 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <Car className="h-4 w-4" /> {t('cars')}
          </p>
          {client.clientCars.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('noCars')}</p>
          ) : (
            <div className="space-y-3">
              {client.clientCars.map((car) => (
                <div key={car.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 dark:border-white/5">
                  {car.photoUrl ? (
                    <Image
                      src={car.photoUrl}
                      alt={car.plate}
                      width={64}
                      height={48}
                      className="h-12 w-16 rounded-md object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-12 w-16 items-center justify-center rounded-md bg-gray-100 dark:bg-white/5">
                      <Car className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-gray-900 dark:text-white">{car.plate}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {[car.brand, car.model, car.color, car.fuelType, car.oilType, car.tankCapacity ? `${car.tankCapacity} ${t('liters')}` : null]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Addresses */}
        <div className="card-premium space-y-3 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <MapPin className="h-4 w-4" /> {t('addresses')}
          </p>
          {client.savedLocations.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('noAddresses')}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {client.savedLocations.map((l) => (
                <li key={l.id} className="text-gray-700 dark:text-gray-200">
                  {l.name}{' '}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    ({l.lat.toFixed(4)}, {l.lng.toFixed(4)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Orders */}
        <div className="card-premium space-y-3 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <Package className="h-4 w-4" /> {t('orders')}
          </p>
          {client.clientOrders.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('noOrders')}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {client.clientOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span className="text-gray-700 dark:text-gray-200">
                    {o.fuelType} · {o.volume} {t('liters')}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {o.status} · {dtf.format(o.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Bonus ledger feed */}
        <div className="card-premium space-y-3 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <Gift className="h-4 w-4" /> {t('ledgerFeed')}
          </p>
          {client.bonusLedger.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('none')}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {client.bonusLedger.map((row) => {
                const sign = row.reason === 'SPENT' ? '−' : '+';
                const dim = row.status !== 'POSTED';
                return (
                  <li key={row.id} className="flex items-center justify-between gap-2">
                    <span className={dim ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}>
                      {t(`reason_${row.reason}`)}
                      {row.status !== 'POSTED' && (
                        <span className="ml-1.5 rounded bg-gray-500/10 px-1.5 py-0.5 text-[10px]">
                          {t(`status_${row.status}`)}
                        </span>
                      )}
                      {row.adminComment && (
                        <span className="ml-1 text-xs text-gray-400">“{row.adminComment}”</span>
                      )}
                    </span>
                    <span className={dim ? 'text-gray-400' : 'font-medium text-gray-900 dark:text-white'}>
                      {sign}
                      {row.liters} {t('liters')}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Danger zone: anonymize / hard-delete this client */}
      <ClientDelete clientId={client.id} deleted={Boolean(client.deletedAt)} />
    </div>
  );
}
