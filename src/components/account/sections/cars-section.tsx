'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Car, Plus, Pencil, Trash2, Star, ImagePlus, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import { formatPlate } from '@/lib/input-format';
import { type AccountCar, type FuelType, cardCls, inputCls } from '@/components/account/shared';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const FUELS: FuelType[] = ['AI_92', 'AI_95', 'AI_100'];

// Мои машины: full CRUD, optional photo (client-compressed), default-car toggle.
export function CarsSection({ cars, defaultCarId }: { cars: AccountCar[]; defaultCarId: string | null }) {
  const t = useTranslations('account');
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busyDefault, setBusyDefault] = useState<string | null>(null);

  const del = async (id: string) => {
    setError('');
    const res = await fetch(`/api/account/cars/${id}`, { method: 'DELETE' });
    if (res.status === 409) {
      setError(t('cars.cannotDelete'));
      return;
    }
    if (res.ok) router.refresh();
  };

  const makeDefault = async (id: string) => {
    setBusyDefault(id);
    try {
      const res = await fetch(`/api/account/cars/${id}/default`, { method: 'POST' });
      if (res.ok) router.refresh();
    } finally {
      setBusyDefault(null);
    }
  };

  return (
    <section className={cardCls}>
      <div className="mb-6 flex items-center gap-2.5">
        <Car className="h-5 w-5 text-gray-500 dark:text-gray-400" aria-hidden />
        <h2 className="text-heading text-navy dark:text-white">{t('cars.title')}</h2>
      </div>

      {error && (
        <p className="mb-4 rounded-control bg-warning-500/10 px-4 py-3 text-sm text-warning-600 dark:text-warning-500">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {cars.map((c) =>
          editingId === c.id ? (
            <li key={c.id}>
              <CarForm
                car={c}
                onDone={() => {
                  setEditingId(null);
                  router.refresh();
                }}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li
              key={c.id}
              className="flex items-start gap-3 rounded-control border border-gray-200 dark:border-white/10 p-3"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control bg-gray-100 dark:bg-white/5">
                {c.photoUrl ? (
                  <Image src={c.photoUrl} alt={c.plate} fill sizes="64px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-gray-400 dark:text-gray-500">
                    <Car className="h-6 w-6" aria-hidden />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-navy dark:text-white">{c.plate}</span>
                  {defaultCarId === c.id && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                      <Star className="h-3 w-3 fill-current" aria-hidden /> {t('cars.defaultBadge')}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                  {[c.brand, c.model, c.color, c.fuelType ? t(`fuel.${c.fuelType}`) : null, c.oilType]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
                {defaultCarId !== c.id && (
                  <button
                    type="button"
                    onClick={() => makeDefault(c.id)}
                    disabled={busyDefault === c.id}
                    className="mt-1.5 inline-flex min-h-11 items-center gap-1 rounded-control text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 disabled:opacity-50"
                  >
                    <Star className="h-3.5 w-3.5" /> {t('cars.makeDefault')}
                  </button>
                )}
              </div>

              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setEditingId(c.id);
                    setAdding(false);
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-control text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-white/10 hover:text-navy dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60"
                  aria-label={t('cars.edit')}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => del(c.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-control text-gray-500 dark:text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60"
                  aria-label={t('cars.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <div className="mt-3">
          <CarForm
            onDone={() => {
              setAdding(false);
              router.refresh();
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditingId(null);
            setError('');
          }}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-dashed border-gray-300 dark:border-white/15 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 transition hover:border-primary-300 dark:hover:border-primary-500/40 hover:text-primary-600 dark:hover:text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60"
        >
          <Plus className="h-4 w-4" /> {t('cars.add')}
        </button>
      )}
      {cars.length === 0 && !adding && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t('cars.empty')}</p>
      )}
    </section>
  );
}

function CarForm({ car, onDone, onCancel }: { car?: AccountCar; onDone: () => void; onCancel: () => void }) {
  const t = useTranslations('account');
  const [plate, setPlate] = useState(car?.plate ?? '');
  const [model, setModel] = useState(car?.model ?? '');
  const [brand, setBrand] = useState(car?.brand ?? '');
  const [color, setColor] = useState(car?.color ?? '');
  const [fuelType, setFuelType] = useState<FuelType | ''>(car?.fuelType ?? '');
  const [oilType, setOilType] = useState(car?.oilType ?? '');
  const [tank, setTank] = useState(car?.tankCapacity ? String(car.tankCapacity) : '');
  // Existing saved photo (for edit) and a freshly picked local preview.
  const [photoUrl, setPhotoUrl] = useState<string | null>(car?.photoUrl ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError(t('cars.photoInvalid'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t('cars.photoTooLarge'));
      return;
    }
    try {
      const compressed = await imageCompression(file, {
        maxWidthOrHeight: 1600,
        maxSizeMB: 5,
        useWebWorker: true,
      });
      setPhotoFile(compressed);
      setPreview(URL.createObjectURL(compressed));
      setRemovePhoto(false);
    } catch {
      setError(t('cars.photoUploadFailed'));
    }
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPreview(null);
    setPhotoUrl(null);
    setRemovePhoto(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim()) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        plate: plate.trim(),
        model: model.trim() || undefined,
        brand: brand.trim() || undefined,
        color: color.trim() || undefined,
        fuelType: fuelType || undefined,
        oilType: oilType.trim() || undefined,
        tankCapacity: tank ? Number(tank) : undefined,
      };
      const res = await fetch(car ? `/api/account/cars/${car.id}` : '/api/account/cars', {
        method: car ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(t('cars.photoUploadFailed'));
        return;
      }
      const saved = (await res.json()) as { id: string };

      // Photo side-effects, best-effort.
      if (photoFile) {
        const up = await fetch(`/api/account/cars/${saved.id}/photo`, {
          method: 'POST',
          headers: { 'Content-Type': photoFile.type || 'image/jpeg' },
          body: photoFile,
        });
        if (!up.ok) {
          setError(t('cars.photoUploadFailed'));
          return;
        }
      } else if (removePhoto && car?.photoUrl) {
        await fetch(`/api/account/cars/${saved.id}/photo`, { method: 'DELETE' });
      }

      onDone();
    } finally {
      setBusy(false);
    }
  };

  const shownPhoto = preview ?? photoUrl;

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-card border border-gray-200/60 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4"
    >
      <input
        className={inputCls}
        value={plate}
        onChange={(e) => setPlate(formatPlate(e.target.value))}
        placeholder={t('cars.plate')}
        maxLength={12}
        autoCapitalize="characters"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t('cars.brand')} maxLength={60} />
        <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} placeholder={t('cars.model')} maxLength={60} />
        <input className={inputCls} value={color} onChange={(e) => setColor(e.target.value)} placeholder={t('cars.color')} maxLength={40} />
        <input
          className={inputCls}
          value={tank}
          onChange={(e) => setTank(e.target.value.replace(/\D/g, ''))}
          placeholder={t('cars.tank')}
          inputMode="numeric"
          maxLength={3}
        />
        <select
          className={inputCls}
          value={fuelType}
          onChange={(e) => setFuelType(e.target.value as FuelType | '')}
          aria-label={t('cars.fuelType')}
        >
          <option value="">{t('cars.fuelNone')}</option>
          {FUELS.map((f) => (
            <option key={f} value={f}>
              {t(`fuel.${f}`)}
            </option>
          ))}
        </select>
        <input className={inputCls} value={oilType} onChange={(e) => setOilType(e.target.value)} placeholder={t('cars.oilType')} maxLength={60} />
      </div>

      {/* Photo */}
      <div className="flex items-center gap-3 pt-1">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control bg-gray-100 dark:bg-white/5">
          {shownPhoto ? (
            <Image src={shownPhoto} alt="" fill sizes="64px" className="object-cover" unoptimized />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-gray-400 dark:text-gray-500">
              <ImagePlus className="h-6 w-6" aria-hidden />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              {shownPhoto ? t('cars.photoChange') : t('cars.photoAdd')}
            </Button>
            {shownPhoto && (
              <Button type="button" size="sm" variant="ghost" onClick={clearPhoto}>
                <X className="h-4 w-4" /> {t('cars.photoRemove')}
              </Button>
            )}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('cars.photoHint')}</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? t('saving') : t('cars.save')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t('cars.cancel')}
        </Button>
      </div>
    </form>
  );
}
