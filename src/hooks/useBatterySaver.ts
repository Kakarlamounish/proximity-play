import { useEffect, useState } from 'react';

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
  addEventListener(type: 'levelchange' | 'chargingchange', listener: () => void): void;
  removeEventListener(type: 'levelchange' | 'chargingchange', listener: () => void): void;
}

interface BatterySaverState {
  /** 0..1 battery level, or null if unknown. */
  level: number | null;
  charging: boolean;
  /** True when level < 20% and not charging, OR tab is hidden. */
  saverActive: boolean;
  /** True only when tab is hidden (background). */
  backgrounded: boolean;
  /** Recommended GPS polling interval (ms). */
  pollIntervalMs: number;
  /** Recommended geolocation maximumAge (ms). */
  maximumAgeMs: number;
}

const NORMAL_INTERVAL = 10_000;
const SAVER_INTERVAL = 60_000;
const BACKGROUND_INTERVAL = 120_000;

/**
 * Auto-detects low battery (<20%) and backgrounded tab,
 * and returns recommended GPS polling settings to extend battery life.
 */
export function useBatterySaver(): BatterySaverState {
  const [level, setLevel] = useState<number | null>(null);
  const [charging, setCharging] = useState(false);
  const [backgrounded, setBackgrounded] = useState<boolean>(
    typeof document !== 'undefined' ? document.hidden : false,
  );

  useEffect(() => {
    let battery: BatteryManager | null = null;
    let cancelled = false;

    const update = () => {
      if (!battery || cancelled) return;
      setLevel(battery.level);
      setCharging(battery.charging);
    };

    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (typeof nav.getBattery === 'function') {
      nav.getBattery().then((b) => {
        if (cancelled) return;
        battery = b;
        update();
        b.addEventListener('levelchange', update);
        b.addEventListener('chargingchange', update);
      }).catch(() => { /* unsupported */ });
    }

    return () => {
      cancelled = true;
      if (battery) {
        battery.removeEventListener('levelchange', update);
        battery.removeEventListener('chargingchange', update);
      }
    };
  }, []);

  useEffect(() => {
    const onVis = () => setBackgrounded(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const lowBattery = level !== null && level < 0.2 && !charging;
  const saverActive = lowBattery || backgrounded;

  const pollIntervalMs = backgrounded
    ? BACKGROUND_INTERVAL
    : lowBattery
      ? SAVER_INTERVAL
      : NORMAL_INTERVAL;

  return {
    level,
    charging,
    saverActive,
    backgrounded,
    pollIntervalMs,
    maximumAgeMs: Math.min(pollIntervalMs, 60_000),
  };
}
