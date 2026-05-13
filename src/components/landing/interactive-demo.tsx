'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Fuel, Truck, CheckCircle } from 'lucide-react';

const VEHICLES = ['TRK-102', 'TRK-215', 'TRK-088', 'TRK-411'] as const;
type VehicleId = (typeof VEHICLES)[number];

const initialData: Record<string, { used: number; limit: number }> = {
  'TRK-102': { used: 45, limit: 200 },
  'TRK-215': { used: 32, limit: 150 },
  'TRK-088': { used: 78, limit: 250 },
  'TRK-411': { used: 12, limit: 180 },
};

export function InteractiveDemo() {
  const t = useTranslations('interactiveDemo');
  const [data, setData] = useState(() => ({ ...initialData }));
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleId>('TRK-215');
  const [limitSlider, setLimitSlider] = useState(initialData['TRK-215'].limit);
  const [requestNotification, setRequestNotification] = useState(false);
  const [deliveryState, setDeliveryState] = useState<'idle' | 'in_progress' | 'completed'>('idle');

  const current = data[selectedVehicle];
  const remaining = Math.max(0, limitSlider - current.used);
  const progressPct = limitSlider > 0 ? Math.min(100, (current.used / limitSlider) * 100) : 0;

  const handleVehicleChange = (v: VehicleId) => {
    setSelectedVehicle(v);
    setLimitSlider(data[v].limit);
    setRequestNotification(false);
    setDeliveryState('idle');
  };

  const handleLimitChange = (value: number) => {
    setLimitSlider(value);
    setData((prev) => ({ ...prev, [selectedVehicle]: { ...prev[selectedVehicle], limit: value } }));
  };

  const handleSimulateRequest = useCallback(() => {
    setRequestNotification(true);
    setDeliveryState('idle');
  }, []);

  const handleSimulateDelivery = useCallback(() => {
    if (deliveryState === 'idle') {
      setDeliveryState('in_progress');
      setTimeout(() => {
        setDeliveryState('completed');
        setData((prev) => ({
          ...prev,
          [selectedVehicle]: { ...prev[selectedVehicle], used: prev[selectedVehicle].used + 40 },
        }));
      }, 2500);
    }
  }, [deliveryState, selectedVehicle]);

  const chartHeights = VEHICLES.map((v) => {
    const d = data[v];
    const pct = d.limit > 0 ? (d.used / d.limit) * 100 : 0;
    return Math.min(100, pct);
  });

  return (
    <section id="interactive-demo" className="relative border-b border-gray-200 dark:border-white/5 py-24 transition-colors duration-300">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl transition-colors duration-300"
        >
          {t('title')}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/80 shadow-2xl"
        >
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500/80" />
              <span className="h-2 w-2 rounded-full bg-amber-500/80" />
              <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
            </div>
            <span className="ml-2 text-xs text-gray-500">Demo · NeoOil Fleet</span>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-500">
                    {t('vehicleLabel')}
                  </label>
                  <select
                    value={selectedVehicle}
                    onChange={(e) => handleVehicleChange(e.target.value as VehicleId)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  >
                    {VEHICLES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-500">
                    {t('fuelLimitLabel')} — 0L – 500L
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={500}
                    value={limitSlider}
                    onChange={(e) => handleLimitChange(Number(e.target.value))}
                    className="h-2 w-full appearance-none rounded-full bg-white/10 accent-primary-500"
                  />
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{limitSlider} L</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-gray-500">{selectedVehicle}</span>
                  <span className="text-gray-900 dark:text-white">
                    {current.used} L / {limitSlider} L
                  </span>
                </div>
                <motion.div
                  className="h-3 overflow-hidden rounded-full bg-white/10"
                  layout
                >
                  <motion.div
                    className="h-full rounded-full bg-primary-500"
                    initial={false}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </motion.div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('remaining')}: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{remaining} L</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSimulateRequest}
                  className="rounded-xl border border-primary-500/50 bg-primary-500/20 px-4 py-2.5 text-sm font-semibold text-primary-300 transition-all hover:bg-primary-500/30 hover:shadow-lg hover:shadow-primary-500/20"
                >
                  {t('simulateRequest')}
                </button>
                <button
                  type="button"
                  onClick={handleSimulateDelivery}
                  disabled={deliveryState === 'in_progress'}
                  className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900 transition-all hover:bg-gray-200 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                >
                  {t('simulateDelivery')}
                </button>
              </div>

              <div className="h-24 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                  Fleet usage
                </p>
                <div className="flex h-14 items-end gap-2">
                  {chartHeights.map((h, i) => (
                    <motion.div
                      key={VEHICLES[i]}
                      initial={false}
                      animate={{ height: `${h}%` }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      className="flex-1 rounded-t bg-primary-500/60"
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-gray-500">
                  {VEHICLES.map((v) => (
                    <span key={v}>{v}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <AnimatePresence mode="wait">
                {requestNotification && (
                  <motion.div
                    key="request"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                      <div className="text-sm">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {t('notificationRequest', { vehicle: selectedVehicle, volume: '40' })}
                        </p>
                        <p className="mt-1 text-emerald-600 dark:text-emerald-300/90">{t('managerApproved')}</p>
                        <p className="mt-1 text-gray-600 dark:text-gray-400">{t('deliveryEta', { minutes: '25' })}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
                {deliveryState === 'in_progress' && (
                  <motion.div
                    key="progress"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Truck className="h-5 w-5 shrink-0 animate-pulse text-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{t('deliveryInProgress')}</p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                          <motion.div
                            className="h-full bg-amber-400"
                            initial={{ width: '0%' }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 2.5, ease: 'linear' }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
                {deliveryState === 'completed' && (
                  <motion.div
                    key="completed"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {t('deliveryCompleted')}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {!requestNotification && deliveryState === 'idle' && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs text-gray-500">{t('demoHint')}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
