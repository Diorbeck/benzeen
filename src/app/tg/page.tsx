'use client';

import { useCallback, useEffect, useState } from 'react';

// ---- Telegram WebApp typings (minimal) -------------------------------------
interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: 'light' | 'dark';
  HapticFeedback?: { notificationOccurred: (t: 'success' | 'error' | 'warning') => void };
}
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const FULL_TANK_MAX = 80;
const VOLUME_OPTIONS = [10, 15, 20, 25, 30, 40] as const;

interface Car {
  id: string;
  plateNumber: string;
  fuelType: 'AI_92' | 'AI_95';
  monthlyLimit: number;
  remainingLiters: number;
}
interface OrderItem {
  id: string;
  status: string;
  fuelType: string;
  volume: number;
  isFullTank: boolean;
  plateNumber: string;
  address: string | null;
  createdAt: string;
  deliveredAt: string | null;
}
interface DriverInfo {
  id: string;
  name: string | null;
  phone: string | null;
}

const FUEL_LABEL: Record<string, string> = { AI_92: 'АИ-92', AI_95: 'АИ-95' };

const STATUS_LABEL: Record<string, string> = {
  CREATED: 'Создан',
  PENDING_APPROVAL: 'На согласовании',
  RECEIVED: 'Принят',
  COURIER_ASSIGNED: 'Курьер назначен',
  ASSIGNED: 'Назначен',
  ON_ROUTE: 'В пути',
  IN_DELIVERY: 'В доставке',
  DELIVERED: 'Доставлен',
  CLOSED: 'Закрыт',
  REJECTED: 'Отклонён',
  CANCELLED: 'Отменён',
};

const STATUS_COLOR: Record<string, string> = {
  DELIVERED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-red-100 text-red-700',
  IN_DELIVERY: 'bg-blue-100 text-blue-700',
  COURIER_ASSIGNED: 'bg-blue-100 text-blue-700',
};

function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s;
}
function statusColor(s: string) {
  return STATUS_COLOR[s] ?? 'bg-gray-100 text-gray-700';
}

