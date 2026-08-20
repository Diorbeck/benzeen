"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Bluetooth, Loader2 } from "lucide-react";

// Модуль 3 ТЗ v2, уровень 2 — BLE-маячок на колонке.
//
// Сканирование BLE в браузере доступно не везде (в iOS Safari его нет вовсе),
// поэтому блок ведёт себя как надстройка над ручным выбором: где сканирование
// есть — колонка определяется сама, где нет — клиент просто выбирает номер
// руками, и заправка ничем не блокируется. Решение «у какой колонки клиент»
// принимает сервер (/api/fueling/dispensers/resolve), браузер только приносит
// список слышимых маячков и силу сигнала.

type Reading = { beaconId: string; rssi: number };

// Минимальная форма Web Bluetooth LE Scan: полноценных типов в lib.dom нет,
// а тянуть @types/web-bluetooth ради двух полей смысла нет.
type LeScan = { active: boolean; stop: () => void };
type LeScanEvent = {
  rssi?: number;
  device?: { name?: string | null };
  serviceData?: Map<string, DataView>;
};
type BluetoothLike = {
  requestLEScan?: (options: {
    acceptAllAdvertisements?: boolean;
    keepRepeatedDevices?: boolean;
  }) => Promise<LeScan>;
  addEventListener: (type: string, cb: (e: Event) => void) => void;
  removeEventListener: (type: string, cb: (e: Event) => void) => void;
};

function getBluetooth(): BluetoothLike | null {
  const nav = navigator as unknown as { bluetooth?: BluetoothLike };
  const bt = nav.bluetooth;
  return bt && typeof bt.requestLEScan === "function" ? bt : null;
}

/** Идентификатор маячка из объявления: имя устройства или UUID сервиса. */
export function beaconIdFromAdvertisement(e: LeScanEvent): string | null {
  const name = e.device?.name?.trim();
  if (name) return name;
  const firstService = e.serviceData ? [...e.serviceData.keys()][0] : undefined;
  return firstService ?? null;
}

type Match = {
  confident: boolean;
  dispenser: { number: number };
  station: { id: string; name: string };
};

export function BleDispenserDetect({
  stationId,
  onPick,
}: {
  stationId: string;
  /** Клиент подтвердил найденную колонку — родительский экран подставляет номер. */
  onPick: (dispenserNumber: number) => void;
}) {
  const t = useTranslations("fueling");
  const [supported, setSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [status, setStatus] = useState<"idle" | "none" | "ambiguous" | "error">(
    "idle",
  );
  const scanRef = useRef<LeScan | null>(null);

  useEffect(() => {
    setSupported(getBluetooth() !== null);
    return () => {
      if (scanRef.current?.active) scanRef.current.stop();
    };
  }, []);

  const scan = useCallback(async () => {
    const bt = getBluetooth();
    if (!bt?.requestLEScan) return;

    setScanning(true);
    setMatch(null);
    setStatus("idle");

    const readings = new Map<string, number>();
    const onAdv = (raw: Event) => {
      const e = raw as unknown as LeScanEvent;
      const id = beaconIdFromAdvertisement(e);
      if (!id || typeof e.rssi !== "number") return;
      const prev = readings.get(id);
      if (prev == null || e.rssi > prev) readings.set(id, e.rssi);
    };

    try {
      const scanHandle = await bt.requestLEScan({
        acceptAllAdvertisements: true,
        keepRepeatedDevices: true,
      });
      scanRef.current = scanHandle;
      bt.addEventListener("advertisementreceived", onAdv);

      // Четыре секунды — компромисс: маячок успевает попасть в скан несколько
      // раз, а клиент не ждёт у колонки заметную паузу.
      await new Promise((r) => setTimeout(r, 4000));

      bt.removeEventListener("advertisementreceived", onAdv);
      if (scanHandle.active) scanHandle.stop();
      scanRef.current = null;

      const beacons: Reading[] = [...readings.entries()].map(
        ([beaconId, rssi]) => ({ beaconId, rssi }),
      );
      if (beacons.length === 0) {
        setStatus("none");
        return;
      }

      const res = await fetch("/api/fueling/dispensers/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beacons }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const body = (await res.json()) as { match: Match | null };
      if (!body.match) {
        setStatus("none");
        return;
      }
      // Колонка с другой АЗС — значит клиент открыл экран не той станции, и
      // подставлять номер нельзя: номера на разных объектах не связаны.
      if (stationId && body.match.station.id !== stationId) {
        setStatus("none");
        return;
      }
      setMatch(body.match);
      if (!body.match.confident) setStatus("ambiguous");
    } catch {
      setStatus("error");
    } finally {
      setScanning(false);
    }
  }, [stationId]);

  return (
    <div className="rounded-card border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-navy-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-navy dark:text-white">
            <Bluetooth className="h-4 w-4 text-sky-500" aria-hidden />
            {t("bleTitle")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            {supported ? t("bleHint") : t("bleUnsupported")}
          </p>
        </div>
        {supported && (
          <button
            type="button"
            onClick={scan}
            disabled={scanning}
            className="flex h-9 shrink-0 items-center gap-2 rounded-control bg-navy px-3 text-xs font-semibold text-primary-950 transition-colors hover:bg-navy-800 disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-600"
          >
            {scanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : null}
            {scanning ? t("bleScanning") : t("bleScan")}
          </button>
        )}
      </div>

      {match && (
        <div className="mt-3 rounded-control bg-sky-50 px-3 py-2.5 dark:bg-white/5">
          <p className="text-sm font-semibold text-navy dark:text-white">
            {t("bleFound", { n: match.dispenser.number })}
          </p>
          {status === "ambiguous" && (
            <p className="mt-1 text-xs text-warning-600">{t("bleAmbiguous")}</p>
          )}
          <button
            type="button"
            onClick={() => onPick(match.dispenser.number)}
            className="mt-2 h-9 rounded-control bg-primary-500 px-3 text-xs font-semibold text-primary-950 transition-colors hover:bg-primary-600"
          >
            {t("bleUse")}
          </button>
        </div>
      )}

      {status === "none" && !match && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {t("bleNotFound")}
        </p>
      )}
      {status === "error" && (
        <p className="mt-3 text-xs text-warning-600">{t("bleError")}</p>
      )}
    </div>
  );
}