export default function TgPage() {
  const [initData, setInitData] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'no-tg' | 'login' | 'app'>('loading');
  const [driver, setDriver] = useState<DriverInfo | null>(null);

  // Wait for the Telegram SDK, then check link status.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    const boot = async () => {
      const wa = window.Telegram?.WebApp;
      if (!wa) {
        if (tries++ < 40) {
          setTimeout(boot, 50);
          return;
        }
        if (!cancelled) setPhase('no-tg');
        return;
      }
      try {
        wa.ready();
        wa.expand();
      } catch {
        /* ignore */
      }
      const data = wa.initData;
      if (!data) {
        if (!cancelled) setPhase('no-tg');
        return;
      }
      if (cancelled) return;
      setInitData(data);

      try {
        const res = await fetch('/api/tg/me', {
          headers: { 'X-Telegram-Init-Data': data },
        });
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json.linked) {
          setDriver(json.driver);
          setPhase('app');
        } else {
          setPhase('login');
        }
      } catch {
        if (!cancelled) setPhase('login');
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === 'loading') {
    return (
      <Screen>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      </Screen>
    );
  }

  if (phase === 'no-tg') {
    return (
      <Screen>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-lg font-semibold text-gray-900">Откройте через Telegram</h1>
          <p className="text-sm text-gray-500">
            Это приложение работает внутри Telegram. Откройте бота Benzeen и нажмите «Открыть приложение».
          </p>
        </div>
      </Screen>
    );
  }

  if (phase === 'login') {
    return (
      <Screen>
        <LoginForm
          initData={initData!}
          onLinked={(d) => {
            setDriver(d);
            setPhase('app');
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Dashboard initData={initData!} driver={driver} />
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-screen w-full max-w-md bg-white text-gray-900">{children}</main>;
}

// ---- Login (one-time linking) ----------------------------------------------
function LoginForm({
  initData,
  onLinked,
}: {
  initData: string;
  onLinked: (d: DriverInfo) => void;
}) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/tg/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });
      const json = await res.json();
      if (res.ok && json.linked) {
        onLinked(json.driver);
      } else {
        setError(json.error || 'Не удалось войти');
      }
    } catch {
      setError('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl">
          ⛽
        </div>
        <h1 className="text-xl font-bold">Вход в Benzeen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Введите телефон и пароль водителя — один раз. Дальше вход будет автоматическим.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Телефон</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
            className="rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-blue-500"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-blue-500"
            required
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !phone || !password}
          className="mt-2 rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}

// ---- Dashboard (tabs) ------------------------------------------------------
type Tab = 'new' | 'orders' | 'limit';

function Dashboard({ initData, driver }: { initData: string; driver: DriverInfo | null }) {
  const [tab, setTab] = useState<Tab>('new');
  const [cars, setCars] = useState<Car[]>([]);
  const [carsLoaded, setCarsLoaded] = useState(false);

  const authHeaders = useCallback(
    (extra?: Record<string, string>) => ({
      'X-Telegram-Init-Data': initData,
      ...(extra ?? {}),
    }),
    [initData],
  );

  const loadCars = useCallback(async () => {
    try {
      const res = await fetch('/api/tg/cars', { headers: authHeaders() });
      if (res.ok) setCars(await res.json());
    } catch {
      /* ignore */
    } finally {
      setCarsLoaded(true);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadCars();
  }, [loadCars]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-100 px-5 py-4">
        <h1 className="text-lg font-bold">Benzeen</h1>
        <p className="text-xs text-gray-500">{driver?.name || driver?.phone || 'Водитель'}</p>
      </header>

      <div className="flex-1 overflow-y-auto pb-20">
        {tab === 'new' && (
          <NewOrder
            cars={cars}
            carsLoaded={carsLoaded}
            authHeaders={authHeaders}
            onCreated={() => {
              loadCars();
              setTab('orders');
            }}
          />
        )}
        {tab === 'orders' && <MyOrders authHeaders={authHeaders} />}
        {tab === 'limit' && <Limits cars={cars} carsLoaded={carsLoaded} />}
      </div>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md border-t border-gray-200 bg-white">
        <TabButton active={tab === 'new'} onClick={() => setTab('new')} label="Заказ" icon="＋" />
        <TabButton active={tab === 'orders'} onClick={() => setTab('orders')} label="Мои заказы" icon="≡" />
        <TabButton active={tab === 'limit'} onClick={() => setTab('limit')} label="Лимит" icon="◔" />
      </nav>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${
        active ? 'text-blue-600' : 'text-gray-400'
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </button>
  );
}

// ---- New order -------------------------------------------------------------
function NewOrder({
  cars,
  carsLoaded,
  authHeaders,
  onCreated,
}: {
  cars: Car[];
  carsLoaded: boolean;
  authHeaders: (extra?: Record<string, string>) => Record<string, string>;
  onCreated: () => void;
}) {
  const [carId, setCarId] = useState('');
  const [volume, setVolume] = useState<number>(0);
  const [fullTank, setFullTank] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const car = cars.find((c) => c.id === carId);
  const remaining = car?.remainingLiters ?? 0;

  useEffect(() => {
    if (!carId && cars.length > 0) setCarId(cars[0].id);
  }, [cars, carId]);

  // Keep volume within the remaining limit when the car changes.
  useEffect(() => {
    setVolume(0);
    setFullTank(false);
  }, [carId]);

  const canSubmit =
    !!car && !submitting && remaining > 0 && (fullTank || (volume > 0 && volume <= remaining));

  const submit = async () => {
    if (!car) return;
    setError(null);
    setSubmitting(true);
    const payload = {
      carId: car.id,
      fuelType: car.fuelType,
      volume: fullTank ? Math.min(remaining, FULL_TANK_MAX) : volume,
      isFullTank: fullTank,
      notes: notes.trim() || undefined,
    };
    try {
      const res = await fetch('/api/tg/orders', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        try {
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        } catch {
          /* ignore */
        }
        setVolume(0);
        setFullTank(false);
        setNotes('');
        onCreated();
      } else {
        setError(json.error || 'Не удалось создать заказ');
      }
    } catch {
      setError('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!carsLoaded) {
    return <CenterSpinner />;
  }
  if (cars.length === 0) {
    return (
      <EmptyState
        title="Нет закреплённых машин"
        text="Обратитесь к менеджеру, чтобы за вами закрепили автомобиль."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      {/* Car selection */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">Автомобиль</span>
        <div className="flex flex-col gap-2">
          {cars.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setCarId(c.id)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left ${
                c.id === carId ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <span className="font-medium">{c.plateNumber}</span>
              <span className="text-sm text-gray-500">
                {FUEL_LABEL[c.fuelType]} · остаток {c.remainingLiters} л
              </span>
            </button>
          ))}
        </div>
      </div>

      {remaining <= 0 ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Лимит на этот месяц исчерпан.
        </p>
      ) : (
        <>
          {/* Volume */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">Объём, литры</span>
            <div className="grid grid-cols-3 gap-2">
              {VOLUME_OPTIONS.filter((v) => v <= remaining).map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => {
                    setVolume(v);
                    setFullTank(false);
                  }}
                  className={`rounded-xl border py-3 text-base font-semibold ${
                    !fullTank && volume === v
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setFullTank((v) => !v);
                setVolume(0);
              }}
              className={`mt-1 rounded-xl border py-3 text-base font-semibold ${
                fullTank ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200'
              }`}
            >
              Полный бак (до {Math.min(remaining, FULL_TANK_MAX)} л)
            </button>
          </div>

          {/* Notes */}
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">Комментарий (необязательно)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              className="rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-blue-500"
              placeholder="Например, адрес или время"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-xl bg-blue-600 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Отправка…' : 'Заказать топливо'}
          </button>
        </>
      )}
    </div>
  );
}

// ---- My orders -------------------------------------------------------------
function MyOrders({
  authHeaders,
}: {
  authHeaders: (extra?: Record<string, string>) => Record<string, string>;
}) {
  const [orders, setOrders] = useState<OrderItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tg/orders', { headers: authHeaders() });
        const json = res.ok ? await res.json() : [];
        if (!cancelled) setOrders(json);
      } catch {
        if (!cancelled) setOrders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  if (orders === null) return <CenterSpinner />;
  if (orders.length === 0) {
    return <EmptyState title="Заказов пока нет" text="Создайте первый заказ во вкладке «Заказ»." />;
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-5">
      {orders.map((o) => (
        <div key={o.id} className="rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{o.plateNumber}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(o.status)}`}>
              {statusLabel(o.status)}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-600">
            {FUEL_LABEL[o.fuelType] ?? o.fuelType} ·{' '}
            {o.isFullTank ? 'полный бак' : `${o.volume} л`}
          </div>
          <div className="mt-0.5 text-xs text-gray-400">{formatDate(o.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}

// ---- Limits ----------------------------------------------------------------
function Limits({ cars, carsLoaded }: { cars: Car[]; carsLoaded: boolean }) {
  if (!carsLoaded) return <CenterSpinner />;
  if (cars.length === 0) {
    return <EmptyState title="Нет закреплённых машин" text="Лимит появится после закрепления авто." />;
  }
  return (
    <div className="flex flex-col gap-3 px-5 py-5">
      {cars.map((c) => {
        const used = Math.max(0, c.monthlyLimit - c.remainingLiters);
        const pct = c.monthlyLimit > 0 ? Math.min(100, Math.round((used / c.monthlyLimit) * 100)) : 0;
        return (
          <div key={c.id} className="rounded-xl border border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.plateNumber}</span>
              <span className="text-sm text-gray-500">{FUEL_LABEL[c.fuelType]}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-gray-500">
              <span>Использовано {used} л</span>
              <span className="font-medium text-gray-700">Остаток {c.remainingLiters} л</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Small shared bits -----------------------------------------------------
function CenterSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-8 text-center">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
